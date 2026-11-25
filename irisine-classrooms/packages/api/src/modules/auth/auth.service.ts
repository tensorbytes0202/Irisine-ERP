import {
  Injectable,
  UnauthorizedException,
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
import { createHash } from 'crypto';
import { Portal, portalForRole } from './portals';
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
      where: { email: dto.email.trim().toLowerCase() },
      include: { school: { select: { status: true } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.school.status !== 'ACTIVE') {
      throw new ForbiddenException({ code: 'SCHOOL_NOT_ACTIVE', message: 'Your school account is not active' });
    }

    // The portal the user picked is only a request. The real role comes from the database.
    const portal = portalForRole(user.role);
    if (dto.portal && dto.portal !== portal) {
      throw new ForbiddenException('This account cannot sign in to that portal');
    }

    return this.generateTokens(user);
  }

  /**
   * First-time password for an account created by an approval (school admin) or by invite.
   * The one-time token is stored only as a hash, expires, and can be used once.
   */
  async acceptInvite(token: string, password: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invite = await this.prisma.accountInvite.findUnique({ where: { tokenHash } });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      throw new BadRequestException('This invite link is invalid or has expired');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const burned = await this.prisma.accountInvite.updateMany({
      where: { id: invite.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (burned.count !== 1) throw new BadRequestException('This invite link is invalid or has expired');

    const user = await this.prisma.user.update({
      where: { id: invite.userId },
      data: { passwordHash, emailVerified: true },
    });
    await this.prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    return this.generateTokens(user);
  }

  /**
   * Send a code. Always answers the same way so it cannot be used to find out
   * which emails are registered (this also hides the resend cooldown).
   */
  async sendOtp(emailRaw: string, purpose: OtpPurpose) {
    const email = this.otp.normalize(emailRaw);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && user.isActive) {
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

  /** Email code check. Used for password reset: returns a one-time token for the new password. */
  async verifyOtp(emailRaw: string, code: string, purpose: OtpPurpose) {
    const email = this.otp.normalize(emailRaw);
    await this.otp.consume(email, purpose, code);
    return { resetToken: await this.otp.issueResetToken(email) };
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

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES') || '7d',
    });

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
        portal: portalForRole(user.role) as Portal | null,
      },
    };
  }
}
