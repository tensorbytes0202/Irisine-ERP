// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }));
vi.mock('@/components/auth-shell', () => ({ AuthShell: ({ children }: any) => <div>{children}</div> }));

import LoginPage from './page';

const calls: { url: string; body: any }[] = [];
let respond: (url: string) => any;

beforeEach(() => {
  calls.length = 0;
  push.mockClear();
  respond = () => ({ ok: true, status: 201, json: async () => ({ accessToken: 't', refreshToken: 'r', user: { portal: 'X' } }) });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return respond(url);
  }));
  vi.stubGlobal('localStorage', { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function signIn(portalTitle?: string) {
  if (portalTitle) fireEvent.click(screen.getByRole('radio', { name: new RegExp(portalTitle) }));
  fireEvent.change(document.querySelector('input[type="email"]')!, { target: { value: 'a@b.test' } });
  fireEvent.change(document.querySelector('input[type="password"]')!, { target: { value: 'Password-123' } });
  fireEvent.submit(document.querySelector('form')!);
}

describe('login page with four portals', () => {
  it('offers the four portals and no sign-up or registration link', () => {
    render(<LoginPage />);
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    for (const t of ['Student', 'Faculty', 'Super Admin', 'IT Admin']) {
      expect(screen.getByRole('radio', { name: new RegExp(t) })).toBeTruthy();
    }
    const hrefs = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs.join(' ')).not.toMatch(/signup|register/i);
  });

  it('a school portal logs in through /auth/login and sends the chosen portal', async () => {
    render(<LoginPage />);
    signIn('Faculty');
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(calls[0].url).toMatch(/\/auth\/login$/);
    expect(calls[0].body).toEqual({ email: 'a@b.test', password: 'Password-123', portal: 'FACULTY' });
  });

  it('the IT Admin portal uses the platform login and opens /platform', async () => {
    render(<LoginPage />);
    signIn('IT Admin');
    await waitFor(() => expect(push).toHaveBeenCalledWith('/platform'));
    expect(calls[0].url).toMatch(/\/platform-public\/login$/);
    expect(calls[0].body).toEqual({ email: 'a@b.test', password: 'Password-123' });
  });

  it('shows the server message when the account belongs to a different portal', async () => {
    respond = () => ({ ok: false, status: 403, json: async () => ({ message: 'This account cannot sign in to that portal' }) });
    render(<LoginPage />);
    signIn('Super Admin');
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'This account cannot sign in to that portal');
    expect(push).not.toHaveBeenCalled();
  });

  it('shows a generic error for wrong credentials', async () => {
    respond = () => ({ ok: false, status: 401, json: async () => ({ message: 'Invalid credentials' }) });
    render(<LoginPage />);
    signIn();
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Invalid email or password');
  });
});
