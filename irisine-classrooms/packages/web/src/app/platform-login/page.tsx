'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { API, saveSession } from '@/lib/api';
import { AuthShell } from '@/components/auth-shell';

/** Sign-in for the platform owner only. Not linked from the school login page. */
export default function PlatformLoginPage() {
  const router = useRouter();
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
      const res = await fetch(`${API}/platform-public/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(res.status >= 500 ? 'Server error. Please try again later.' : 'Invalid email or password');
      }
      saveSession(data);
      router.push('/platform');
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
          <h1 className="text-3xl font-bold tracking-tight">Platform owner</h1>
          <p className="text-muted-foreground mt-1">Manage schools, limits and modules</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded" role="alert">
              {error}
            </div>
          )}
          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-md bg-background font-normal"
              autoComplete="username"
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-md bg-background font-normal"
              autoComplete="current-password"
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-2 rounded-md font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <div className="text-center pt-1">
            <Link href="/login" className="text-sm text-primary hover:underline">
              School sign in
            </Link>
          </div>
        </form>
      </div>
    </AuthShell>
  );
}
