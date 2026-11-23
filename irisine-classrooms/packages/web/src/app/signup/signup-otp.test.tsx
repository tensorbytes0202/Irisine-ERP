// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }));
vi.mock('@/components/auth-shell', () => ({ AuthShell: ({ children }: any) => <div>{children}</div> }));

import SignupPage from './page';

const calls: { url: string; body: any }[] = [];

function fillAndSubmit(password: string, confirm = password) {
  const set = (el: HTMLElement, v: string) => fireEvent.change(el, { target: { value: v } });
  const inputs = Array.from(document.querySelectorAll('input'));
  const byType = (t: string) => inputs.filter((i) => i.type === t);
  const text = byType('text');
  set(text[0], 'Acme School');
  set(text[1], 'Mina');
  set(text[2], 'Rao');
  set(byType('email')[0], 'mina@test.com');
  const pw = byType('password');
  set(pw[0], password);
  set(pw[1], confirm);
  fireEvent.submit(document.querySelector('form')!);
}

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: any) => {
      const body = JSON.parse(init.body);
      calls.push({ url, body });
      if (url.endsWith('/auth/register')) return { ok: true, status: 201, json: async () => ({ requiresVerification: true }) };
      return { ok: true, status: 201, json: async () => ({ accessToken: 'a', refreshToken: 'r', user: {} }) };
    }),
  );
  vi.stubGlobal('localStorage', { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('sign-up -> OTP screen', () => {
  it('shows no password error on the OTP screen after a valid sign-up', async () => {
    render(<SignupPage />);
    fillAndSubmit('GoodPassword123');
    await screen.findByText(/Enter the 6-digit code/i);
    expect(screen.queryByText(/Password must be at least 8/i)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('clears a stale password error once the sign-up succeeds', async () => {
    render(<SignupPage />);
    fillAndSubmit('short'); // fails the form validation
    expect(await screen.findByText(/Password must be at least 8/i)).toBeTruthy();
    fillAndSubmit('GoodPassword123');
    await screen.findByText(/Enter the 6-digit code/i);
    expect(screen.queryByText(/Password must be at least 8/i)).toBeNull();
  });

  it('verify only needs the 6-digit code and carries the password to the API', async () => {
    render(<SignupPage />);
    fillAndSubmit('GoodPassword123');
    const code = await screen.findByLabelText('6-digit code');
    const verify = screen.getByRole('button', { name: 'Verify' }) as HTMLButtonElement;
    expect(verify.disabled).toBe(true); // < 6 digits
    fireEvent.change(code, { target: { value: '123456' } });
    expect(verify.disabled).toBe(false);
    fireEvent.click(verify);
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/auth/verify-otp'))).toBe(true));

    const reg = calls.find((c) => c.url.endsWith('/auth/register'))!;
    const ver = calls.find((c) => c.url.endsWith('/auth/verify-otp'))!;
    expect(reg.body.password).toBe('GoodPassword123');
    expect(ver.body).toEqual({ email: 'mina@test.com', otp: '123456', purpose: 'SIGNUP', password: 'GoodPassword123' });
    expect(screen.queryByText(/Password must be at least 8/i)).toBeNull();
  });

  it('never puts the password or code in the URL or localStorage before success', async () => {
    render(<SignupPage />);
    fillAndSubmit('GoodPassword123');
    await screen.findByLabelText('6-digit code');
    expect(calls.every((c) => !c.url.includes('GoodPassword123') && !c.url.includes('?'))).toBe(true);
    expect((localStorage.setItem as any).mock.calls.length).toBe(0);
  });
});
