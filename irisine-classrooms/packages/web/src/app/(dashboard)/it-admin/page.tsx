'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { itAdminItems, IT_ADMIN_HOME } from '@/lib/it-admin';

interface Overview {
  school: { name: string; code: string; city: string | null; status: string };
  access: { features: string[]; limits: { students: number; faculty: number; maxStudents: number | null; maxFaculty: number | null } };
  users: { isActive: boolean }[];
  modules: { key: string; name: string; adminEnabled: boolean }[];
  isOwner: boolean;
  platform: { schools: number; activeSchools: number; students: number } | null;
}

const of = (used: number, max: number | null) => (max === null ? `${used}` : `${used} / ${max}`);

export default function ItAdminOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch('/school/profile'),
      apiFetch('/school/features'),
      apiFetch('/users'),
      apiFetch('/school/modules'),
      apiFetch('/users/me').then(async (me) => ({
        isOwner: me.isOwner === true,
        platform: me.isOwner ? await apiFetch('/platform/stats') : null,
      })),
    ])
      .then(([school, access, users, modules, owner]) => setData({ school, access, users, modules, ...owner }))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div role="alert" className="p-3 rounded bg-destructive/10 text-destructive text-sm">{error}</div>;
  if (!data) return <div className="text-muted-foreground">Loading...</div>;

  const { school, access, users, modules, isOwner, platform } = data;
  const cards = [
    ['Students', of(access.limits.students, access.limits.maxStudents)],
    ['Faculty', of(access.limits.faculty, access.limits.maxFaculty)],
    ['Active accounts', String(users.filter((u) => u.isActive).length)],
    ['Modules on', String(modules.filter((m) => m.adminEnabled).length)],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">IT Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {school.name} · {school.code}
          {school.city ? ` · ${school.city}` : ''} · {school.status}
        </p>
      </div>

      {platform && (
        <Link href="/it-admin/schools" className="block bg-card border rounded-lg p-4 hover:border-primary">
          <p className="text-sm font-semibold">All schools</p>
          <p className="text-sm text-muted-foreground mt-1">
            {platform.schools} schools · {platform.activeSchools} active · {platform.students} students. Add or delete schools and choose their features.
          </p>
        </Link>
      )}

      <h2 className="text-lg font-semibold">Your school</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([title, value]) => (
          <div key={title} className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Manage</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {itAdminItems(access.features, isOwner)
            .filter((i) => i.href !== IT_ADMIN_HOME)
            .map((i) => (
              <Link key={i.href} href={i.href} className="bg-card border rounded-lg p-4 text-sm font-medium hover:border-primary">
                {i.name}
              </Link>
            ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Modules granted to your school</h2>
        {modules.length === 0 ? (
          <p className="text-sm text-muted-foreground">{isOwner ? 'No modules yet. Grant them from Schools.' : 'No modules yet. Ask the platform owner to grant them.'}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {modules.map((m) => (
              <span key={m.key} className={`px-3 py-1 rounded-full text-xs border ${m.adminEnabled ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}>
                {m.name}
                {m.adminEnabled ? '' : ' (off)'}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
