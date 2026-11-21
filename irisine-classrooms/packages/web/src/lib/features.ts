/**
 * FEATURE FLAGS: har feature ke liye ON (true) ya OFF (false).
 *
 * - false  => sidebar mein nahi dikhega, aur URL seedha kholne par /dashboard pe bhej diya jayega.
 * - Code delete nahi hota. Wapas ON karna hai to bas false ko true kar do aur app dobara load karo.
 *
 * Key = URL ka pehla hissa. Jaise /hostel ka key 'hostel' hai.
 */
export const FEATURES: Record<string, boolean> = {
  // ───────── Home ─────────
  dashboard: true,
  announcements: true,
  calendar: true,
  notifications: true,
  events: true,
  'homework-calendar': false,

  // ───────── Students ─────────
  students: true,
  admission: true,
  attendance: true,
  'period-attendance': false,
  classes: true,
  promotions: true,
  documents: false,
  'transfer-certificates': false,
  certificates: false,
  discipline: false,
  health: false,
  'academic-transition': false,

  // ───────── Academics ─────────
  syllabus: true,
  timetable: true,
  assignments: true,
  assessments: true,
  'question-bank': false,
  'exam-schedule': true,
  grading: true,
  'report-cards': true,
  'result-workflow': false,
  remedial: false,
  'grace-marks': false,
  'performance-report': false,
  analytics: false,
  substitutes: false,
  rubrics: false,
  'speed-grader': false,
  teaching: false,

  // ───────── Learning / LMS ─────────
  lms: true,
  'file-browser': false,
  'course-modules': true,
  'live-classes': true,
  'learning-paths': true,
  discussions: true,
  gamification: false,

  // ───────── Finance ─────────
  fees: true,
  concessions: true,
  expenses: true,
  'fee-automation': false,
  payroll: false,
  'transport-billing': false,

  // ───────── Staff ─────────
  users: true,
  'staff-directory': true,
  'teacher-attendance': true,
  leaves: true,

  // ───────── Communication ─────────
  communication: true,
  diary: true,
  feedback: true,
  'message-logs': false,
  surveys: false,
  meetings: false,
  grievances: false,

  // ───────── Campus (hidden for a simple "classroom" product) ─────────
  hostel: false,
  bus: false,
  hobbies: false,
  library: false,
  inventory: false,
  visitors: false,
  'room-booking': false,
  'id-cards': false,
  alumni: false,
  gallery: false,

  // ───────── Admin ─────────
  settings: true,
  audit: true,
  reports: false,
  'bulk-operations': false,
  compliance: false,
};

/** URL (jaise "/hostel/123") ke liye check: kya ye feature ON hai? Jo key list mein nahi, wo ON maana jata hai. */
export function isPathEnabled(pathname: string): boolean {
  const key = pathname.split('/')[1] || '';
  return FEATURES[key] !== false;
}
