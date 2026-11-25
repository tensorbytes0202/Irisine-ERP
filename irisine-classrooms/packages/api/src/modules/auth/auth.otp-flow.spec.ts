import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';

function build(user: any | null, schoolStatus: string | null = 'ACTIVE') {
  const prisma: any = {
    user: {
      findUnique: jest.fn(async () => user),
      update: jest.fn(async ({ data }: any) => ({ ...user, ...data })),
    },
    school: { findUnique: jest.fn(async () => (schoolStatus ? { status: schoolStatus } : null)) },
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


describe('login: portal and school status are checked on the server', () => {
  async function loginWith(role: string, schoolStatus = 'ACTIVE') {
    const passwordHash = await bcrypt.hash('Passw0rd!', 4);
    const user = { id: 'u', email: 'x@test.com', passwordHash, isActive: true, role, schoolId: 's' };
    return build(user as any, schoolStatus);
  }

  it('lets a teacher into the FACULTY portal and reports the portal', async () => {
    const { svc } = await loginWith('CLASS_TEACHER');
    const res: any = await svc.login({ email: 'x@test.com', password: 'Passw0rd!', portal: 'FACULTY' });
    expect(res.user.portal).toBe('FACULTY');
  });

  it('refuses a student who asks for the IT_ADMIN portal', async () => {
    const { svc } = await loginWith('STUDENT');
    await expect(svc.login({ email: 'x@test.com', password: 'Passw0rd!', portal: 'IT_ADMIN' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a faculty member who asks for the SUPER_ADMIN portal', async () => {
    const { svc } = await loginWith('SUBJECT_TEACHER');
    await expect(svc.login({ email: 'x@test.com', password: 'Passw0rd!', portal: 'SUPER_ADMIN' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a school IT Admin into the IT_ADMIN portal', async () => {
    const { svc } = await loginWith('IT_ADMIN');
    const res: any = await svc.login({ email: 'x@test.com', password: 'Passw0rd!', portal: 'IT_ADMIN' });
    expect(res.user).toMatchObject({ role: 'IT_ADMIN', portal: 'IT_ADMIN', schoolId: 's' });
  });

  it('refuses an account whose school does not exist', async () => {
    const passwordHash = await bcrypt.hash('Passw0rd!', 4);
    const { svc } = build({ id: 'u', email: 'x@test.com', passwordHash, isActive: true, role: 'IT_ADMIN', schoolId: 'gone' }, null);
    await expect(svc.login({ email: 'x@test.com', password: 'Passw0rd!' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks everyone in a suspended school (after the password is checked)', async () => {
    const { svc } = await loginWith('SUPER_ADMIN', 'SUSPENDED');
    await expect(svc.login({ email: 'x@test.com', password: 'Passw0rd!' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.login({ email: 'x@test.com', password: 'wrong-password' })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('accept invite (first password for an approved school admin)', () => {
  function buildInvite(invite: any) {
    const prisma: any = {
      accountInvite: {
        findUnique: jest.fn(async () => invite),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      user: { update: jest.fn(async ({ data }: any) => ({ id: 'u1', email: 'a@test.com', role: 'SUPER_ADMIN', schoolId: 's', ...data })) },
      refreshToken: { deleteMany: jest.fn(async () => ({})), create: jest.fn(async () => ({})) },
    };
    const config: any = { get: () => undefined };
    const otp = new OtpService(prisma, config, { sendEmail: jest.fn() } as any);
    return { svc: new AuthService(prisma, { sign: () => 'jwt' } as any, config, otp), prisma };
  }
  const token = 'a'.repeat(64);

  it('sets the password and returns tokens for a valid invite', async () => {
    const { svc, prisma } = buildInvite({ id: 'i1', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() + 60_000) });
    const res: any = await svc.acceptInvite(token, 'MyNewPass123');
    expect(await bcrypt.compare('MyNewPass123', prisma.user.update.mock.calls[0][0].data.passwordHash)).toBe(true);
    expect(res.accessToken).toBe('jwt');
  });

  it.each([
    ['unknown', null],
    ['used', { id: 'i1', userId: 'u1', usedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) }],
    ['expired', { id: 'i1', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() - 1000) }],
  ])('rejects an %s invite', async (_n, invite) => {
    const { svc, prisma } = buildInvite(invite);
    await expect(svc.acceptInvite(token, 'MyNewPass123')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
