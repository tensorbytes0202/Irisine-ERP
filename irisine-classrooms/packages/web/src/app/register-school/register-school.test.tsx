// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }));
vi.mock('@/components/auth-shell', () => ({ AuthShell: ({ children }: any) => <div>{children}</div> }));

import RegisterSchoolPage from './page';

const calls: { url: string; body: any }[] = [];

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: any) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: true, status: 201, json: async () => ({ status: 'PENDING' }) };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('school registration request page', () => {
  it('sends only the school details (no password, no account) and shows a confirmation', async () => {
    render(<RegisterSchoolPage />);
    const inputs = Array.from(document.querySelectorAll('input'));
    const values = ['Acme School', 'Asha Rao', 'office@acme.test', '+911234567890', '1 Main Road', 'Pune', 'MH', 'India'];
    values.forEach((v, i) => fireEvent.change(inputs[i], { target: { value: v } }));
    fireEvent.submit(document.querySelector('form')!);

    await screen.findByText(/Request received/i);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/platform-public\/school-registrations$/);
    expect(calls[0].body).toMatchObject({ schoolName: 'Acme School', email: 'office@acme.test', city: 'Pune' });
    expect(Object.keys(calls[0].body)).not.toContain('password');
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });
});
