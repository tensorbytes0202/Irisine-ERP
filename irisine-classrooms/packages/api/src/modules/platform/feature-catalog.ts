/**
 * Default catalogue of ERP modules. On startup these are upserted into the `features`
 * table, which is the real source of truth: the platform owner decides per school which
 * of them are granted (table `school_features`). Nothing here says which school gets what.
 *
 * `routes` are the API controller prefixes a feature protects (see FeatureGuard).
 * Core features are never gated.
 */
export interface FeatureDef {
  key: string;
  name: string;
  category: string;
  routes: string[];
  isCore?: boolean;
}

export const FEATURE_CATALOG: FeatureDef[] = [
  // Always available to every school (login, profile, settings, search...)
  { key: 'CORE', name: 'Core (users, dashboard, settings)', category: 'CORE', isCore: true,
    routes: ['auth', 'users', 'dashboard', 'settings', 'audit', 'activity-log', 'search', 'notifications', 'files', 'email', 'school'] },

  { key: 'STUDENT_MANAGEMENT', name: 'Student Management', category: 'STUDENTS',
    routes: ['students', 'student-leaves', 'promotions', 'academic-transition', 'transfer-certificates', 'certificates', 'documents', 'id-cards', 'alumni', 'parent-portal'] },
  { key: 'ADMISSION', name: 'Admissions', category: 'STUDENTS', routes: ['admission'] },
  { key: 'FACULTY_MANAGEMENT', name: 'Faculty Management', category: 'STAFF',
    routes: ['staff-directory', 'teacher-attendance', 'substitutes'] },
  { key: 'ATTENDANCE', name: 'Attendance', category: 'STUDENTS', routes: ['attendance', 'period-attendance'] },
  { key: 'ACADEMICS', name: 'Academics (syllabus, timetable, homework)', category: 'ACADEMICS',
    routes: ['syllabus', 'timetable', 'timetable-generator', 'assignments', 'teaching', 'diary'] },
  { key: 'EXAMINATION', name: 'Examination and Results', category: 'ACADEMICS',
    routes: ['exam-schedules', 'assessments', 'question-bank', 'grading', 'report-cards', 'result-workflow', 'grace-marks', 'remedial', 'rubrics', 'performance-report'] },
  { key: 'LMS', name: 'Learning Management (LMS)', category: 'ACADEMICS',
    routes: ['lms-content', 'course-modules', 'live-classes', 'learning-paths', 'discussions', 'gamification'] },
  { key: 'FEES', name: 'Fees Management', category: 'FINANCE',
    routes: ['fees', 'payments', 'concessions', 'fee-automation'] },
  { key: 'EXPENSES_PAYROLL', name: 'Expenses and Payroll', category: 'FINANCE', routes: ['expenses', 'payroll'] },
  { key: 'REPORTS', name: 'Reports and Analytics', category: 'ADMIN', routes: ['reports', 'analytics', 'compliance', 'bulk'] },
  { key: 'COMMUNICATION', name: 'Communication', category: 'COMMUNICATION',
    routes: ['communication', 'announcements', 'notification-triggers', 'message-logs', 'meetings', 'surveys', 'feedback', 'grievances'] },
  { key: 'EVENTS_CALENDAR', name: 'Events, Calendar and Gallery', category: 'COMMUNICATION', routes: ['events', 'calendar', 'gallery'] },
  { key: 'LIBRARY', name: 'Library Management', category: 'CAMPUS', routes: ['library'] },
  { key: 'TRANSPORT', name: 'Transport Management', category: 'CAMPUS', routes: ['bus', 'transport-billing'] },
  { key: 'HOSTEL', name: 'Hostel Management', category: 'CAMPUS', routes: ['hostel'] },
  { key: 'INVENTORY_CAMPUS', name: 'Inventory, Visitors and Rooms', category: 'CAMPUS', routes: ['inventory', 'visitors', 'rooms'] },
  { key: 'HEALTH_DISCIPLINE', name: 'Health and Discipline', category: 'STUDENTS', routes: ['health', 'discipline'] },
  { key: 'HOBBY_CLUBS', name: 'Hobby and Clubs', category: 'ACADEMICS', routes: ['hobby'] },
];

/** controller prefix -> feature key (built once). */
export const ROUTE_TO_FEATURE: Record<string, string> = Object.fromEntries(
  FEATURE_CATALOG.flatMap((f) => f.routes.map((r) => [r, f.key])),
);

export const FEATURE_KEYS = FEATURE_CATALOG.map((f) => f.key);
