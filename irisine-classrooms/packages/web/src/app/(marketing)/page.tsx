import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ClipboardCheck,
  CalendarDays,
  FileText,
  GraduationCap,
  MessageSquare,
  PenTool,
  Play,
  ShieldCheck,
  Users,
  Video,
  Wallet,
  Zap,
  School,
  UserRound,
  Heart,
} from 'lucide-react';
import { brand } from '@/lib/brand';

const features = [
  { icon: ClipboardCheck, title: 'Attendance Management', text: 'Mark and track attendance in a few clicks.' },
  { icon: CalendarDays, title: 'Timetable & Exam Schedule', text: 'Plan timetables and conduct exams easily.' },
  { icon: PenTool, title: 'Assignments & Assessments', text: 'Create, collect and grade homework and tests.' },
  { icon: Video, title: 'LMS & Live Classes', text: 'Share notes, run live classes and track learning.' },
  { icon: FileText, title: 'Grading & Report Cards', text: 'Generate report cards and performance insights.' },
  { icon: Wallet, title: 'Fee Management', text: 'Define fee heads, record payments, track dues.' },
  { icon: MessageSquare, title: 'Announcements & Diary', text: 'Keep parents and students updated every day.' },
  { icon: GraduationCap, title: 'Admission & Students', text: 'Manage enquiries, admissions and student records.' },
];

const roles = [
  {
    icon: ShieldCheck,
    name: 'School Admin',
    text: 'One dashboard for the whole school.',
    points: ['Students, staff and fees in one view', 'Control who can see what', 'Reports without spreadsheets'],
  },
  {
    icon: Users,
    name: 'Teachers',
    text: 'Less paperwork, more teaching.',
    points: ['Quick attendance and diary notes', 'Assignments and grading in one place', 'Share notes and live classes'],
  },
  {
    icon: BookOpen,
    name: 'Students',
    text: 'Everything for the school day.',
    points: ['Timetable and exam dates', 'Submit assignments online', 'Notes, results and live classes'],
  },
  {
    icon: Heart,
    name: 'Parents',
    text: 'Stay close to your child’s progress.',
    points: ['Attendance and results', 'Fee dues and receipts', 'School announcements and diary'],
  },
];

const floating = [
  { icon: ClipboardCheck, label: 'Attendance', pos: 'top-6 right-2 xl:-right-10', anim: 'float-slow' },
  { icon: Video, label: 'Live Classes', pos: 'top-28 right-0 xl:-right-14', anim: 'float-slower' },
  { icon: BarChart3, label: 'Reports', pos: 'top-52 right-2 xl:-right-10', anim: 'float-slow' },
  { icon: Wallet, label: 'Fees', pos: 'top-[19rem] right-0 xl:-right-12', anim: 'float-slower' },
];

const trust = [
  { icon: ShieldCheck, label: 'Secure & Reliable' },
  { icon: Zap, label: 'All-in-One Platform' },
  { icon: School, label: 'For Schools of All Sizes' },
];

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-accent/70 via-background to-background">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[hsl(var(--fresh))]/10 blur-3xl" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 grid items-center gap-12 lg:grid-cols-2">
          <div className="fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground text-xs font-semibold px-4 py-1.5">
              <School className="h-3.5 w-3.5" />
              School Management + Learning Platform
            </span>
            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Smart Classrooms,
              <span className="block bg-gradient-to-r from-primary to-[hsl(var(--fresh))] bg-clip-text text-transparent">
                Simpler School Management
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed">
              A complete school ERP to manage attendance, assignments, exams, fees and communication, so
              teachers can teach better and students can learn smarter.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-4">
              <Link
                href="/register-school"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 hover:-translate-y-0.5 transition-all"
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/features"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/30 bg-card/80 px-8 py-3.5 font-semibold text-primary hover:bg-accent hover:-translate-y-0.5 transition-all"
              >
                <Play className="h-4 w-4 fill-current" /> See Features
              </Link>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
              {trust.map((t) => (
                <li key={t.label} className="flex items-center gap-2 text-sm font-medium">
                  <t.icon className="h-5 w-5 text-[hsl(var(--fresh))]" />
                  {t.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Hero image + floating cards */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none fade-up" style={{ animationDelay: '0.15s' }}>
            <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-[hsl(var(--fresh))]/20 to-primary/10" />
            <div className="relative overflow-hidden rounded-[2rem] shadow-2xl shadow-primary/20 ring-1 ring-primary/10">
              <Image
                src="/hero-student.jpg"
                alt="Smiling student holding books"
                width={505}
                height={552}
                priority
                className="h-auto w-full"
              />
            </div>
            {floating.map((f) => (
              <div
                key={f.label}
                className={`hidden sm:flex absolute ${f.pos} ${f.anim} items-center gap-2.5 rounded-2xl bg-card/95 backdrop-blur px-4 py-3 shadow-lg ring-1 ring-black/5`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-primary">
                  <f.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Everything a <span className="text-[hsl(var(--fresh))]">School Needs</span>
            </h2>
            <p className="mt-3 text-muted-foreground">
              A focused set of tools for running a school or coaching institute day to day.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
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
      <section id="roles" className="py-20 bg-gradient-to-b from-accent/50 to-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Built for <span className="text-[hsl(var(--fresh))]">everyone</span> in the school
            </h2>
            <p className="mt-3 text-muted-foreground">Each person logs in and sees only what they need.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map((r) => (
              <div
                key={r.name}
                className="rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <r.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{r.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{r.text}</p>
                <ul className="mt-4 space-y-2">
                  {r.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--fresh))]" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Simple, <span className="text-[hsl(var(--fresh))]">honest</span> pricing
            </h2>
            <p className="mt-3 text-muted-foreground">Start free. Ask us when you want us to run it for you.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border bg-card p-8 shadow-sm">
              <h3 className="font-semibold">Self-hosted</h3>
              <p className="mt-3 text-4xl font-extrabold">Free</p>
              <p className="text-sm text-muted-foreground">Open source</p>
              <ul className="mt-6 space-y-3 text-sm">
                {['Run it on your own server', 'All core classroom features', 'Your data stays with you'].map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-[hsl(var(--fresh))]" /> {p}
                  </li>
                ))}
              </ul>
              <Link
                href="/register-school"
                className="mt-8 block rounded-full border border-primary/30 py-3 text-center font-semibold text-primary hover:bg-accent transition-colors"
              >
                Get Started
              </Link>
            </div>
            <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-8 text-primary-foreground shadow-xl shadow-primary/20">
              <h3 className="font-semibold">Managed by us</h3>
              <p className="mt-3 text-4xl font-extrabold">Coming soon</p>
              <p className="text-sm text-white/70">Pricing to be announced</p>
              <ul className="mt-6 space-y-3 text-sm">
                {['We host and maintain it for you', 'Setup help and support', 'Early access on request'].map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4" /> {p}
                  </li>
                ))}
              </ul>
              <a
                href={`mailto:${brand.supportEmail}`}
                className="mt-8 block rounded-full bg-white py-3 text-center font-semibold text-primary hover:bg-white/90 transition-colors"
              >
                Contact us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-primary to-[hsl(var(--fresh))] px-8 py-16 text-center text-primary-foreground">
            <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10" />
            <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-white/10" />
            <UserRound className="relative mx-auto h-8 w-8 opacity-80" />
            <h2 className="relative mt-4 text-3xl sm:text-4xl font-bold">Ready to try {brand.name}?</h2>
            <p className="relative mt-3 text-white/80">Create your school account in a minute.</p>
            <div className="relative mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register-school"
                className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 font-semibold text-primary hover:bg-white/90 hover:-translate-y-0.5 transition-all"
              >
                Register School <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-white/40 px-8 py-3.5 font-semibold hover:bg-white/10 transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
