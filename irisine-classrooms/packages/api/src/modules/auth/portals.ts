/**
 * The four portals are a navigation choice only. The backend maps the account's real role
 * (read from the database) to a portal and refuses a login that asks for a different one.
 * Existing fine-grained roles are kept so every @Roles(...) in the 80 modules keeps working.
 */
export type Portal = 'SUPER_ADMIN' | 'IT_ADMIN' | 'FACULTY' | 'STUDENT';

export const PORTAL_ROLES: Record<Portal, string[]> = {
  SUPER_ADMIN: ['SUPER_ADMIN', 'ADMIN'],
  // A school's IT administrator. The one listed in PLATFORM_OWNER_EMAILS also owns the platform.
  // The role can only be given directly in the database, never through the API.
  IT_ADMIN: ['IT_ADMIN'],
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
