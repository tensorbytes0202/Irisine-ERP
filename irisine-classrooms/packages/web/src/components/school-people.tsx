'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface People {
  students: {
    id: string;
    admissionNo: string;
    user: { firstName: string; lastName: string; email: string };
    class: { name: string };
    section: { name: string };
  }[];
  faculty: { id: string; firstName: string; lastName: string; email: string; role: string; isActive: boolean }[];
}

const label = (role: string) => role.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

function Table({ title, head, rows, empty }: { title: string; head: string[]; rows: { id: string; cells: string[] }[]; empty: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">{title} ({rows.length})</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="max-h-80 overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr>{head.map((h) => <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  {r.cells.map((c, i) => <td key={head[i]} className="px-3 py-2">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** The platform owner's read-only view of the students and faculty a school has added. */
export function SchoolPeople({ schoolId }: { schoolId: string }) {
  const [people, setPeople] = useState<People | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    apiFetch<People>(`/platform/schools/${schoolId}/people`)
      .then(setPeople)
      .catch((e) => setError(e.message));
  }, [schoolId]);

  useEffect(load, [load]);

  return (
    <section className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Students and faculty</h2>
          <p className="text-sm text-muted-foreground">Added by the school itself. View only.</p>
        </div>
        <button onClick={load} className="rounded-md border px-3 py-1.5 text-sm">Refresh</button>
      </div>
      {error && <div role="alert" className="bg-destructive/10 text-destructive text-sm p-3 rounded">{error}</div>}
      {!people?.students ? (
        !error && <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <>
          <Table
            title="Students"
            head={['Name', 'Admission No', 'Class', 'Email']}
            empty="No students added yet."
            rows={people.students.map((s) => ({
              id: s.id,
              cells: [`${s.user.firstName} ${s.user.lastName}`, s.admissionNo, `${s.class.name} - ${s.section.name}`, s.user.email],
            }))}
          />
          <Table
            title="Faculty"
            head={['Name', 'Role', 'Email', 'Status']}
            empty="No faculty added yet."
            rows={people.faculty.map((f) => ({
              id: f.id,
              cells: [`${f.firstName} ${f.lastName}`, label(f.role), f.email, f.isActive ? 'Active' : 'Inactive'],
            }))}
          />
        </>
      )}
    </section>
  );
}
