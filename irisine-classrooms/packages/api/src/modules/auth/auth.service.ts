import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  HttpException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { OtpService, OtpPurpose } from './otp.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private otp: OtpService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified) {
      await this.sendOtp(user.email, 'SIGNUP'); // best effort, cooldown-safe
      throw new ForbiddenException({ code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email to continue' });
    }

    return this.generateTokens(user);
  }

  /**
   * Sign up: creates a new school and its first admin (SUPER_ADMIN),
   * then logs the admin in. Disabled unless ALLOW_SIGNUP=true (fail closed).
   */
  async register(dto: RegisterDto) {
    if (this.config.get<string>('ALLOW_SIGNUP')?.toLowerCase() !== 'true') {
      throw new ForbiddenException('Sign up is disabled');
    }

    const email = this.otp.normalize(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && existing.emailVerified) {
      throw new ConflictException('An account with this email already exists');
    }

    // A pending (unverified) sign-up is overwritten by the newest submission, so
    // whoever pre-registered an email can never keep their password: the person who
    // proves they own the inbox (OTP) is the one whose details are stored.
    if (existing) {
      const passwordHash = await bcrypt.hash(dto.password, 10);
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash, firstName: dto.firstName.trim(), lastName: dto.lastName.trim() },
        }),
        this.prisma.school.update({
          where: { id: existing.schoolId },
          data: { name: dto.schoolName.trim() },
        }),
        this.prisma.refreshToken.deleteMany({ where: { userId: existing.id } }),
      ]);
    } else {
      const passwordHash = await bcrypt.hash(dto.password, 10);
      const slug = dto.schoolName
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '')
        .slice(0, 8) || 'SCHOOL';
      const code = `${slug}-${randomUUID().slice(0, 6).toUpperCase()}`;

      await this.prisma.$transaction(async (tx) => {
        const school = await tx.school.create({
          data: { name: dto.schoolName.trim(), code, email },
        });
        await tx.user.create({
          data: {
            email,
            passwordHash,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            role: 'SUPER_ADMIN',
            schoolId: school.id,
            emailVerified: false,
          },
        });
      });
    }

    await this.sendOtp(email, 'SIGNUP');
    return { requiresVerification: true, email, message: 'We sent a verification code to your email.' };
  }

  /**
   * Send a code. Always answers the same way so it cannot be used to find out
   * which emails are registered (this also hides the resend cooldown).
   */
  async sendOtp(emailRaw: string, purpose: OtpPurpose) {
    const email = this.otp.normalize(emailRaw);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const eligible =
      !!user && user.isActive && (purpose === 'SIGNUP' ? !user.emailVerified : true);

    if (eligible) {
      try {
        await this.otp.send(email, purpose);
      } catch (err) {
        if (!(err instanceof HttpException && err.getStatus() === 429)) throw err;
      }
    }
    return {
      message: 'If the email is eligible, a verification code has been sent.',
      retryAfter: Number(this.config.get('OTP_RESEND_COOLDOWN_SECONDS') ?? 60),
    };
  }

  async verifyOtp(emailRaw: string, code: string, purpose: OtpPurpose) {
    const email = this.otp.normalize(emailRaw);
    await this.otp.consume(email, purpose, code);

    if (purpose === 'RESET') {
      return { resetToken: await this.otp.issueResetToken(email) };
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new BadRequestException('Invalid or expired code');
    const verified = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });
    return this.generateTokens(verified);
  }

  async refreshTokens(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    return this.generateTokens(stored.user);
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  requestPasswordReset(email: string) {
    return this.sendOtp(email, 'RESET');
  }

  async resetPassword(emailRaw: string, resetToken: string, newPassword: string) {
    const email = this.otp.normalize(emailRaw);
    await this.otp.consume(email, 'RESET_TOKEN', resetToken);

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Invalid or expired code');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, emailVerified: true },
      }),
      // sign out everywhere: old sessions must not survive a password reset
      this.prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ]);

    return { message: 'Password reset successfully' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Password changed successfully' };
  }

  private async generateTokens(user: { id: string; email: string; role: string; schoolId: string }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
}
