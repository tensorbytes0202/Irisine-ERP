'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

const FIELDS = [
  ['name', 'School name'], ['email', 'Email'], ['phone', 'Phone'], ['website', 'Website'],
  ['address', 'Address'], ['city', 'City'], ['state', 'State'], ['country', 'Country'],
] as const;

interface Session { id: string; name: string; status: string; startDate: string; endDate: string }

const input = 'mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background font-normal';
const button = 'bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm disabled:opacity-60';
const EMPTY_SESSION = { name: '', startDate: '', endDate: '' };

export default function SchoolConfigPage() {
  const [profile, setProfile] = useState<Record<string, string> | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [session, setSession] = useState(EMPTY_SESSION);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSessions = useCallback(() => apiFetch<Session[]>('/academic-sessions').then(setSessions), []);

  useEffect(() => {
    apiFetch('/school/profile')
      .then((s) => setProfile(Object.fromEntries(FIELDS.map(([k]) => [k, s[k] ?? '']))))
      .catch((e) => setError(e.message));
    loadSessions().catch((e) => setError(e.message));
  }, [loadSessions]);

  async function run(action: () => Promise<unknown>, done: string) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(done);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">School Configuration</h1>
      {error && <div role="alert" className="p-3 rounded bg-destructive/10 text-destructive text-sm">{error}</div>}
      {message && <div role="status" className="p-3 rounded bg-accent text-accent-foreground text-sm">{message}</div>}

      <section className="bg-card border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">School details</h2>
        {!profile ? (
          <div className="text-muted-foreground text-sm">Loading...</div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => apiFetch('/school/profile', { method: 'PATCH', body: JSON.stringify(profile) }), 'School details saved.');
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              {FIELDS.map(([key, title]) => (
                <label key={key} className="block text-sm font-medium">
                  {title}
                  <input
                    type={key === 'email' ? 'email' : 'text'}
                    required={key === 'name'}
                    value={profile[key]}
                    onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                    className={input}
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button type="submit" disabled={saving} className={button}>Save details</button>
            </div>
          </form>
        )}
      </section>

      <section className="bg-card border rounded-lg p-4">
        <h2 className="text-lg font-semibold">Academic sessions</h2>
        <p className="text-sm text-muted-foreground mb-3">A session is needed before students can be added.</p>
        {sessions.length > 0 && (
          <ul className="divide-y border rounded-md mb-4">
            {sessions.map((s) => (
              <li key={s.id} className="flex justify-between px-3 py-2 text-sm">
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground">
                  {new Date(s.startDate).toLocaleDateString()} to {new Date(s.endDate).toLocaleDateString()} · {s.status}
                </span>
              </li>
            ))}
          </ul>
        )}
        <form
          className="grid gap-4 md:grid-cols-4 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await apiFetch('/academic-sessions', { method: 'POST', body: JSON.stringify(session) });
              setSession(EMPTY_SESSION);
              await loadSessions();
            }, 'Academic session created.');
          }}
        >
          <label className="block text-sm font-medium">
            Name
            <input required placeholder="2026-27" value={session.name} onChange={(e) => setSession({ ...session, name: e.target.value })} className={input} />
          </label>
          <label className="block text-sm font-medium">
            Start date
            <input required type="date" value={session.startDate} onChange={(e) => setSession({ ...session, startDate: e.target.value })} className={input} />
          </label>
          <label className="block text-sm font-medium">
            End date
            <input required type="date" value={session.endDate} onChange={(e) => setSession({ ...session, endDate: e.target.value })} className={input} />
          </label>
          <button type="submit" disabled={saving} className={button}>Add session</button>
        </form>
      </section>
    </div>
  );
}
