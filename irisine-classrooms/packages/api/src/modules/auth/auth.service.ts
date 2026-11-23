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

    return this.generateTokens(user);
  }

  /**
   * Sign up step 1. Nothing is created yet: the school/name details are parked with
   * the emailed code, and the password is NOT stored. The account (and its password)
   * is created in verifyOtp, by whoever proves they own the inbox. So a stranger who
   * submits someone else's email can never choose that account's password.
   * Disabled unless ALLOW_SIGNUP=true (fail closed).
   */
  async register(dto: RegisterDto) {
    if (this.config.get<string>('ALLOW_SIGNUP')?.toLowerCase() !== 'true') {
      throw new ForbiddenException('Sign up is disabled');
    }

    const email = this.otp.normalize(dto.email);
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('An account with this email already exists');
    }

    const payload = JSON.stringify({
      schoolName: dto.schoolName.trim(),
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
    });
    try {
      await this.otp.send(email, 'SIGNUP', payload);
    } catch (err) {
      if (!(err instanceof HttpException && err.getStatus() === 429)) throw err;
    }
    return { requiresVerification: true, email, message: 'We sent a verification code to your email.' };
  }

  /**
   * Send a code. Always answers the same way so it cannot be used to find out
   * which emails are registered (this also hides the resend cooldown).
   */
  async sendOtp(emailRaw: string, purpose: OtpPurpose) {
    const email = this.otp.normalize(emailRaw);
    const user = await this.prisma.user.findUnique({ where: { email } });

    let payload: string | undefined;
    let eligible: boolean;
    if (purpose === 'SIGNUP') {
      // resend: only for a pending sign-up (no account yet, details already parked)
      payload = (await this.otp.pendingPayload(email)) ?? undefined;
      eligible = !user && !!payload;
    } else {
      eligible = !!user && user.isActive;
    }

    if (eligible) {
      try {
        await this.otp.send(email, purpose, payload);
      } catch (err) {
        if (!(err instanceof HttpException && err.getStatus() === 429)) throw err;
      }
    }
    return {
      message: 'If the email is eligible, a verification code has been sent.',
      retryAfter: Number(this.config.get('OTP_RESEND_COOLDOWN_SECONDS') ?? 60),
    };
  }

  async verifyOtp(emailRaw: string, code: string, purpose: OtpPurpose, password?: string) {
    const email = this.otp.normalize(emailRaw);

    if (purpose === 'SIGNUP' && (!password || password.length < 8)) {
      // checked before the code is consumed so a typo does not burn it
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const payload = await this.otp.consume(email, purpose, code);

    if (purpose === 'RESET') {
      return { resetToken: await this.otp.issueResetToken(email) };
    }

    // SIGNUP: the code proves inbox ownership, so create the account now.
    let details: { schoolName: string; firstName: string; lastName: string };
    try {
      details = JSON.parse(payload ?? '');
    } catch {
      throw new BadRequestException('Invalid or expired code');
    }
    if (!details?.schoolName || !details.firstName || !details.lastName) {
      throw new BadRequestException('Invalid or expired code');
    }

    const passwordHash = await bcrypt.hash(password as string, 10);
    const slug = details.schoolName.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'SCHOOL';
    const schoolCode = `${slug}-${randomUUID().slice(0, 6).toUpperCase()}`;

    let user;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const school = await tx.school.create({
          data: { name: details.schoolName, code: schoolCode, email },
        });
        return tx.user.create({
          data: {
            email,
            passwordHash,
            firstName: details.firstName,
            lastName: details.lastName,
            role: 'SUPER_ADMIN',
            schoolId: school.id,
            emailVerified: true,
          },
        });
      });
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException('An account with this email already exists');
      throw err;
    }
    return this.generateTokens(user);
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
