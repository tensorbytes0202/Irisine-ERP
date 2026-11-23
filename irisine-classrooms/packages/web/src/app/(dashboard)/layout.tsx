'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  UserPlus,
  BookOpen,
  CalendarDays,
  Calendar,
  ClipboardCheck,
  FileText,
  ShieldCheck,
  PenTool,
  HelpCircle,
  Award,
  BarChart3,
  LogOut,
  CreditCard,
  Shield,
  Bus,
  Palette,
  MessageSquare,
  Bell,
  UserCheck,
  FileEdit,
  FolderOpen,
  CalendarOff,
  ScrollText,
  Upload,
  Zap,
  Printer,
  UserCog,
  Settings2,
  ArrowUpCircle,
  Percent,
  Megaphone,
  Clock,
  Search,
  GitBranch,
  RefreshCw,
  FileOutput,
  BookMarked,
  DoorOpen,
  MessageCircle,
  Medal,
  Heart,
  Package,
  Receipt,
  DoorClosed,
  Users2,
  Building,
  Wallet,
  AlertOctagon,
  BadgeCheck,
  Mail,
  NotebookPen,
  PartyPopper,
  Contact,
  Image,
  CalendarCheck,
  ClipboardList,
  LayoutGrid,
  FileBarChart,
  ArrowRightLeft,
  Route,
  TableProperties,
  Video,
  Layers,
  MessagesSquare,
  Trophy,
  HardDrive,
  Target,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { brand } from '@/lib/brand';
import { isPathEnabled } from '@/lib/features';

const allNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Students', href: '/students', icon: GraduationCap },
  { name: 'Admission', href: '/admission', icon: UserPlus },
  { name: 'Attendance', href: '/attendance', icon: ClipboardCheck },
  { name: 'Period Attendance', href: '/period-attendance', icon: Clock },
  { name: 'Syllabus', href: '/syllabus', icon: BookOpen },
  { name: 'Timetable', href: '/timetable', icon: CalendarDays },
  // Phase 2
  { name: 'LMS Content', href: '/lms', icon: FileText },
  { name: 'File Manager', href: '/file-browser', icon: HardDrive },
  { name: 'Compliance', href: '/compliance', icon: ShieldCheck },
  { name: 'Assessments', href: '/assessments', icon: PenTool },
  { name: 'Assignments', href: '/assignments', icon: FileEdit },
  { name: 'Question Bank', href: '/question-bank', icon: HelpCircle },
  { name: 'Grading', href: '/grading', icon: Award },
  { name: 'Report Cards', href: '/report-cards', icon: FileText },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Users', href: '/users', icon: Users },
  // Phase 3
  { name: 'Fee Management', href: '/fees', icon: CreditCard },
  { name: 'Discipline', href: '/discipline', icon: Shield },
  { name: 'Bus Tracking', href: '/bus', icon: Bus },
  // Phase 4
  { name: 'Hobbies', href: '/hobbies', icon: Palette },
  { name: 'Communication', href: '/communication', icon: MessageSquare },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  // Phase 5
  { name: 'Teacher Attendance', href: '/teacher-attendance', icon: UserCheck },
  // Phase 6
  { name: 'Exam Schedule', href: '/exam-schedule', icon: Calendar },
  // Phase 7
  { name: 'Documents', href: '/documents', icon: FolderOpen },
  { name: 'Leave Requests', href: '/leaves', icon: CalendarOff },
  // Phase 8
  { name: 'Bulk Operations', href: '/bulk-operations', icon: Upload },
  { name: 'Fee Automation', href: '/fee-automation', icon: Zap },
  { name: 'Reports', href: '/reports', icon: Printer },
  // Phase 9
  { name: 'Substitutes', href: '/substitutes', icon: UserCog },
  { name: 'Calendar', href: '/calendar', icon: CalendarDays },
  { name: 'Settings', href: '/settings', icon: Settings2 },
  { name: 'Promotions', href: '/promotions', icon: ArrowUpCircle },
  { name: 'Concessions', href: '/concessions', icon: Percent },
  { name: 'Announcements', href: '/announcements', icon: Megaphone },
  // Phase 10 — Grading workflow
  { name: 'Result Workflow', href: '/result-workflow', icon: GitBranch },
  { name: 'Remedial', href: '/remedial', icon: RefreshCw },
  { name: 'Grace Marks', href: '/grace-marks', icon: Award },
  // Phase 11
  { name: 'Transfer Certificates', href: '/transfer-certificates', icon: FileOutput },
  { name: 'Library', href: '/library', icon: BookMarked },
  { name: 'Visitors', href: '/visitors', icon: DoorOpen },
  // Phase 12
  { name: 'Health Records', href: '/health', icon: Heart },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Transport Billing', href: '/transport-billing', icon: Receipt },
  // Phase 13
  { name: 'Feedback', href: '/feedback', icon: MessageCircle },
  { name: 'Certificates', href: '/certificates', icon: Medal },
  // Phase 14
  { name: 'Room Booking', href: '/room-booking', icon: DoorClosed },
  { name: 'Meetings', href: '/meetings', icon: Users2 },
  // Phase 15
  { name: 'Hostel', href: '/hostel', icon: Building },
  { name: 'Payroll', href: '/payroll', icon: Wallet },
  { name: 'Grievances', href: '/grievances', icon: AlertOctagon },
  // Phase 16
  { name: 'ID Cards', href: '/id-cards', icon: BadgeCheck },
  { name: 'Message Logs', href: '/message-logs', icon: Mail },
  // Phase 17
  { name: 'Diary', href: '/diary', icon: NotebookPen },
  { name: 'Events', href: '/events', icon: PartyPopper },
  // Phase 18
  { name: 'Expenses', href: '/expenses', icon: Receipt },
  { name: 'Alumni', href: '/alumni', icon: GraduationCap },
  { name: 'Homework Calendar', href: '/homework-calendar', icon: CalendarCheck },
  // Phase 19
  { name: 'Staff Directory', href: '/staff-directory', icon: Contact },
  { name: 'Gallery', href: '/gallery', icon: Image },
  // Phase 20
  { name: 'Surveys', href: '/surveys', icon: ClipboardList },
  // Phase 21
  { name: 'Classes & Sections', href: '/classes', icon: LayoutGrid },
  { name: 'Performance Report', href: '/performance-report', icon: FileBarChart },
  { name: 'Year Transition', href: '/academic-transition', icon: ArrowRightLeft },
  // Phase 22 — LMS Deep Features
  { name: 'Learning Paths', href: '/learning-paths', icon: Route },
  { name: 'Rubrics', href: '/rubrics', icon: TableProperties },
  { name: 'Speed Grader', href: '/speed-grader', icon: Zap },
  { name: 'Live Classes', href: '/live-classes', icon: Video },
  // Phase 23 — Deep LMS
  { name: 'Course Modules', href: '/course-modules', icon: Layers },
  { name: 'Discussions', href: '/discussions', icon: MessagesSquare },
  { name: 'Gamification', href: '/gamification', icon: Trophy },
  // Phase 24 — Teaching Tracking
  { name: 'Teaching Tracker', href: '/teaching', icon: Target },
  // Audit
  { name: 'Audit Logs', href: '/audit', icon: ScrollText },
];

// Map each role to the nav item names it may access.
// SUPER_ADMIN and IT_ADMIN see everything (handled below).
const roleNavMap: Record<string, string[]> = {
  DIRECTOR: [
    'Dashboard', 'Analytics', 'Report Cards', 'Compliance', 'Fee Management',
    'Discipline', 'Users', 'Reports', 'Calendar', 'Promotions', 'Concessions', 'Announcements',
    'Result Workflow', 'Grace Marks', 'Transfer Certificates', 'Library', 'Visitors',
    'Feedback', 'Certificates', 'Hostel', 'Payroll', 'Grievances', 'Events',
    'Expenses', 'Alumni', 'Staff Directory', 'Gallery', 'Surveys',
    'Classes & Sections', 'Performance Report',
    'Learning Paths', 'Rubrics', 'Live Classes',
    'Course Modules', 'Discussions', 'Gamification',
    'Teaching Tracker',
  ],
  ACADEMIC_COORDINATOR: [
    'Dashboard', 'Students', 'Syllabus', 'Compliance', 'Assessments',
    'Assignments', 'Question Bank', 'Grading', 'Report Cards', 'Analytics',
    'LMS Content', 'File Manager', 'Exam Schedule', 'Reports', 'Substitutes', 'Calendar',
    'Promotions', 'Announcements', 'Result Workflow', 'Remedial', 'Grace Marks',
    'Transfer Certificates', 'Library', 'Feedback', 'Certificates', 'Grievances',
    'Diary', 'Events', 'Classes & Sections', 'Performance Report',
    'Learning Paths', 'Rubrics', 'Speed Grader', 'Live Classes',
    'Course Modules', 'Discussions', 'Gamification',
    'Teaching Tracker',
  ],
  CLASS_TEACHER: [
    'Dashboard', 'Students', 'Attendance', 'Period Attendance', 'Syllabus', 'Timetable',
    'Assignments', 'Grading', 'Compliance', 'Communication', 'Leave Requests',
    'Reports', 'Calendar', 'Announcements', 'Result Workflow', 'Remedial', 'Feedback', 'Grievances',
    'Diary', 'Events',
    'Learning Paths', 'Rubrics', 'Speed Grader', 'Live Classes',
    'Course Modules', 'Discussions', 'Gamification',
    'Teaching Tracker',
  ],
  SUBJECT_TEACHER: [
    'Dashboard', 'Attendance', 'Period Attendance', 'Syllabus', 'Assignments', 'Grading',
    'LMS Content', 'File Manager', 'Question Bank', 'Compliance', 'Reports', 'Announcements',
    'Result Workflow', 'Remedial', 'Grievances', 'Diary',
    'Learning Paths', 'Rubrics', 'Speed Grader', 'Live Classes',
    'Course Modules', 'Discussions', 'Gamification',
    'Teaching Tracker',
  ],
  ACCOUNTANT: ['Dashboard', 'Fee Management', 'Fee Automation', 'Reports', 'Concessions', 'Payroll', 'Hostel', 'Expenses'],
  TRANSPORT_MANAGER: ['Dashboard', 'Bus Tracking'],
  HOBBY_COORDINATOR: ['Dashboard', 'Hobbies'],
  PARENT: ['Dashboard', 'Notifications', 'Communication', 'Announcements', 'Feedback', 'Grievances', 'Diary', 'Events'],
  STUDENT: ['Dashboard', 'Timetable', 'Assignments', 'Homework Calendar', 'Notifications', 'Announcements', 'Feedback', 'Certificates', 'Grievances', 'Diary', 'Events', 'Learning Paths', 'Live Classes', 'Course Modules', 'Discussions', 'Gamification'],
};

const adminRoles = ['SUPER_ADMIN', 'IT_ADMIN'];

// Sidebar sections. Har section mein menu items ke naam (allNavigation ke naam se match hone chahiye).
const navGroups: { name: string; items: string[] }[] = [
  { name: 'Home', items: ['Dashboard', 'Announcements', 'Calendar', 'Notifications', 'Events', 'Homework Calendar'] },
  { name: 'Students', items: ['Students', 'Admission', 'Attendance', 'Period Attendance', 'Classes & Sections', 'Promotions', 'Documents', 'Transfer Certificates', 'Certificates', 'Discipline', 'Health Records', 'Year Transition'] },
  { name: 'Academics', items: ['Syllabus', 'Timetable', 'Teaching Tracker', 'Assignments', 'Assessments', 'Question Bank', 'Exam Schedule', 'Grading', 'Result Workflow', 'Remedial', 'Grace Marks', 'Report Cards', 'Performance Report', 'Rubrics', 'Speed Grader', 'Analytics', 'Substitutes'] },
  { name: 'Learning (LMS)', items: ['LMS Content', 'File Manager', 'Course Modules', 'Live Classes', 'Learning Paths', 'Discussions', 'Gamification'] },
  { name: 'Finance', items: ['Fee Management', 'Fee Automation', 'Concessions', 'Expenses', 'Payroll', 'Transport Billing'] },
  { name: 'Staff', items: ['Users', 'Staff Directory', 'Teacher Attendance', 'Leave Requests'] },
  { name: 'Communication', items: ['Communication', 'Diary', 'Feedback', 'Message Logs', 'Surveys', 'Meetings', 'Grievances'] },
  { name: 'Campus', items: ['Hostel', 'Bus Tracking', 'Hobbies', 'Library', 'Inventory', 'Visitors', 'Room Booking', 'ID Cards', 'Alumni', 'Gallery'] },
  { name: 'Settings', items: ['Settings', 'Reports', 'Bulk Operations', 'Compliance', 'Audit Logs'] },
];

function getFilteredNav(role: string) {
  // Feature flag (lib/features.ts) OFF wale items kisi ko bhi nahi dikhte.
  const enabled = allNavigation.filter((item) => isPathEnabled(item.href));
  if (!role || adminRoles.includes(role)) return enabled;
  const allowed = roleNavMap[role];
  if (!allowed) return [allNavigation[0]]; // fallback: Dashboard only
  return enabled.filter((item) => allowed.includes(item.name));
}

function getRoleLabel(role: string): string {
  return role
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

interface SearchResults {
  students: { id: string; name: string; admissionNo: string; class?: string; section?: string }[];
  users: { id: string; name: string; email: string; role: string }[];
  subjects: { id: string; name: string; code: string; class?: string }[];
  enquiries: { id: string; studentName: string; parentName: string; status: string }[];
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [userName, setUserName] = useState('');
  const [filteredNav, setFilteredNav] = useState(allNavigation);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('sidebarCollapsed') === '1');
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try { localStorage.setItem('sidebarCollapsed', c ? '0' : '1'); } catch {}
      return !c;
    });
  }

  // Band (OFF) feature ka URL seedha khola to dashboard pe bhej do
  useEffect(() => {
    if (!isPathEnabled(pathname)) router.replace('/dashboard');
  }, [pathname, router]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const base = process.env.NEXT_PUBLIC_API_URL;

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults(null); setSearchOpen(false); return; }
    setSearchLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
      const res = await fetch(`${base}/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
        setSearchOpen(true);
      }
    } catch {}
    finally { setSearchLoading(false); }
  }, [base]);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => doSearch(val), 300);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); setSearchResults(null); }
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function navigateResult(href: string) {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults(null);
    router.push(href);
  }

  const totalResults = searchResults
    ? searchResults.students.length + searchResults.users.length + searchResults.subjects.length + searchResults.enquiries.length
    : 0;

  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.replace('/login');
        return;
      }

      // Validate token is still valid by calling /users/me
      try {
        const res = await fetch('/api/v1/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 500) {
          // Token is stale/invalid — force re-login
          localStorage.clear();
          window.location.href = '/login';
          return;
        }
        if (!res.ok) {
          localStorage.clear();
          window.location.href = '/login';
          return;
        }
        // Update user info from fresh API response
        const freshUser = await res.json();
        localStorage.setItem('user', JSON.stringify(freshUser));

        const role: string = freshUser.role || '';
        const displayName = [freshUser.firstName, freshUser.lastName].filter(Boolean).join(' ') || freshUser.email || 'User';

        setUserRole(role);
        setUserName(displayName);
        setFilteredNav(getFilteredNav(role));
        setAuthenticated(true);
      } catch {
        // Network error — force re-login to be safe
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    checkAuth();
  }, [router]);

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  const initials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || 'U';

  // Menu items ko sections mein baantna (sirf wahi jo is user ko allowed hain)
  const placed = new Set<string>();
  const visibleGroups = navGroups
    .map((g) => ({
      name: g.name,
      items: g.items
        .map((n) => filteredNav.find((x) => x.name === n))
        .filter((x): x is (typeof allNavigation)[number] => !!x),
    }))
    .filter((g) => g.items.length > 0);
  visibleGroups.forEach((g) => g.items.forEach((i) => placed.add(i.name)));
  const leftovers = filteredNav.filter((i) => !placed.has(i.name));
  if (leftovers.length) visibleGroups.push({ name: 'More', items: leftovers });

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const activeGroup = visibleGroups.find((g) => g.items.some((i) => isActive(i.href)))?.name;

  function signOut() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    router.replace('/login');
  }

  if (!isPathEnabled(pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Redirecting...
      </div>
    );
  }

  const sidebarInner = (
    <>
      <div className={`flex items-center border-b h-16 ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
        <Link href="/dashboard" aria-label={brand.name}>
          <BrandLogo showText={!collapsed} />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {visibleGroups.map((group, gi) => {
          const open = collapsed || (expanded[group.name] ?? (group.name === activeGroup || group.name === 'Home'));
          return (
            <div key={group.name} className="pb-1">
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => setExpanded((p) => ({ ...p, [group.name]: !open }))}
                  className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  aria-expanded={open}
                >
                  {group.name}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
                </button>
              )}
              {collapsed && gi > 0 && <div className="mx-2 mb-2 border-t" />}
              {open && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        title={collapsed ? item.name : undefined}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-lg py-2 text-sm transition-colors ${
                          collapsed ? 'justify-center px-2' : 'px-3'
                        } ${
                          active
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        }`}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.name}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t p-3 space-y-1">
        <button
          onClick={signOut}
          title="Sign Out"
          className={`flex w-full items-center gap-3 rounded-lg py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground ${
            collapsed ? 'justify-center px-2' : 'px-3'
          }`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && 'Sign Out'}
        </button>
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`hidden lg:flex w-full items-center gap-3 rounded-lg py-2 text-sm text-muted-foreground hover:bg-accent ${
            collapsed ? 'justify-center px-2' : 'px-3'
          }`}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /> Collapse</>}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex ${collapsed ? 'w-[72px]' : 'w-64'} shrink-0 bg-card border-r flex-col h-screen sticky top-0 transition-[width] duration-200`}>
        {sidebarInner}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 max-w-[85%] bg-card flex flex-col h-full shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 text-muted-foreground"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarInner}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 backdrop-blur px-4 sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden rounded-lg border p-2 text-muted-foreground"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

        {/* Global Search */}
        <div className="relative w-full max-w-md" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => { if (searchResults && totalResults > 0) setSearchOpen(true); }}
              placeholder="Search students, users..."
              className="w-full border rounded-full pl-10 pr-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            {searchLoading && (
              <div className="absolute right-4 top-3 h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}

            {/* Dropdown */}
            {searchOpen && searchResults && totalResults > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-card border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                {searchResults.students.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b">
                      Students
                    </div>
                    {searchResults.students.map(s => (
                      <button
                        key={s.id}
                        onClick={() => navigateResult(`/students/${s.id}`)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-start gap-2 border-b last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{s.name}</div>
                          <div className="text-muted-foreground">{s.admissionNo} · {s.class} {s.section}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.users.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b">
                      Users
                    </div>
                    {searchResults.users.map(u => (
                      <button
                        key={u.id}
                        onClick={() => navigateResult(`/users`)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-start gap-2 border-b last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{u.name}</div>
                          <div className="text-muted-foreground">{u.email} · {u.role}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.subjects.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b">
                      Subjects
                    </div>
                    {searchResults.subjects.map(s => (
                      <button
                        key={s.id}
                        onClick={() => navigateResult(`/syllabus`)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-start gap-2 border-b last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{s.name}</div>
                          <div className="text-muted-foreground">{s.code} · {s.class}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.enquiries.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b">
                      Enquiries
                    </div>
                    {searchResults.enquiries.map(e => (
                      <button
                        key={e.id}
                        onClick={() => navigateResult(`/admission`)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-start gap-2 border-b last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{e.studentName}</div>
                          <div className="text-muted-foreground">Parent: {e.parentName} · {e.status}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {searchOpen && searchResults && totalResults === 0 && searchQuery.trim() && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-card border rounded-lg shadow-lg z-50 px-3 py-4 text-xs text-muted-foreground text-center">
                No results for &quot;{searchQuery}&quot;
              </div>
            )}
          </div>
        </div>


          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                {initials}
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="text-sm font-medium max-w-[160px] truncate">{userName}</p>
                {userRole && <p className="text-xs text-muted-foreground">{getRoleLabel(userRole)}</p>}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
          <footer className="px-4 sm:px-6 lg:px-8 pb-6 text-xs text-muted-foreground">
            &copy; {brand.copyrightYear} {brand.name}
          </footer>
        </main>
      </div>
    </div>
  );
}
