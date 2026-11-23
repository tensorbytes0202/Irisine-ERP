'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL;
const COOLDOWN = 60;

/**
 * Six-digit email code entry with verify button, resend countdown and messages.
 * `onVerified` receives the API response (tokens for SIGNUP, resetToken for RESET).
 */
export function OtpForm({
  email,
  purpose,
  onVerified,
  onBack,
  autoSent = true,
}: {
  email: string;
  purpose: 'SIGNUP' | 'RESET';
  onVerified: (data: any) => void;
  onBack?: () => void;
  autoSent?: boolean; // a code was just sent by the previous step
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(autoSent ? COOLDOWN : 0);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code, purpose }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message[0] : data.message;
        throw new Error(msg || 'Could not verify the code');
      }
      onVerified(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify the code');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (seconds > 0 || loading) return;
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose }),
      });
      if (res.status === 429) throw new Error('Too many requests. Please wait a moment.');
      if (!res.ok) throw new Error('Could not send a new code');
      setInfo('If your email is eligible, a new code is on its way.');
      setCode('');
      setSeconds(COOLDOWN);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a new code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter the 6-digit code we sent to <span className="font-medium text-foreground">{email}</span>. It expires in 5
        minutes.
      </p>

      {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded" role="alert">{error}</div>}
      {info && <div className="bg-accent text-accent-foreground text-sm p-3 rounded">{info}</div>}

      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="------"
        aria-label="6-digit code"
        className="w-full px-3 py-3 border rounded-md text-center text-2xl tracking-[0.5em] font-semibold"
        required
        autoFocus
      />

      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="w-full bg-primary text-primary-foreground py-2 rounded-md font-medium hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Please wait...' : 'Verify'}
      </button>

      <div className="flex items-center justify-between text-sm">
        {onBack ? (
          <button type="button" onClick={onBack} className="text-muted-foreground hover:underline">
            Back
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={resend}
          disabled={seconds > 0 || loading}
          className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
        >
          {seconds > 0 ? `Resend code in ${seconds}s` : 'Resend code'}
        </button>
      </div>
    </form>
  );
}
