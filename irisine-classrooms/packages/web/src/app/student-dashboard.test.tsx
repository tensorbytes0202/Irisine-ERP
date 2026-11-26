// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

import DashboardPage from './(dashboard)/dashboard/page';

const stats = {
  attendance: { present: 8, absent: 2, late: 0, total: 10, percent: 80 },
  subjectGrades: [{ subject: 'Maths', percentage: 72, assessments: 2 }],
  deadlines: [{ id: 'd1', title: 'Fractions worksheet', type: 'ASSIGNMENT', subject: 'Maths', dueDate: '2027-01-10' }],
  achievements: { badgeCount: 0, totalPoints: 0, rank: null, level: 1 },
  todaySchedule: [{ id: 's1', startTime: '09:00', endTime: '09:45', subject: 'Science', room: '12', type: 'LECTURE' }],
  learningProgress: { moduleItems: 0, completed: 0, percent: 0, paths: [] },
};

const urls: string[] = [];
let reply: { ok: boolean; body: unknown };

beforeEach(() => {
  urls.length = 0;
  reply = { ok: true, body: stats };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(url);
    return { ok: reply.ok, status: reply.ok ? 200 : 500, json: async () => reply.body };
  }));
  vi.stubGlobal('localStorage', { setItem: vi.fn(), removeItem: vi.fn(), getItem: (k: string) => (k === 'user' ? JSON.stringify({ role: 'STUDENT' }) : 'token') });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('student dashboard', () => {
  it("shows the student's own data from one request that carries today's weekday", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText('Fractions worksheet')).toBeTruthy();
    expect(screen.getByText('Science')).toBeTruthy();
    expect(screen.getByText('80%')).toBeTruthy();
    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(new RegExp(`/dashboard/student-stats\\?day=${new Date().getDay()}$`));
  });

  it('says so when nothing is due', async () => {
    reply = { ok: true, body: { ...stats, deadlines: [], todaySchedule: [] } };
    render(<DashboardPage />);
    expect(await screen.findByText('Nothing due soon.')).toBeTruthy();
    expect(screen.getByText('No classes scheduled for today.')).toBeTruthy();
  });

  it('explains a missing student record instead of showing zeros', async () => {
    reply = { ok: true, body: { error: 'Student record not found' } };
    render(<DashboardPage />);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Your student record is not set up yet. Please contact your school.');
    expect(screen.queryByText('My Attendance')).toBeNull();
  });

  it('says when the data cannot be loaded and offers to try again', async () => {
    reply = { ok: false, body: {} };
    render(<DashboardPage />);
    expect((await screen.findByRole('alert')).textContent).toContain('Could not load your dashboard.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByText('My Attendance')).toBeNull();
  });
});
