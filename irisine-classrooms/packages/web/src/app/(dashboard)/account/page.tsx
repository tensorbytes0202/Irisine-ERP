'use client';

import { useEffect, useState } from 'react';
import { API, apiFetch, getToken } from '@/lib/api';

const input = 'mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background font-normal';
const button = 'bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm disabled:opacity-60';

export default function AccountPage() {
  const [profile, setProfile] = useState({ firstName: '', lastName: '', phone: '' });
  const [email, setEmail] = useState('');
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/users/me')
      .then((u) => {
        setProfile({ firstName: u.firstName ?? '', lastName: u.lastName ?? '', phone: u.phone ?? '' });
        setEmail(u.email);
      })
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

  // Plain fetch on purpose: a wrong current password answers 401, which must not sign the user out.
  async function changePassword() {
    if (passwords.newPassword !== passwords.confirm) throw new Error('The new passwords do not match');
    const res = await fetch(`${API}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(Array.isArray(data.message) ? data.message[0] : data.message || 'Could not change the password');
    }
    setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">My Account</h1>
        <p className="text-sm text-muted-foreground mt-1">{email}</p>
      </div>
      {error && <div role="alert" className="p-3 rounded bg-destructive/10 text-destructive text-sm">{error}</div>}
      {message && <div role="status" className="p-3 rounded bg-accent text-accent-foreground text-sm">{message}</div>}

      <form
        className="bg-card border rounded-lg p-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => apiFetch('/users/me', { method: 'PATCH', body: JSON.stringify(profile) }), 'Profile saved.');
        }}
      >
        <h2 className="text-lg font-semibold">Profile</h2>
        {([['firstName', 'First name'], ['lastName', 'Last name'], ['phone', 'Phone']] as const).map(([key, title]) => (
          <label key={key} className="block text-sm font-medium">
            {title}
            <input required={key !== 'phone'} value={profile[key]} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} className={input} />
          </label>
        ))}
        <button type="submit" disabled={saving} className={button}>Save profile</button>
      </form>

      <form
        className="bg-card border rounded-lg p-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(changePassword, 'Password changed.');
        }}
      >
        <h2 className="text-lg font-semibold">Change password</h2>
        {([['currentPassword', 'Current password'], ['newPassword', 'New password (min 8)'], ['confirm', 'Repeat new password']] as const).map(([key, title]) => (
          <label key={key} className="block text-sm font-medium">
            {title}
            <input
              required
              type="password"
              minLength={key === 'currentPassword' ? undefined : 8}
              autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'}
              value={passwords[key]}
              onChange={(e) => setPasswords({ ...passwords, [key]: e.target.value })}
              className={input}
            />
          </label>
        ))}
        <button type="submit" disabled={saving} className={button}>Change password</button>
      </form>
    </div>
  );
}
