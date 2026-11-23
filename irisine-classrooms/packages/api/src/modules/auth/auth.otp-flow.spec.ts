import { BadRequestException, ConflictException } from '@nestjs/common';
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
  jest.spyOn(otp, 'consume').mockResolvedValue(null);
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
    expect(a.otp.send).toHaveBeenCalledWith('a@test.com', 'RESET', undefined);
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

describe('sign-up (account created only after the code is verified)', () => {
  const payload = JSON.stringify({ schoolName: 'Acme School', firstName: 'Mina', lastName: 'Rao' });

  function buildSignup(existingUser: any | null, storedPayload: string | null = payload) {
    const created: any = {};
    const tx: any = {
      school: { create: jest.fn(async ({ data }: any) => ({ id: 's1', ...data })) },
      user: {
        create: jest.fn(async ({ data }: any) => {
          Object.assign(created, data);
          return { id: 'u9', ...data };
        }),
      },
    };
    const prisma: any = {
      user: { findUnique: jest.fn(async () => existingUser), update: jest.fn() },
      refreshToken: { create: jest.fn(async () => ({})) },
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    };
    const config: any = { get: (k: string) => (({ ALLOW_SIGNUP: 'true' }) as any)[k] };
    const otp = new OtpService(prisma, config, { sendEmail: jest.fn() } as any);
    jest.spyOn(otp, 'send').mockResolvedValue(undefined);
    jest.spyOn(otp, 'consume').mockResolvedValue(storedPayload);
    jest.spyOn(otp, 'pendingPayload').mockResolvedValue(storedPayload);
    const svc = new AuthService(prisma, { sign: () => 'jwt' } as any, config, otp);
    return { svc, prisma, otp, created, tx };
  }

  const dto = { schoolName: 'Acme School', firstName: 'Mina', lastName: 'Rao', email: 'N@Test.com', password: 'ignored-here' };

  it('register creates nothing and never stores the password', async () => {
    const { svc, prisma, otp } = buildSignup(null);
    await svc.register(dto);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    const sent = (otp.send as jest.Mock).mock.calls[0];
    expect(sent[0]).toBe('n@test.com');
    expect(sent[2]).not.toContain('ignored-here');
  });

  it('register rejects an email that already has an account', async () => {
    const { svc } = buildSignup({ id: 'u1' });
    await expect(svc.register(dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('a second submission cannot change the password of the account: password only comes from verify', async () => {
    const { svc, created } = buildSignup(null);
    await svc.register({ ...dto, password: 'attacker-pass-1' });
    await svc.verifyOtp('n@test.com', '123456', 'SIGNUP', 'victim-pass-99');
    expect(await bcrypt.compare('victim-pass-99', created.passwordHash)).toBe(true);
    expect(await bcrypt.compare('attacker-pass-1', created.passwordHash)).toBe(false);
  });

  it('verify creates a verified SUPER_ADMIN and returns tokens', async () => {
    const { svc, created } = buildSignup(null);
    const res: any = await svc.verifyOtp('n@test.com', '123456', 'SIGNUP', 'GoodPass123');
    expect(created).toMatchObject({ email: 'n@test.com', role: 'SUPER_ADMIN', emailVerified: true });
    expect(res.accessToken).toBe('jwt');
  });

  it('verify without a valid password fails before the code is burned', async () => {
    const { svc, otp } = buildSignup(null);
    await expect(svc.verifyOtp('n@test.com', '123456', 'SIGNUP', 'short')).rejects.toBeInstanceOf(BadRequestException);
    expect(otp.consume).not.toHaveBeenCalled();
  });

  it('verify fails if the code carries no pending sign-up details', async () => {
    const { svc } = buildSignup(null, null);
    await expect(svc.verifyOtp('n@test.com', '123456', 'SIGNUP', 'GoodPass123')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resend only works for a pending sign-up with no account', async () => {
    const a = buildSignup(null);
    await a.svc.sendOtp('n@test.com', 'SIGNUP');
    expect(a.otp.send).toHaveBeenCalledWith('n@test.com', 'SIGNUP', payload);
    const b = buildSignup({ id: 'u1', isActive: true });
    await b.svc.sendOtp('n@test.com', 'SIGNUP');
    expect(b.otp.send).not.toHaveBeenCalled();
    const c = buildSignup(null, null);
    await c.svc.sendOtp('n@test.com', 'SIGNUP');
    expect(c.otp.send).not.toHaveBeenCalled();
  });
});
