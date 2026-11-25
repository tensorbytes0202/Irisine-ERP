'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GraduationCap, Presentation, School, ServerCog } from 'lucide-react';
import { brand } from '@/lib/brand';
import { API, PortalKey, homeForPortal, saveSession } from '@/lib/api';
import { AuthShell } from '@/components/auth-shell';

const PORTALS: { key: PortalKey; title: string; hint: string; icon: any }[] = [
  { key: 'STUDENT', title: 'Student', hint: 'Timetable, homework, fees, live classes', icon: GraduationCap },
  { key: 'FACULTY', title: 'Faculty', hint: 'Attendance, grading, assignments, classes', icon: Presentation },
  { key: 'SUPER_ADMIN', title: 'Super Admin', hint: 'Run your school: students, staff, fees', icon: School },
  { key: 'IT_ADMIN', title: 'IT Admin', hint: 'Schools, features, users and settings', icon: ServerCog },
];

export default function LoginPage() {
  const router = useRouter();
  const [portal, setPortal] = useState<PortalKey>('STUDENT');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      // The server checks that the account really belongs to the portal that was picked.
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, portal }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = typeof data.message === 'string' ? data.message : data.message?.message;
        if (res.status === 403 && msg) throw new Error(msg);
        if (res.status === 429) throw new Error('Too many attempts. Please wait a minute and try again.');
        if (res.status >= 500) throw new Error('Server error. Please try again later.');
        throw new Error('Invalid email or password');
      }

      saveSession(data);
      // Where to go comes from the verified response, not from the card that was selected
      router.push(homeForPortal(data.user?.portal));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="w-full">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground mt-1">Choose your portal and sign in to {brand.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5" role="radiogroup" aria-label="Portal">
          {PORTALS.map((p) => {
            const Icon = p.icon;
            const active = portal === p.key;
            return (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => { setPortal(p.key); setError(''); }}
                className={`text-left rounded-lg border p-3 transition ${
                  active ? 'border-primary bg-accent ring-1 ring-primary' : 'hover:bg-muted'
                }`}
              >
                <Icon className={`h-5 w-5 mb-1 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="text-sm font-semibold">{p.title}</div>
                <div className="text-xs text-muted-foreground leading-snug">{p.hint}</div>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded" role="alert">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
              placeholder="you@example.com"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-2 rounded-md font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : `Sign in as ${PORTALS.find((p) => p.key === portal)!.title}`}
          </button>

          <div className="text-center pt-1">
            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot Password?
            </Link>
          </div>
        </form>
      </div>
    </AuthShell>
  );
}
