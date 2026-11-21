import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  FileText,
  GraduationCap,
  MessageSquare,
  PenTool,
  ShieldCheck,
  Users,
  Video,
  Wallet,
} from 'lucide-react';
import { brand } from '@/lib/brand';

const features = [
  { icon: ClipboardCheck, title: 'Attendance', text: 'Mark class attendance in a few clicks and see who is present, absent or on leave.' },
  { icon: CalendarDays, title: 'Timetable & Exam Schedule', text: 'Plan weekly timetables and exam dates so teachers and students always know what is next.' },
  { icon: PenTool, title: 'Assignments & Assessments', text: 'Create homework and tests, collect submissions and grade them in one place.' },
  { icon: Video, title: 'LMS & Live Classes', text: 'Share notes and course modules, and schedule live classes with learning paths and discussions.' },
  { icon: FileText, title: 'Grading & Report Cards', text: 'Record marks and generate report cards without spreadsheets.' },
  { icon: Wallet, title: 'Fees', text: 'Define fee heads, record payments and keep track of pending dues.' },
  { icon: MessageSquare, title: 'Announcements & Diary', text: 'Send announcements and daily diary notes to parents and students.' },
  { icon: GraduationCap, title: 'Admission & Students', text: 'Handle enquiries, admissions and student records together.' },
];

const roles = [
  { icon: ShieldCheck, name: 'School admin', text: 'See the whole school on one dashboard: students, attendance and fees.' },
  { icon: Users, name: 'Teachers', text: 'Take attendance, set assignments and grade work from their own view.' },
  { icon: BookOpen, name: 'Students', text: 'Check timetable, assignments, notes and live classes.' },
  { icon: CalendarCheck, name: 'Parents', text: 'Follow attendance, results, fees and school announcements.' },
];

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
          <span className="inline-block rounded-full bg-primary/10 text-primary text-xs font-semibold px-4 py-1.5">
            School management + learning platform
          </span>
          <h1 className="mt-6 text-4xl sm:text-6xl font-bold tracking-tight">
            {brand.tagline.split(',')[0]},
            <span className="block text-primary">{brand.tagline.split(',')[1]?.trim()}</span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground">
            {brand.name} brings attendance, assignments, live classes, fees and report cards
            together, so teachers spend less time on paperwork and more time teaching.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors"
            >
              Sign In <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/features"
              className="inline-flex items-center gap-2 rounded-full border bg-card px-7 py-3 font-semibold hover:bg-accent transition-colors"
            >
              See features
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight">Everything a classroom needs</h2>
            <p className="mt-3 text-muted-foreground">
              A focused set of tools for running a school or coaching institute day to day.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="py-20 bg-muted/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight">Built for everyone in the school</h2>
            <p className="mt-3 text-muted-foreground">Each person logs in and sees only what they need.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map((r) => (
              <div key={r.name} className="rounded-2xl bg-card border p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <r.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{r.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/70 px-8 py-14 text-center text-primary-foreground">
            <h2 className="text-3xl font-bold">Ready to try {brand.name}?</h2>
            <p className="mt-3 text-white/80">Sign in to explore the demo school.</p>
            <Link
              href="/login"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 font-semibold text-primary hover:bg-white/90 transition-colors"
            >
              Sign In <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
