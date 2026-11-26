/**
 * Who may call which API, for every module at once. JwtStrategy applies this to each signed-in
 * request, before the controller's own @Roles (both have to allow it).
 *
 *  - Students and parents may use only the routes listed in FAMILY; everything else is refused.
 *  - Staff are limited per module in MODULES. A module that is not listed is admin-only.
 */
const ADMIN = ['SUPER_ADMIN', 'ADMIN', 'IT_ADMIN'];
const LEAD = [...ADMIN, 'DIRECTOR', 'PRINCIPAL'];
const ACAD = [...LEAD, 'ACADEMIC_COORDINATOR'];
const TEACH = [...ACAD, 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'FACULTY'];
const STAFF = [...TEACH, 'ACCOUNTANT', 'TRANSPORT_MANAGER', 'HOBBY_COORDINATOR'];
const FINANCE = [...LEAD, 'ACCOUNTANT'];
const TRANSPORT = [...LEAD, 'TRANSPORT_MANAGER'];
const FAMILY_ROLES = ['STUDENT', 'PARENT'];

type Rule = { read: string[]; write: string[] };
const rule = (read: string[], write: string[]): Rule => ({ read, write });

/** Key = first part of the route (the controller). */
const MODULES: Record<string, Rule> = {
  // the controller's own @Roles narrow these further
  auth: rule(STAFF, STAFF), users: rule(STAFF, STAFF), school: rule(STAFF, STAFF), platform: rule(ADMIN, ADMIN),
  classes: rule(STAFF, STAFF), sections: rule(STAFF, STAFF), subjects: rule(STAFF, STAFF), 'academic-sessions': rule(STAFF, STAFF),
  students: rule(STAFF, ACAD), settings: rule(ADMIN, ADMIN), notifications: rule(STAFF, STAFF), dashboard: rule(STAFF, STAFF),
  search: rule(STAFF, STAFF), audit: rule(LEAD, ADMIN),

  admission: rule(ACAD, ACAD), 'academic-transition': rule(ACAD, LEAD), promotions: rule(ACAD, ACAD),
  'transfer-certificates': rule(ACAD, ACAD), certificates: rule(TEACH, ACAD), 'id-cards': rule(STAFF, ACAD),
  documents: rule(TEACH, ACAD), alumni: rule(STAFF, ACAD), 'student-leaves': rule(TEACH, STAFF),

  attendance: rule(TEACH, TEACH), 'period-attendance': rule(TEACH, TEACH), 'activity-log': rule(TEACH, TEACH),
  syllabus: rule(STAFF, TEACH), timetable: rule(STAFF, ACAD), 'timetable-generator': rule(ACAD, ACAD),
  assignments: rule(STAFF, TEACH), assessments: rule(TEACH, TEACH), 'question-bank': rule(TEACH, TEACH),
  grading: rule(TEACH, TEACH), 'report-cards': rule(TEACH, TEACH), 'result-workflow': rule(TEACH, TEACH),
  remedial: rule(TEACH, TEACH), 'grace-marks': rule(TEACH, TEACH), 'exam-schedules': rule(STAFF, ACAD),
  rubrics: rule(TEACH, TEACH), teaching: rule(TEACH, TEACH), compliance: rule(TEACH, TEACH),
  analytics: rule(TEACH, TEACH), 'performance-report': rule(TEACH, TEACH), reports: rule([...TEACH, 'ACCOUNTANT'], ACAD),
  diary: rule(TEACH, TEACH), substitutes: rule(TEACH, ACAD),

  'lms-content': rule(STAFF, TEACH), 'course-modules': rule(STAFF, TEACH), 'learning-paths': rule(STAFF, TEACH),
  'live-classes': rule(STAFF, TEACH), discussions: rule(STAFF, STAFF), gamification: rule(STAFF, TEACH),
  files: rule(STAFF, TEACH),

  fees: rule([...FINANCE, 'ACADEMIC_COORDINATOR'], FINANCE), concessions: rule(FINANCE, FINANCE),
  'fee-automation': rule(FINANCE, FINANCE), payments: rule(FINANCE, FINANCE), expenses: rule(FINANCE, FINANCE),
  payroll: rule(FINANCE, FINANCE), 'transport-billing': rule([...TRANSPORT, 'ACCOUNTANT'], [...TRANSPORT, 'ACCOUNTANT']),

  'teacher-attendance': rule(TEACH, ACAD), 'staff-directory': rule(FINANCE, LEAD),

  announcements: rule(STAFF, TEACH), calendar: rule(STAFF, ACAD), events: rule(STAFF, ACAD),
  communication: rule(STAFF, STAFF), 'message-logs': rule(LEAD, LEAD), 'notification-triggers': rule(ACAD, ACAD),
  email: rule(ADMIN, ADMIN), feedback: rule(ACAD, STAFF), grievances: rule(ACAD, ACAD), surveys: rule(STAFF, ACAD),
  meetings: rule(STAFF, ACAD), gallery: rule(STAFF, ACAD),

  bus: rule(STAFF, TRANSPORT), hostel: rule(STAFF, LEAD), library: rule(STAFF, TEACH), hobby: rule(STAFF, [...ACAD, 'HOBBY_COORDINATOR']),
  health: rule(TEACH, TEACH), discipline: rule(TEACH, TEACH), inventory: rule(STAFF, FINANCE),
  visitors: rule(STAFF, STAFF), rooms: rule(STAFF, TEACH), 'room-booking': rule(STAFF, TEACH),
};

/** Things any member of staff does for themself, in modules they may not otherwise change. */
const STAFF_SELF: string[] = [
  'PATCH users/me', 'POST grievances', 'POST feedback', 'POST teacher-attendance/leave', 'GET teacher-attendance/leave',
  'POST events/:id/register', 'DELETE events/:id/register/:userId', 'POST surveys/:id/respond', 'PATCH substitutes/:id/accept',
  'GET surveys/:id', 'GET payroll/user/:userId', 'GET staff-directory/:userId', 'GET feedback/teacher/:teacherId',
  'PATCH notifications/read-all', 'PATCH notifications/:id/read', 'DELETE notifications/:id',
];
/** Of those, the ones that name a person: staff outside the module's read roles only get their own. */
export const SELF_ONLY: Record<string, { param: string; unless: string[] }> = {
  'GET payroll/user/:userId': { param: 'userId', unless: FINANCE },
  'GET staff-directory/:userId': { param: 'userId', unless: FINANCE },
  'GET feedback/teacher/:teacherId': { param: 'teacherId', unless: ACAD },
};

/** Everything a student or parent may call. Their own records only: see access-guard.ts. */
export const FAMILY: string[] = [
  'GET users/me', 'PATCH users/me', 'GET school/features', 'GET classes', 'GET sections', 'GET subjects', 'GET academic-sessions',
  'GET dashboard/student-stats',
  'GET notifications', 'GET notifications/unread-count', 'GET notifications/stats', 'PATCH notifications/read-all',
  'PATCH notifications/:id/read', 'DELETE notifications/:id',
  'GET announcements', 'GET announcements/active', 'GET announcements/:id',
  'GET calendar', 'GET calendar/upcoming', 'GET calendar/:id',
  'GET events', 'GET events/upcoming', 'GET events/:id', 'POST events/:id/register', 'DELETE events/:id/register/:userId',
  'GET timetable', 'GET timetable/:id', 'GET exam-schedules', 'GET exam-schedules/:id',
  'GET assignments', 'GET assignments/:id', 'POST assignments/:id/submit', 'POST assessments/:id/submit',
  'GET syllabus', 'GET syllabus/:id', 'GET lms-content', 'GET lms-content/:id', 'GET files/:fileName(*)',
  'GET discussions', 'GET discussions/:id', 'GET discussions/:id/posts', 'POST discussions/:id/posts', 'PATCH discussions/posts/:id/like',
  'GET course-modules', 'GET course-modules/:id', 'POST course-modules/items/:itemId/complete',
  'GET learning-paths', 'GET learning-paths/:id', 'POST learning-paths/:id/enroll', 'POST learning-paths/:id/advance',
  'GET live-classes', 'GET live-classes/upcoming', 'GET live-classes/recordings', 'GET live-classes/:id', 'POST live-classes/:id/attend',
  'GET gamification/badges', 'GET gamification/leaderboard/:classId', 'GET gamification/profile/:studentId',
  'GET gamification/badges/student/:studentId', 'GET learning-paths/student/:studentId', 'GET learning-paths/recommended/:studentId',
  'GET course-modules/progress/:studentId',
  'GET students/:id', 'GET attendance/student/:studentId/summary', 'GET grading/student/:studentId',
  'GET report-cards/student/:studentId', 'GET fees/payments/:studentId',
  'GET payments/dues', 'GET payments/history', 'GET payments/receipt/:id', 'GET payments/:id',
  'POST payments/create-order', 'POST payments/verify',
  'GET certificates', 'GET certificates/:id', 'GET certificates/:id/print',
  'GET feedback', 'POST feedback', 'GET grievances', 'GET grievances/:id', 'POST grievances',
  'GET diary', 'GET diary/student/:studentId', 'GET health/records/:studentId',
  'GET surveys/:id', 'POST surveys/:id/respond', 'POST student-leaves',
  'GET communication/ptm/slots', 'GET communication/ptm/bookings', 'POST communication/ptm/book',
  'PATCH communication/ptm/bookings/:id/cancel', 'GET communication/conversations', 'POST communication/conversations',
  'GET communication/conversations/:id/messages', 'POST communication/messages',
];
const PARENT_ONLY = ['GET parent-portal/overview', 'GET parent-portal/attendance', 'GET parent-portal/grades', 'GET parent-portal/fees', 'GET parent-portal/report-cards'];

/** "/api/v1/grievances/:id" -> "grievances/:id" */
export const routeKey = (routePath: string) => routePath.replace(/^\/api\/v1\/?/, '').replace(/\/+$/, '');

export function isFamily(role: string) {
  return FAMILY_ROLES.includes(role);
}

/** May this role call `METHOD route` at all? Which records it may touch is decided separately. */
export function mayCall(role: string, method: string, routePath: string): boolean {
  const route = routeKey(routePath);
  const call = `${method.toUpperCase()} ${route}`;
  const module = route.split('/')[0];
  if (module === 'auth') return true; // acts on the caller only
  if (isFamily(role)) return FAMILY.includes(call) || (role === 'PARENT' && PARENT_ONLY.includes(call));
  if (!STAFF.includes(role)) return false;
  if (STAFF_SELF.includes(call)) return true;
  const rules = MODULES[module] ?? rule(ADMIN, ADMIN);
  return (method.toUpperCase() === 'GET' ? rules.read : rules.write).includes(role);
}
