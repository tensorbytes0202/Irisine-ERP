import { BookOpen, CalendarCheck, Wallet } from 'lucide-react';
import { brand } from '@/lib/brand';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/theme-toggle';

/** Login / forgot-password ka split layout: left brand panel, right form. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: brand panel (sirf bade screen par) */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/70 p-12 text-primary-foreground">
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/10" />
        <BrandLogo light size={44} className="relative" />
        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight">{brand.tagline}</h2>
          <p className="mt-4 text-white/80">
            Attendance, assignments, live classes, fees aur report cards, sab ek hi jagah.
          </p>
          <ul className="mt-8 space-y-4 text-sm">
            {[
              [CalendarCheck, 'Attendance & timetable in a few clicks'],
              [BookOpen, 'Assignments, assessments and LMS content'],
              [Wallet, 'Fees and report cards without paperwork'],
            ].map(([Icon, text]: any) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">
          &copy; {brand.copyrightYear} {brand.name}
        </p>
      </aside>

      {/* Right: form */}
      <main className="relative flex items-center justify-center p-6 sm:p-10">
        <ThemeToggle className="absolute top-4 right-4" />
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <BrandLogo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
