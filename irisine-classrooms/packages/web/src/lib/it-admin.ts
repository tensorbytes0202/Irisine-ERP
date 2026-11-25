/**
 * The IT Admin's menu: administration of its own school, plus all schools for the platform owner. The API enforces the same boundary (auth/it-admin-scope.ts):
 * this only decides what is shown. `feature` = the module the platform owner must have granted.
 */
export interface ItAdminItem {
  name: string;
  href: string;
  feature?: string;
  ownerOnly?: boolean;
}

export const IT_ADMIN_HOME = '/it-admin';

export const IT_ADMIN_NAV: ItAdminItem[] = [
  { name: 'Overview', href: IT_ADMIN_HOME },
  { name: 'Schools', href: '/it-admin/schools', ownerOnly: true },
  { name: 'User Management', href: '/users' },
  { name: 'Faculty Management', href: '/it-admin/faculty', feature: 'FACULTY_MANAGEMENT' },
  { name: 'Student Management', href: '/students', feature: 'STUDENT_MANAGEMENT' },
  { name: 'School Configuration', href: '/it-admin/school' },
  { name: 'Classes & Sections', href: '/classes' },
  { name: 'System Settings', href: '/settings' },
  { name: 'My Account', href: '/account' },
];

const within = (pathname: string, href: string) =>
  pathname === href || (href !== IT_ADMIN_HOME && pathname.startsWith(href + '/'));

/** `features` null means "not loaded": nothing is hidden for modules yet. */
export function itAdminItems(features: string[] | null, isOwner = false): ItAdminItem[] {
  return IT_ADMIN_NAV.filter(
    (i) => (!i.ownerOnly || isOwner) && (!i.feature || !features || features.includes(i.feature)),
  );
}

export function canItAdminOpen(pathname: string, features: string[] | null, isOwner = false): boolean {
  // "/it-admin/schools" and "/it-admin/school" are different pages: `within` matches whole segments
  return itAdminItems(features, isOwner).some((i) => within(pathname, i.href));
}
