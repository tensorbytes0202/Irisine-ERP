import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { otpEmail } from '../email/templates/otp-email';

export type OtpPurpose = 'SIGNUP' | 'RESET';
type StoredPurpose = OtpPurpose | 'RESET_TOKEN';

const INVALID = 'Invalid or expired code';

/**
 * Email one-time codes. Only an HMAC of the code is stored (never the code),
 * codes expire, are single use, limited to N attempts, and a new code
 * invalidates the previous one. A resend cooldown is enforced per email+purpose.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private email: EmailService,
  ) {}

  private get expiryMinutes() {
    return Number(this.config.get('OTP_EXPIRY_MINUTES') ?? 5);
  }
  private get cooldownSeconds() {
    return Number(this.config.get('OTP_RESEND_COOLDOWN_SECONDS') ?? 60);
  }
  private get maxAttempts() {
    return Number(this.config.get('OTP_MAX_ATTEMPTS') ?? 5);
  }

  normalize(email: string) {
    return email.trim().toLowerCase();
  }

  hash(email: string, purpose: StoredPurpose, code: string) {
    const key = this.config.get<string>('OTP_SECRET') || this.config.get<string>('JWT_SECRET') || '';
    return createHmac('sha256', key).update(`${email}:${purpose}:${code}`).digest('hex');
  }

  /** 6 digits, cryptographically secure. */
  generateCode() {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private async issue(email: string, purpose: StoredPurpose, code: string, minutes: number, payload?: string) {
    await this.prisma.emailOtp.updateMany({
      where: { email, purpose, usedAt: null },
      data: { usedAt: new Date() }, // invalidate any earlier code
    });
    await this.prisma.emailOtp.create({
      data: {
        email,
        purpose,
        codeHash: this.hash(email, purpose, code),
        payload: payload ?? null,
        expiresAt: new Date(Date.now() + minutes * 60_000),
      },
    });
  }

  /** Throws 429 if a code was sent less than the cooldown ago. */
  async assertCooldown(email: string, purpose: OtpPurpose) {
    const last = await this.prisma.emailOtp.findFirst({
      where: { email, purpose },
      orderBy: { createdAt: 'desc' },
    });
    if (!last) return;
    const waitMs = last.createdAt.getTime() + this.cooldownSeconds * 1000 - Date.now();
    if (waitMs > 0) {
      throw new HttpException(
        { message: `Please wait ${Math.ceil(waitMs / 1000)}s before requesting another code`, retryAfter: Math.ceil(waitMs / 1000) },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Create + email a code. Caller decides whether the address is eligible. */
  async send(emailRaw: string, purpose: OtpPurpose, payload?: string) {
    const email = this.normalize(emailRaw);
    await this.assertCooldown(email, purpose);
    const code = this.generateCode();
    await this.issue(email, purpose, code, this.expiryMinutes, payload);
    const { subject, html } = otpEmail({ code, purpose, minutes: this.expiryMinutes });
    try {
      await this.email.sendEmail(email, subject, html);
    } catch {
      // Do not leak delivery details to the caller.
      this.logger.error(`OTP email could not be delivered to a ${purpose} request`);
    }
  }

  /** Pending sign-up details from the most recent SIGNUP code for this email (if any). */
  async pendingPayload(emailRaw: string): Promise<string | null> {
    const row = await this.prisma.emailOtp.findFirst({
      where: { email: this.normalize(emailRaw), purpose: 'SIGNUP', payload: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    return row?.payload ?? null;
  }

  /** Check a code and burn it. Returns the code's stored payload. Throws a generic 400 on any failure. */
  async consume(emailRaw: string, purpose: StoredPurpose, code: string): Promise<string | null> {
    const email = this.normalize(emailRaw);
    const row = await this.prisma.emailOtp.findFirst({
      where: { email, purpose, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!row || row.expiresAt < new Date()) throw new BadRequestException(INVALID);

    if (row.attempts >= this.maxAttempts) {
      await this.prisma.emailOtp.updateMany({ where: { id: row.id }, data: { usedAt: new Date() } });
      throw new BadRequestException(INVALID);
    }

    const expected = Buffer.from(row.codeHash, 'hex');
    const given = Buffer.from(this.hash(email, purpose, code), 'hex');
    const ok = expected.length === given.length && timingSafeEqual(expected, given);

    if (!ok) {
      const updated = await this.prisma.emailOtp.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 } },
      });
      if (updated.attempts >= this.maxAttempts) {
        await this.prisma.emailOtp.updateMany({ where: { id: row.id }, data: { usedAt: new Date() } });
      }
      throw new BadRequestException(INVALID);
    }

    // Single use, safe against two requests racing with the same code.
    const burned = await this.prisma.emailOtp.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (burned.count !== 1) throw new BadRequestException(INVALID);
    return row.payload ?? null;
  }

  /** After a RESET code is verified: a short-lived one-time token to set the new password. */
  async issueResetToken(emailRaw: string) {
    const email = this.normalize(emailRaw);
    const token = randomBytes(24).toString('hex');
    await this.issue(email, 'RESET_TOKEN', token, 10);
    return token;
  }
}
