/**
 * The four portals are a navigation choice only. The backend maps the account's real role
 * (read from the database) to a portal and refuses a login that asks for a different one.
 * Existing fine-grained roles are kept so every @Roles(...) in the 80 modules keeps working.
 */
export type Portal = 'SUPER_ADMIN' | 'IT_ADMIN' | 'FACULTY' | 'STUDENT';

export const PORTAL_ROLES: Record<Portal, string[]> = {
  // A school's own administrators (a school-level IT_ADMIN account is one of them).
  SUPER_ADMIN: ['SUPER_ADMIN', 'ADMIN', 'IT_ADMIN'],
  // The platform owner who creates schools, sets limits and grants features. It signs in
  // through POST /platform-public/login (table platform_admins), never as a school user.
  IT_ADMIN: [],
  FACULTY: [
    'FACULTY', 'DIRECTOR', 'PRINCIPAL', 'ACADEMIC_COORDINATOR', 'CLASS_TEACHER', 'SUBJECT_TEACHER',
    'ACCOUNTANT', 'TRANSPORT_MANAGER', 'HOBBY_COORDINATOR',
  ],
  STUDENT: ['STUDENT', 'PARENT'],
};

export const PORTALS = Object.keys(PORTAL_ROLES) as Portal[];

export function portalForRole(role: string): Portal | null {
  return PORTALS.find((p) => PORTAL_ROLES[p].includes(role)) ?? null;
}
