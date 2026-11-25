import { isItAdminRoute } from './it-admin-scope';

describe('isItAdminRoute', () => {
  it.each(['/api/v1/users/me', '/api/v1/students/:id', '/api/v1/classes', '/api/v1/school/features/:key', '/API/V1/Users', '/users', '/api/v1/platform/schools/:id'])(
    'allows %s',
    (p) => expect(isItAdminRoute(p)).toBe(true),
  );

  it.each(['/api/v1/fees/heads', '/api/v1/platform-public/login', '/api/v1/payroll', '/api/v1/audit/logs', '/api/v1/school-data', '/api/v1/usersx', '/', ''])(
    'refuses %s',
    (p) => expect(isItAdminRoute(p)).toBe(false),
  );
});
