/** Production safety checks and response headers, kept out of main.ts so they can be tested. */

const WEAK = /^(changeme|secret|password|jwt[-_]?secret|your[-_].*|replace.*|dev.*|test.*)$/i;

/** Refuse to boot a production server with missing or guessable secrets. */
export function assertProductionConfig(env: Record<string, string | undefined>): void {
  if (!env.JWT_SECRET) throw new Error('JWT_SECRET is required');
  if (env.NODE_ENV !== 'production') return;

  const problems: string[] = [];
  if (env.JWT_SECRET.length < 32 || WEAK.test(env.JWT_SECRET)) problems.push('JWT_SECRET must be a random value of at least 32 characters');
  if (!env.CORS_ORIGIN || /localhost|\*/.test(env.CORS_ORIGIN)) problems.push('CORS_ORIGIN must list the real site origin(s), not localhost or *');
  if ((env.S3_SECRET_KEY ?? 'minioadmin') === 'minioadmin') problems.push('S3_SECRET_KEY still has the MinIO default');
  if (env.ALLOW_SIGNUP === 'true') problems.push('ALLOW_SIGNUP must not be "true" in production');
  if (problems.length) throw new Error(`Unsafe production configuration:\n - ${problems.join('\n - ')}`);
}

/** The usual hardening headers (what helmet sets), without another dependency. */
export function securityHeaders(_req: any, res: any, next: () => void): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  res.removeHeader('X-Powered-By');
  next();
}
