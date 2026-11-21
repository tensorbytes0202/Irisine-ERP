import Link from 'next/link';
import { Check } from 'lucide-react';
import { brand } from '@/lib/brand';

const sections = [
  {
    title: 'Students & Admission',
    items: ['Student records and profiles', 'Admission enquiries and applications', 'Classes and sections', 'Student promotions at year end'],
  },
  {
    title: 'Academics',
    items: ['Daily attendance', 'Timetable and exam schedule', 'Syllabus tracking', 'Assignments and assessments', 'Grading and report cards'],
  },
  {
    title: 'Learning (LMS)',
    items: ['LMS content library', 'Course modules', 'Live classes', 'Learning paths', 'Discussion forums'],
  },
  {
    title: 'Fees & Finance',
    items: ['Fee heads and payments', 'Pending dues tracking', 'Concessions', 'Expense records'],
  },
  {
    title: 'Communication',
    items: ['Announcements', 'Calendar and events', 'Notifications', 'Teacher diary', 'Parent feedback'],
  },
  {
    title: 'Staff & Admin',
    items: ['User accounts with roles', 'Staff directory', 'Teacher attendance and leave requests', 'Audit logs and settings'],
  },
];

export default function FeaturesPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-primary/10 via-background to-accent py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Features</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            What you get with {brand.name}. More modules are built in and can be switched on when you need them.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <div key={s.title} className="rounded-2xl border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">{s.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {s.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-3 w-3" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link
            href="/login"
            className="inline-block rounded-full bg-primary px-7 py-3 font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </section>
    </div>
  );
}
