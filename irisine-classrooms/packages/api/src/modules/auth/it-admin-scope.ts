/**
 * What a school's IT_ADMIN may reach. It is an allow list, so any other module (fees, payroll,
 * attendance, ...) is closed to this role even if its controller forgets a role or school check.
 * Every area listed here is scoped to the caller's own school.
 *
 * To give the IT Admin another module: make that module school scoped first, then add its
 * controller prefix here and a menu entry in the web dashboard.
 */
export const IT_ADMIN_AREAS = [
  'auth', 'users', 'students', 'classes', 'sections', 'subjects', 'academic-sessions', 'settings', 'school',
];

/** `routePath` is the matched route, e.g. "/api/v1/users/:id". Anything unknown is refused. */
export function isItAdminRoute(routePath: string): boolean {
  const area = routePath.toLowerCase().replace(/^\/+/, '').replace(/^api\/v1\//, '').split(/[/?]/)[0];
  return IT_ADMIN_AREAS.includes(area);
}
