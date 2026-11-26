import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { tenantContext } from '../../prisma/tenant-context';
import { EmailService } from '../email/email.service';

export const INVITE_HOURS = 72;
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

/**
 * One-time "set your password" invites. Accounts that an admin or an approval creates never
 * get a password chosen by someone else: the person sets their own through the emailed link.
 */
@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private email: EmailService,
  ) {}

  /** A password hash nobody knows, so the account cannot be logged into until the invite is used. */
  static unusablePasswordSeed() {
    return randomBytes(24).toString('hex');
  }

  /**
   * Cancel older invites for the user and create a new one. Returns the raw token (emailed, never stored).
   * The caller must already have made sure the user is theirs to invite.
   */
  async issue(userId: string, client: Pick<PrismaService, 'accountInvite'> = this.prisma) {
    const token = randomBytes(32).toString('hex');
    // not filtered by school: the user is verified by the caller, and filtering would cost a
    // second database connection when this runs inside a transaction
    await tenantContext.allSchools(async () => {
      await client.accountInvite.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
      await client.accountInvite.create({
        data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_HOURS * 3600_000) },
      });
    });
    return token;
  }

  link(token: string) {
    const base = (this.config.get<string>('APP_URL') || 'http://localhost:3000').replace(/\/$/, '');
    return `${base}/accept-invite?token=${token}`;
  }

  async send(to: string, orgName: string, token: string, subject = 'Set your password to get started') {
    const link = this.link(token);
    const safeName = orgName.replace(/[<>&"]/g, '');
    const html = `<p>Welcome to Irisine Classrooms.</p>
<p>An account was created for you at <b>${safeName}</b>. Set your password to get started:</p>
<p><a href="${link}">${link}</a></p><p>This link works once and expires in ${INVITE_HOURS} hours.</p>`;
    try {
      // false only when email is not set up; the caller then hands the link over itself
      return (await this.email.sendEmail(to, subject, html)) !== false;
    } catch {
      this.logger.error('Invite email could not be delivered');
      return false;
    }
  }
}
