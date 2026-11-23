import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';

function build(user: any | null) {
  const prisma: any = {
    user: {
      findUnique: jest.fn(async () => user),
      update: jest.fn(async ({ data }: any) => ({ ...user, ...data })),
    },
    refreshToken: { deleteMany: jest.fn(async () => ({ count: 2 })), create: jest.fn(async () => ({})) },
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
  };
  const config: any = { get: (k: string) => (({ ALLOW_SIGNUP: 'true' }) as any)[k] };
  const otp = new OtpService(prisma, config, { sendEmail: jest.fn() } as any);
  jest.spyOn(otp, 'send').mockResolvedValue(undefined);
  jest.spyOn(otp, 'consume').mockResolvedValue(undefined);
  jest.spyOn(otp, 'issueResetToken').mockResolvedValue('reset-token-reset-token');
  const jwt: any = { sign: () => 'jwt' };
  const svc = new AuthService(prisma, jwt, config, otp);
  return { svc, prisma, otp };
}

describe('forgot password flow', () => {
  const user = { id: 'u1', email: 'a@test.com', isActive: true, emailVerified: true, role: 'ADMIN', schoolId: 's' };

  it('answers identically for known and unknown emails', async () => {
    const known = await build(user).svc.requestPasswordReset('a@test.com');
    const unknown = await build(null).svc.requestPasswordReset('nobody@test.com');
    expect(unknown).toEqual(known);
  });

  it('only sends a code to real accounts', async () => {
    const a = build(user);
    await a.svc.requestPasswordReset('a@test.com');
    expect(a.otp.send).toHaveBeenCalledWith('a@test.com', 'RESET');
    const b = build(null);
    await b.svc.requestPasswordReset('nobody@test.com');
    expect(b.otp.send).not.toHaveBeenCalled();
  });

  it('verified reset OTP returns a one-time reset token', async () => {
    const { svc } = build(user);
    await expect(svc.verifyOtp('a@test.com', '123456', 'RESET')).resolves.toEqual({
      resetToken: 'reset-token-reset-token',
    });
  });

  it('sets the new password and revokes every refresh token', async () => {
    const { svc, prisma } = build(user);
    await svc.resetPassword('a@test.com', 'reset-token-reset-token', 'NewPassw0rd!');
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(await bcrypt.compare('NewPassw0rd!', data.passwordHash)).toBe(true);
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });
});

describe('email verification at sign-in', () => {
  const base = { id: 'u2', email: 'n@test.com', isActive: true, emailVerified: false, role: 'SUPER_ADMIN', schoolId: 's' };

  it('blocks login for an unverified account and sends a code', async () => {
    const passwordHash = await bcrypt.hash('Passw0rd!', 4);
    const { svc, otp } = build({ ...base, passwordHash });
    await expect(svc.login({ email: 'n@test.com', password: 'Passw0rd!' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(otp.send).toHaveBeenCalledWith('n@test.com', 'SIGNUP');
  });

  it('still rejects a wrong password first', async () => {
    const passwordHash = await bcrypt.hash('Passw0rd!', 4);
    const { svc } = build({ ...base, passwordHash });
    await expect(svc.login({ email: 'n@test.com', password: 'wrong-pass' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('verifying the sign-up code marks the email verified and returns tokens', async () => {
    const { svc, prisma } = build(base);
    const res: any = await svc.verifyOtp('n@test.com', '123456', 'SIGNUP');
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { emailVerified: true } }));
    expect(res.accessToken).toBe('jwt');
  });
});
