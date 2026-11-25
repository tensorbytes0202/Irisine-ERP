import { describe, expect, it } from 'vitest';
import { canItAdminOpen, itAdminItems } from './it-admin';

describe('IT Admin routes', () => {
  it.each(['/it-admin', '/it-admin/schools', '/it-admin/schools/new', '/it-admin/schools/abc', '/it-admin/school', '/users', '/students/abc', '/classes', '/settings', '/account'])(
    'opens %s',
    (p) => expect(canItAdminOpen(p, null, true)).toBe(true),
  );

  it.each(['/dashboard', '/fees', '/platform', '/platform-login', '/payroll', '/it-admin/anything', '/it-admin/modules', '/usersx'])('does not open %s', (p) =>
    expect(canItAdminOpen(p, null, true)).toBe(false),
  );

  it('shows the Schools section to the platform owner only', () => {
    for (const p of ['/it-admin/schools', '/it-admin/schools/new', '/it-admin/schools/abc']) {
      expect(canItAdminOpen(p, null, false)).toBe(false);
    }
    expect(itAdminItems(null).map((i) => i.href)).not.toContain('/it-admin/schools');
    expect(itAdminItems(null, true).map((i) => i.href)).toContain('/it-admin/schools');
    expect(canItAdminOpen('/it-admin/school', null, false)).toBe(true);
  });

  it('hides and blocks pages of modules the school was not granted', () => {
    const features = ['CORE'];
    expect(itAdminItems(features).map((i) => i.href)).not.toContain('/students');
    expect(canItAdminOpen('/students', features)).toBe(false);
    expect(canItAdminOpen('/it-admin/faculty', features)).toBe(false);
    expect(canItAdminOpen('/students', ['CORE', 'STUDENT_MANAGEMENT'])).toBe(true);
  });
});
