import { BadRequestException } from '@nestjs/common';
import { OtpService } from './otp.service';

function build(env: Record<string, string> = {}) {
  const rows: any[] = [];
  let seq = 0;
  const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => (v === null ? r[k] == null : r[k] === v));

  const prisma: any = {
    emailOtp: {
      findFirst: jest.fn(
        async ({ where }: any) =>
          rows.filter((r) => match(r, where)).sort((a, b) => b.createdAt - a.createdAt || b.seq - a.seq)[0] ?? null,
      ),
      create: jest.fn(async ({ data }: any) => {
        const r = { id: 'r' + ++seq, seq, attempts: 0, usedAt: null, createdAt: new Date(), ...data };
        rows.push(r);
        return r;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const r = rows.find((x) => x.id === where.id);
        if (data.attempts?.increment) r.attempts += data.attempts.increment;
        return r;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const hit = rows.filter((r) => match(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      }),
    },
  };
  const config: any = { get: (k: string) => (({ JWT_SECRET: 'jwt-secret', ...env }) as any)[k] };
  const email = { sendEmail: jest.fn(async () => undefined) };
  const svc = new OtpService(prisma, config, email as any);
  const lastCode = () => {
    const html: string = (email.sendEmail.mock.calls[email.sendEmail.mock.calls.length - 1] as any)[2];
    return /letter-spacing:10px[^>]*>(\d{6})</.exec(html)![1];
  };
  return { svc, rows, email, lastCode };
}

describe('OTP generation', () => {
  it('makes 6-digit numeric codes and stores only a hash', async () => {
    const { svc, rows, lastCode } = build();
    expect(svc.generateCode()).toMatch(/^\d{6}$/);
    await svc.send('A@Test.com', 'SIGNUP');
    const code = lastCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(JSON.stringify(rows)).not.toContain(code);
    expect(rows[0].codeHash).toHaveLength(64);
    expect(rows[0].email).toBe('a@test.com');
  });

  it('expires after OTP_EXPIRY_MINUTES (default 5)', async () => {
    const { svc, rows } = build();
    await svc.send('a@test.com', 'SIGNUP');
    const ms = rows[0].expiresAt.getTime() - Date.now();
    expect(ms).toBeGreaterThan(4.9 * 60_000);
    expect(ms).toBeLessThanOrEqual(5 * 60_000);
  });
});

describe('OTP verification', () => {
  it('accepts the right code once, then rejects reuse (duplicate verification)', async () => {
    const { svc, lastCode } = build();
    await svc.send('a@test.com', 'SIGNUP');
    const code = lastCode();
    await expect(svc.consume('a@test.com', 'SIGNUP', code)).resolves.toBeUndefined();
    await expect(svc.consume('a@test.com', 'SIGNUP', code)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an incorrect code', async () => {
    const { svc, lastCode } = build();
    await svc.send('a@test.com', 'SIGNUP');
    const wrong = lastCode() === '000000' ? '111111' : '000000';
    await expect(svc.consume('a@test.com', 'SIGNUP', wrong)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an expired code', async () => {
    const { svc, rows, lastCode } = build();
    await svc.send('a@test.com', 'SIGNUP');
    const code = lastCode();
    rows[0].expiresAt = new Date(Date.now() - 1000);
    await expect(svc.consume('a@test.com', 'SIGNUP', code)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('locks the code after the maximum attempts, even for the right code', async () => {
    const { svc, lastCode } = build();
    await svc.send('a@test.com', 'SIGNUP');
    const code = lastCode();
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await expect(svc.consume('a@test.com', 'SIGNUP', wrong)).rejects.toBeInstanceOf(BadRequestException);
    }
    await expect(svc.consume('a@test.com', 'SIGNUP', code)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a new code invalidates the previous one', async () => {
    const { svc, rows, lastCode } = build({ OTP_RESEND_COOLDOWN_SECONDS: '0' });
    await svc.send('a@test.com', 'SIGNUP');
    await svc.send('a@test.com', 'SIGNUP');
    const second = lastCode();
    expect(rows.filter((r) => !r.usedAt)).toHaveLength(1);
    await expect(svc.consume('a@test.com', 'SIGNUP', second)).resolves.toBeUndefined();
  });

  it('keeps purposes separate', async () => {
    const { svc, lastCode } = build();
    await svc.send('a@test.com', 'SIGNUP');
    await expect(svc.consume('a@test.com', 'RESET', lastCode())).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('resend cooldown', () => {
  it('blocks a second code inside 60 seconds with HTTP 429', async () => {
    const { svc, email } = build();
    await svc.send('a@test.com', 'SIGNUP');
    await expect(svc.send('a@test.com', 'SIGNUP')).rejects.toMatchObject({ status: 429 });
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('allows a new code after the cooldown', async () => {
    const { svc, rows } = build();
    await svc.send('a@test.com', 'SIGNUP');
    rows[0].createdAt = new Date(Date.now() - 61_000);
    await expect(svc.send('a@test.com', 'SIGNUP')).resolves.toBeUndefined();
  });
});

describe('password reset token', () => {
  it('is single use', async () => {
    const { svc } = build();
    const token = await svc.issueResetToken('a@test.com');
    await expect(svc.consume('a@test.com', 'RESET_TOKEN', token)).resolves.toBeUndefined();
    await expect(svc.consume('a@test.com', 'RESET_TOKEN', token)).rejects.toBeInstanceOf(BadRequestException);
  });
});
