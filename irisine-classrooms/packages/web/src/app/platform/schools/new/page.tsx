'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { CatalogFeature, FeaturePicker, FeatureSelection } from '@/components/feature-picker';

const input = 'w-full px-3 py-2 border rounded-md bg-background';

export default function NewSchoolPage() {
  const [catalog, setCatalog] = useState<CatalogFeature[]>([]);
  const [features, setFeatures] = useState<FeatureSelection>({});
  const [form, setForm] = useState({
    schoolName: '', adminName: '', adminEmail: '', phone: '', address: '', city: '', state: '', country: 'India',
    maxStudents: '', maxFaculty: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ inviteLink: string; inviteEmailSent: boolean; schoolId: string } | null>(null);

  useEffect(() => {
    apiFetch<CatalogFeature[]>('/platform/features').then(setCatalog).catch((e) => setError(e.message));
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    const chosen = Object.entries(features).filter(([, v]) => v.enabled);
    if (chosen.length === 0) return setError('Choose at least one feature for this school');

    const body: Record<string, unknown> = {
      schoolName: form.schoolName, adminName: form.adminName, adminEmail: form.adminEmail,
      features: chosen.map(([key, v]) => ({ key, enabled: true, adminManageable: v.adminManageable })),
    };
    for (const k of ['phone', 'address', 'city', 'state', 'country'] as const) if (form[k]) body[k] = form[k];
    if (form.maxStudents !== '') body.maxStudents = Number(form.maxStudents);
    if (form.maxFaculty !== '') body.maxFaculty = Number(form.maxFaculty);

    setLoading(true);
    try {
      setDone(await apiFetch('/platform/schools', { method: 'POST', body: JSON.stringify(body) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the school');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-bold">School created</h1>
        <p className="text-sm text-muted-foreground">
          {done.inviteEmailSent
            ? `We emailed ${form.adminEmail} a link to set their password.`
            : 'Email is not set up, so share this link with the school admin yourself.'}
        </p>
        <div className="rounded-md border bg-muted p-3 text-sm break-all">{done.inviteLink}</div>
        <p className="text-xs text-muted-foreground">The link works once and expires in 72 hours. You can send a new one from the school page.</p>
        <div className="flex gap-3">
          <button onClick={() => navigator.clipboard?.writeText(done.inviteLink)} className="rounded-md border px-3 py-2 text-sm">Copy link</button>
          <Link href={`/platform/schools/${done.schoolId}`} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Open school</Link>
          <Link href="/platform" className="px-3 py-2 text-sm text-primary">Back to schools</Link>
        </div>
      </div>
    );
  }

  const field = (label: string, key: keyof typeof form, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input className={input} value={form[key]} onChange={set(key)} {...props} />
    </div>
  );

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6">
      <div>
        <Link href="/platform" className="text-sm text-primary hover:underline">&larr; Schools</Link>
        <h1 className="text-2xl font-bold mt-1">Add a school</h1>
      </div>

      {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded" role="alert">{error}</div>}

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-semibold">School</h2>
        {field('School name', 'schoolName', { required: true, minLength: 2 })}
        <div className="grid sm:grid-cols-3 gap-3">
          {field('City', 'city')}
          {field('State', 'state')}
          {field('Country', 'country')}
        </div>
        {field('Address', 'address')}
        {field('Contact number', 'phone', { type: 'tel' })}
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Super Admin of this school</h2>
        <p className="text-sm text-muted-foreground">They get a one-time link to set their own password. After that they add the students and faculty themselves.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {field('Name', 'adminName', { required: true, minLength: 2 })}
          {field('Email', 'adminEmail', { type: 'email', required: true })}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Limits</h2>
        <p className="text-sm text-muted-foreground">Leave empty for unlimited.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {field('Max students', 'maxStudents', { type: 'number', min: 0 })}
          {field('Max faculty', 'maxFaculty', { type: 'number', min: 0 })}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Features for this school</h2>
        <FeaturePicker catalog={catalog} value={features} onChange={setFeatures} />
      </section>

      <button type="submit" disabled={loading} className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
        {loading ? 'Creating...' : 'Create school'}
      </button>
    </form>
  );
}
