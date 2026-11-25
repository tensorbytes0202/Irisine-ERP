/**
 * Which platform feature (granted per school by the IT Admin) each web page belongs to.
 * Key = first part of the URL. Pages that are not listed (dashboard, users, settings, classes, ...)
 * are core and always available. This only hides menu items: the API refuses a disabled module on its own.
 */
const PAGE_FEATURE: Record<string, string> = {
  students: 'STUDENT_MANAGEMENT', promotions: 'STUDENT_MANAGEMENT', 'transfer-certificates': 'STUDENT_MANAGEMENT',
  certificates: 'STUDENT_MANAGEMENT', documents: 'STUDENT_MANAGEMENT', 'id-cards': 'STUDENT_MANAGEMENT',
  alumni: 'STUDENT_MANAGEMENT', 'academic-transition': 'STUDENT_MANAGEMENT', 'parent-portal': 'STUDENT_MANAGEMENT',
  admission: 'ADMISSION',
  'staff-directory': 'FACULTY_MANAGEMENT', 'teacher-attendance': 'FACULTY_MANAGEMENT', leaves: 'FACULTY_MANAGEMENT',
  substitutes: 'FACULTY_MANAGEMENT',
  attendance: 'ATTENDANCE', 'period-attendance': 'ATTENDANCE',
  syllabus: 'ACADEMICS', timetable: 'ACADEMICS', assignments: 'ACADEMICS', teaching: 'ACADEMICS', diary: 'ACADEMICS',
  'homework-calendar': 'ACADEMICS',
  'exam-schedule': 'EXAMINATION', assessments: 'EXAMINATION', 'question-bank': 'EXAMINATION', grading: 'EXAMINATION',
  'report-cards': 'EXAMINATION', 'result-workflow': 'EXAMINATION', 'grace-marks': 'EXAMINATION', remedial: 'EXAMINATION',
  rubrics: 'EXAMINATION', 'speed-grader': 'EXAMINATION', 'performance-report': 'EXAMINATION',
  lms: 'LMS', 'course-modules': 'LMS', 'live-classes': 'LMS', 'learning-paths': 'LMS', discussions: 'LMS', gamification: 'LMS',
  fees: 'FEES', 'my-fees': 'FEES', 'online-payments': 'FEES', concessions: 'FEES', 'fee-automation': 'FEES',
  expenses: 'EXPENSES_PAYROLL', payroll: 'EXPENSES_PAYROLL',
  reports: 'REPORTS', analytics: 'REPORTS', compliance: 'REPORTS', 'bulk-operations': 'REPORTS',
  communication: 'COMMUNICATION', announcements: 'COMMUNICATION', 'message-logs': 'COMMUNICATION', meetings: 'COMMUNICATION',
  surveys: 'COMMUNICATION', feedback: 'COMMUNICATION', grievances: 'COMMUNICATION',
  events: 'EVENTS_CALENDAR', calendar: 'EVENTS_CALENDAR', gallery: 'EVENTS_CALENDAR',
  library: 'LIBRARY',
  bus: 'TRANSPORT', 'transport-billing': 'TRANSPORT',
  hostel: 'HOSTEL',
  inventory: 'INVENTORY_CAMPUS', visitors: 'INVENTORY_CAMPUS', 'room-booking': 'INVENTORY_CAMPUS',
  health: 'HEALTH_DISCIPLINE', discipline: 'HEALTH_DISCIPLINE',
  hobbies: 'HOBBY_CLUBS',
};

/** `features` is the list from GET /school/features. `null` (not loaded) means do not hide anything. */
export function isFeatureAllowed(pathname: string, features: string[] | null): boolean {
  if (!features) return true;
  const key = PAGE_FEATURE[pathname.split('/')[1] || ''];
  return !key || features.includes(key);
}
