'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface SchoolRow {
  id: string;
  name: string;
  email: string | null;
  city: string | null;
  status: string;
  maxStudents: number | null;
  maxFaculty: number | null;
  _count: { users: number; features: number };
}

const statusClass: Record<string, string> = {
  ACTIVE: 'bg-accent text-accent-foreground',
  SUSPENDED: 'bg-yellow-100 text-yellow-800',
  DEACTIVATED: 'bg-destructive/10 text-destructive',
  DELETED: 'bg-destructive/10 text-destructive',
};

export default function SchoolsPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState('');
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<SchoolRow[]>(`/platform/schools${deleted ? '?status=DELETED' : ''}`),
      apiFetch('/platform/stats'),
    ])
      .then(([s, st]) => { setSchools(s); setStats(st); })
      .catch((e) => setError(e.message));
  }, [deleted]);

  const cards = stats
    ? [
        ['Schools', stats.schools],
        ['Active', stats.activeSchools],
        ['Suspended', stats.suspendedSchools],
        ['Students', stats.students],
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Schools</h1>
        <Link href="/it-admin/schools/new" className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Add school
        </Link>
      </div>

      {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded">{error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map(([label, value]) => (
          <div key={label as string} className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-bold">{value as number}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={deleted} onChange={(e) => setDeleted(e.target.checked)} />
        Show deleted schools
      </label>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2">School</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Modules</th>
              <th className="px-3 py-2">Student limit</th>
              <th className="px-3 py-2">Faculty limit</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {schools.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{[s.city, s.email].filter(Boolean).join(' · ')}</div>
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[s.status] || ''}`}>{s.status}</span>
                </td>
                <td className="px-3 py-2">{s._count.features}</td>
                <td className="px-3 py-2">{s.maxStudents ?? 'Unlimited'}</td>
                <td className="px-3 py-2">{s.maxFaculty ?? 'Unlimited'}</td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/it-admin/schools/${s.id}`} className="text-primary hover:underline">Manage</Link>
                </td>
              </tr>
            ))}
            {schools.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">{deleted ? 'No deleted schools.' : 'No schools yet. Add the first one.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
