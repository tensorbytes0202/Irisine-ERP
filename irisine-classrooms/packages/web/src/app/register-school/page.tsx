'use client';

import { useState } from 'react';
import Link from 'next/link';
import { brand } from '@/lib/brand';
import { AuthShell } from '@/components/auth-shell';

const inputClass = 'w-full px-3 py-2 border rounded-md bg-background';

/** Public school registration REQUEST. It creates no account: the platform owner reviews it first. */
export default function RegisterSchoolPage() {
  const [form, setForm] = useState({
    schoolName: '', contactPerson: '', email: '', phone: '', address: '', city: '', state: '', country: 'India', website: '',
  });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const body: Record<string, string> = { ...form };
      if (!body.website) delete body.website;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/platform-public/school-registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message[0] : data.message;
        throw new Error(msg || 'Could not send your request');
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your request');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthShell>
        <div className="w-full space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">Request received</h1>
          <p className="text-muted-foreground">
            Thank you. We will review your school and email you at <b>{form.email}</b> once it is approved.
          </p>
          <Link href="/login" className="text-primary hover:underline">Back to sign in</Link>
        </div>
      </AuthShell>
    );
  }

  const field = (label: string, key: keyof typeof form, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input className={inputClass} value={form[key]} onChange={set(key)} {...props} />
    </div>
  );

  return (
    <AuthShell>
      <div className="w-full">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Register your school</h1>
          <p className="text-muted-foreground mt-1">Send a request to use {brand.name}. We set up your account after review.</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded" role="alert">{error}</div>}
          {field('School name', 'schoolName', { required: true, minLength: 2 })}
          {field('Contact person', 'contactPerson', { required: true, minLength: 2 })}
          {field('School email', 'email', { type: 'email', required: true })}
          {field('Contact number', 'phone', { type: 'tel', required: true, minLength: 5 })}
          {field('Address', 'address', { required: true, minLength: 3 })}
          <div className="grid grid-cols-2 gap-3">
            {field('City', 'city', { required: true })}
            {field('State', 'state', { required: true })}
          </div>
          {field('Country', 'country', { required: true })}
          {field('Website (optional)', 'website', { type: 'text' })}
          <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground py-2 rounded-md font-medium hover:opacity-90 disabled:opacity-50">
            {loading ? 'Sending...' : 'Send request'}
          </button>
          <p className="text-center text-sm text-muted-foreground">
            Already approved? <Link href="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </AuthShell>
  );
}
