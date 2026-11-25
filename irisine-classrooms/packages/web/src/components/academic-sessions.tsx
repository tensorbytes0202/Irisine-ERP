'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface Session { id: string; name: string; status: string; startDate: string; endDate: string }

const input = 'mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background font-normal';
const EMPTY = { name: '', startDate: '', endDate: '' };

/** Lists the school's academic sessions and adds new ones. The first one becomes the active session. */
export function AcademicSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => apiFetch<Session[]>('/academic-sessions').then(setSessions), []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiFetch('/academic-sessions', { method: 'POST', body: JSON.stringify(form) });
      setForm(EMPTY);
      setMessage('Academic session created.');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-card border rounded-lg p-4">
      <h2 className="text-lg font-semibold">Academic sessions</h2>
      <p className="text-sm text-muted-foreground mb-3">A session is needed before students can be added.</p>
      {error && <div role="alert" className="mb-3 p-3 rounded bg-destructive/10 text-destructive text-sm">{error}</div>}
      {message && <div role="status" className="mb-3 p-3 rounded bg-accent text-accent-foreground text-sm">{message}</div>}
      {sessions.length > 0 && (
        <ul className="divide-y border rounded-md mb-4">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap justify-between gap-2 px-3 py-2 text-sm">
              <span className="font-medium">{s.name}</span>
              <span className="text-muted-foreground">
                {new Date(s.startDate).toLocaleDateString()} to {new Date(s.endDate).toLocaleDateString()} · {s.status}
              </span>
            </li>
          ))}
        </ul>
      )}
      <form className="grid gap-4 md:grid-cols-4 items-end" onSubmit={add}>
        <label className="block text-sm font-medium">
          Session name
          <input required placeholder="2026-27" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
        </label>
        <label className="block text-sm font-medium">
          Start date
          <input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={input} />
        </label>
        <label className="block text-sm font-medium">
          End date
          <input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={input} />
        </label>
        <button type="submit" disabled={saving} className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm disabled:opacity-60">
          Add session
        </button>
      </form>
    </section>
  );
}
