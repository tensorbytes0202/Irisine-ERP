'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { CatalogFeature, FeaturePicker, FeatureSelection } from '@/components/feature-picker';

const input = 'w-full px-3 py-2 border rounded-md bg-background';

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [school, setSchool] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [catalog, setCatalog] = useState<CatalogFeature[]>([]);
  const [features, setFeatures] = useState<FeatureSelection>({});
  const [limits, setLimits] = useState({ maxStudents: '', maxFaculty: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, u, c] = await Promise.all([
        apiFetch(`/platform/schools/${id}`),
        apiFetch(`/platform/schools/${id}/usage`),
        apiFetch<CatalogFeature[]>('/platform/features'),
      ]);
      setSchool(s);
      setUsage(u);
      setCatalog(c);
      setLimits({ maxStudents: u.maxStudents ?? '', maxFaculty: u.maxFaculty ?? '' });
      setFeatures(
        Object.fromEntries(
          s.features.map((f: any) => [f.featureKey, { enabled: f.enabled, adminManageable: f.adminManageable }]),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function run(action: () => Promise<void>, ok: string) {
    setError('');
    setMsg('');
    try {
      await action();
      setMsg(ok);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const saveFeatures = () =>
    run(async () => {
      // every known feature is sent, so unticking a module really removes access
      const grants = catalog
        .filter((f) => !f.isCore)
        .map((f) => ({ key: f.key, enabled: !!features[f.key]?.enabled, adminManageable: !!features[f.key]?.adminManageable }));
      await apiFetch(`/platform/schools/${id}/features`, { method: 'PUT', body: JSON.stringify({ features: grants }) });
    }, 'Features saved');

  const saveLimits = () =>
    run(async () => {
      const num = (v: string | number) => (v === '' ? null : Number(v));
      await apiFetch(`/platform/schools/${id}/limits`, {
        method: 'PATCH',
        body: JSON.stringify({ maxStudents: num(limits.maxStudents), maxFaculty: num(limits.maxFaculty) }),
      });
    }, 'Limits saved');

  const setStatus = (status: string) =>
    run(async () => {
      await apiFetch(`/platform/schools/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    }, `School is now ${status}`);

  const resend = () =>
    run(async () => {
      const r = await apiFetch(`/platform/schools/${id}/resend-invite`, { method: 'POST' });
      setInviteLink(r.inviteLink);
    }, 'New invite created');

  if (!school) {
    return <div className="text-muted-foreground">{error || 'Loading...'}</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/platform" className="text-sm text-primary hover:underline">&larr; Schools</Link>
        <h1 className="text-2xl font-bold mt-1">{school.name}</h1>
        <p className="text-sm text-muted-foreground">{[school.city, school.country, school.email].filter(Boolean).join(' · ')}</p>
      </div>

      {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded" role="alert">{error}</div>}
      {msg && <div className="bg-accent text-accent-foreground text-sm p-3 rounded">{msg}</div>}

      <section className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Status: {school.status}</h2>
          <div className="flex gap-2">
            {school.status !== 'ACTIVE' && (
              <button onClick={() => setStatus('ACTIVE')} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">Activate</button>
            )}
            {school.status === 'ACTIVE' && (
              <button onClick={() => confirm('Suspend this school? Nobody there can sign in until you activate it again. Data is kept.') && setStatus('SUSPENDED')} className="rounded-md border px-3 py-1.5 text-sm">Suspend</button>
            )}
          </div>
        </div>
        <button onClick={resend} className="text-sm text-primary hover:underline">Send a new set-password link to the Super Admin</button>
        {inviteLink && <div className="rounded-md border bg-muted p-3 text-sm break-all">{inviteLink}</div>}
      </section>

      <section className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Limits</h2>
        <p className="text-sm text-muted-foreground">
          Using now: {usage.students} students, {usage.faculty} faculty. Leave a box empty for unlimited.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Max students</label>
            <input className={input} type="number" min={0} value={limits.maxStudents} onChange={(e) => setLimits({ ...limits, maxStudents: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max faculty</label>
            <input className={input} type="number" min={0} value={limits.maxFaculty} onChange={(e) => setLimits({ ...limits, maxFaculty: e.target.value })} />
          </div>
        </div>
        <button onClick={saveLimits} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Save limits</button>
      </section>

      <section className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Features</h2>
        <p className="text-sm text-muted-foreground">Turning a module off blocks it for the whole school. Their data is kept.</p>
        <FeaturePicker catalog={catalog} value={features} onChange={setFeatures} />
        <button onClick={saveFeatures} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Save features</button>
      </section>
    </div>
  );
}
