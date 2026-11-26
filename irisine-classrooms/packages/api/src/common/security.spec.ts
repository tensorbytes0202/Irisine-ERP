import { assertProductionConfig, securityHeaders } from './security';

const good = { NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), CORS_ORIGIN: 'https://school.example.com', S3_SECRET_KEY: 'a-real-secret' };

describe('production config check', () => {
  it('accepts a sound production config', () => expect(() => assertProductionConfig(good)).not.toThrow());
  it('always requires a JWT secret', () => expect(() => assertProductionConfig({})).toThrow('JWT_SECRET is required'));
  it('rejects a short or guessable JWT secret', () => {
    expect(() => assertProductionConfig({ ...good, JWT_SECRET: 'secret' })).toThrow(/32 characters/);
    expect(() => assertProductionConfig({ ...good, JWT_SECRET: 'changeme' })).toThrow(/32 characters/);
  });
  it('rejects localhost / wildcard CORS, default MinIO key and open signup', () => {
    expect(() => assertProductionConfig({ ...good, CORS_ORIGIN: 'http://localhost:3000' })).toThrow(/CORS_ORIGIN/);
    expect(() => assertProductionConfig({ ...good, CORS_ORIGIN: '*' })).toThrow(/CORS_ORIGIN/);
    expect(() => assertProductionConfig({ ...good, S3_SECRET_KEY: undefined })).toThrow(/S3_SECRET_KEY/);
    expect(() => assertProductionConfig({ ...good, ALLOW_SIGNUP: 'true' })).toThrow(/ALLOW_SIGNUP/);
  });
  it('lets development run with just a JWT secret', () => {
    expect(() => assertProductionConfig({ NODE_ENV: 'development', JWT_SECRET: 'dev' })).not.toThrow();
  });
});

describe('security headers', () => {
  it('sets the hardening headers and drops X-Powered-By', () => {
    const set: Record<string, string> = {};
    const removed: string[] = [];
    const next = jest.fn();
    securityHeaders({}, { setHeader: (k: string, v: string) => (set[k] = v), removeHeader: (k: string) => removed.push(k) }, next);
    expect(set['X-Content-Type-Options']).toBe('nosniff');
    expect(set['X-Frame-Options']).toBe('DENY');
    expect(removed).toContain('X-Powered-By');
    expect(next).toHaveBeenCalled();
  });
});
