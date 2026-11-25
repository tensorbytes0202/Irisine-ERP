'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AcademicSessions } from '@/components/academic-sessions';

const FIELDS = [
  ['name', 'School name'], ['email', 'Email'], ['phone', 'Phone'], ['website', 'Website'],
  ['address', 'Address'], ['city', 'City'], ['state', 'State'], ['country', 'Country'],
] as const;

const input = 'mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background font-normal';
const button = 'bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm disabled:opacity-60';

export default function SchoolConfigPage() {
  const [profile, setProfile] = useState<Record<string, string> | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/school/profile')
      .then((s) => setProfile(Object.fromEntries(FIELDS.map(([k]) => [k, s[k] ?? '']))))
      .catch((e) => setError(e.message));
  }, []);

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

      <AcademicSessions />
    </div>
  );
}
