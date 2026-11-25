'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';

const inputClass = 'w-full px-3 py-2 border rounded-md bg-background';

function AcceptInviteForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirm) return setError('Passwords do not match');
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message[0] : data.message;
        throw new Error(msg || 'Could not set your password');
      }
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set your password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Set your password</h1>
        <p className="text-muted-foreground mt-1">Choose a password to finish setting up your account.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded" role="alert">{error}</div>}
        <div>
          <label className="block text-sm font-medium mb-1">New password</label>
          <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Confirm password</label>
          <input type="password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
        </div>
        <button type="submit" disabled={loading || !token} className="w-full bg-primary text-primary-foreground py-2 rounded-md font-medium hover:opacity-90 disabled:opacity-50">
          {loading ? 'Please wait...' : 'Set password and continue'}
        </button>
        {!token && <p className="text-sm text-destructive">This link is missing its token. Open the link from your email again.</p>}
      </form>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <AcceptInviteForm />
      </Suspense>
    </AuthShell>
  );
}
