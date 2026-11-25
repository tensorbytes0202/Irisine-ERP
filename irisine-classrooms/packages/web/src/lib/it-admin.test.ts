import { describe, expect, it } from 'vitest';
import { canItAdminOpen, itAdminItems } from './it-admin';

describe('IT Admin routes', () => {
  it.each(['/it-admin', '/it-admin/school', '/it-admin/modules', '/users', '/students/abc', '/classes', '/settings', '/account'])(
    'opens %s',
    (p) => expect(canItAdminOpen(p, null)).toBe(true),
  );

  it.each(['/dashboard', '/fees', '/platform', '/payroll', '/it-admin/anything', '/usersx'])('does not open %s', (p) =>
    expect(canItAdminOpen(p, null)).toBe(false),
  );

  it('hides and blocks pages of modules the school was not granted', () => {
    const features = ['CORE'];
    expect(itAdminItems(features).map((i) => i.href)).not.toContain('/students');
    expect(canItAdminOpen('/students', features)).toBe(false);
    expect(canItAdminOpen('/it-admin/faculty', features)).toBe(false);
    expect(canItAdminOpen('/students', ['CORE', 'STUDENT_MANAGEMENT'])).toBe(true);
  });
});
