// @vitest-environment jsdom
/** A school adds its own sessions, classes, students and faculty; the platform owner can look. */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useParams: () => ({ id: 'school-1' }) }));
vi.mock('next/link', () => ({ default: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

import ClassesPage from './(dashboard)/classes/page';
import StudentsPage from './(dashboard)/students/page';
import FacultyPage from './(dashboard)/faculty/page';
import SchoolDetailPage from './(dashboard)/it-admin/schools/[id]/page';
import { isFeatureAllowed } from '@/lib/feature-map';

const calls: { method: string; url: string; body?: any }[] = [];
let data: Record<string, unknown>;

beforeEach(() => {
  calls.length = 0;
  data = {};
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ method, url, body: init.body && JSON.parse(init.body) });
    // longest matching ending wins, so "/schools/school-1/people" is not read as "/schools/school-1"
    const path = url.split('?')[0];
    const key = Object.keys(data).filter((k) => path.endsWith(k)).sort((a, b) => b.length - a.length)[0];
    return { ok: true, status: method === 'POST' ? 201 : 200, json: async () => (key ? data[key] : []) };
  }));
  vi.stubGlobal('localStorage', {
    setItem: vi.fn(),
    removeItem: vi.fn(),
    getItem: (k: string) => (k === 'user' ? JSON.stringify({ id: 'me', role: 'SUPER_ADMIN' }) : 'token'),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('academic sessions', () => {
  it('can be added from Classes & Sections', async () => {
    render(<ClassesPage />);
    fireEvent.change(await screen.findByLabelText('Session name'), { target: { value: '2026-27' } });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-04-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2027-03-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add session' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')).toMatchObject({
        url: expect.stringMatching(/\/academic-sessions$/),
        body: { name: '2026-27', startDate: '2026-04-01', endDate: '2027-03-31' },
      }),
    );
  });
});

describe('the student form says what is missing', () => {
  const open = async () => {
    render(<StudentsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Add Student/ }));
  };
  const submit = () => screen.getAllByRole('button', { name: 'Add Student' }).find((b) => b.getAttribute('type') === 'submit') as HTMLButtonElement;

  it('points to Classes & Sections when there is no class and no session', async () => {
    await open();
    expect(await screen.findByText(/No classes yet/)).toBeTruthy();
    expect(screen.getByText(/No academic session yet/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Classes & Sections' }).getAttribute('href')).toBe('/classes');
    expect(submit().disabled).toBe(true);
  });

  it('shows no warning once both exist', async () => {
    data = { '/classes': [{ id: 'c1', name: 'Class 1', grade: 1 }], '/academic-sessions': [{ id: 's1', status: 'ACTIVE' }] };
    await open();
    await screen.findAllByRole('option', { name: 'Class 1' });
    expect(screen.queryByText(/No classes yet/)).toBeNull();
    expect(screen.queryByText(/No academic session yet/)).toBeNull();
    expect(submit().disabled).toBe(false);
  });

  it('says when the chosen class has no section', async () => {
    data = { '/classes': [{ id: 'c1', name: 'Class 1', grade: 1 }], '/academic-sessions': [{ id: 's1', status: 'ACTIVE' }] };
    await open();
    await screen.findAllByRole('option', { name: 'Class 1' });
    fireEvent.change(document.querySelector('select[name="classId"]')!, { target: { value: 'c1' } });
    expect(await screen.findByText(/This class has no section yet/)).toBeTruthy();
  });
});

describe('faculty for the school itself', () => {
  it('the school Super Admin has an Add Faculty page', async () => {
    render(<FacultyPage />);
    expect(await screen.findByRole('button', { name: /Add Faculty/ })).toBeTruthy();
  });

  it('is part of the Faculty Management module', () => {
    expect(isFeatureAllowed('/faculty', ['CORE'])).toBe(false);
    expect(isFeatureAllowed('/faculty', ['CORE', 'FACULTY_MANAGEMENT'])).toBe(true);
  });
});

describe('the platform owner looks at a school', () => {
  it('lists its students and faculty', async () => {
    data = {
      '/platform/schools/school-1': { id: 'school-1', name: 'Green Valley', status: 'ACTIVE', features: [] },
      '/platform/schools/school-1/usage': { students: 1, faculty: 1, maxStudents: null, maxFaculty: null },
      '/platform/features': [],
      '/platform/schools/school-1/people': {
        students: [{ id: 'st1', admissionNo: 'GV-1', user: { firstName: 'Ravi', lastName: 'Kumar', email: 'ravi@x.test' }, class: { name: 'Class 4' }, section: { name: 'B' } }],
        faculty: [{ id: 'f1', firstName: 'Meena', lastName: 'Iyer', email: 'meena@x.test', role: 'CLASS_TEACHER', isActive: true }],
      },
    };
    render(<SchoolDetailPage />);
    expect(await screen.findByText('Ravi Kumar')).toBeTruthy();
    expect(screen.getByText('GV-1')).toBeTruthy();
    expect(screen.getByText('Class 4 - B')).toBeTruthy();
    expect(screen.getByText('Meena Iyer')).toBeTruthy();
    expect(screen.getByText('Class Teacher')).toBeTruthy();
  });
});
