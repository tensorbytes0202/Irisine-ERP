'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Users, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role: string;
  isActive?: boolean;
  createdAt?: string;
}

const FACULTY = [
  'FACULTY', 'DIRECTOR', 'PRINCIPAL', 'ACADEMIC_COORDINATOR', 'CLASS_TEACHER', 'SUBJECT_TEACHER',
  'ACCOUNTANT', 'TRANSPORT_MANAGER', 'HOBBY_COORDINATOR',
];
const PROTECTED = ['SUPER_ADMIN', 'ADMIN', 'IT_ADMIN', 'DIRECTOR', 'PRINCIPAL'];
const STAFF_ROLES = ['CLASS_TEACHER', 'SUBJECT_TEACHER', 'ACADEMIC_COORDINATOR', 'ACCOUNTANT', 'TRANSPORT_MANAGER', 'HOBBY_COORDINATOR'];

const label = (role: string) => role.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
const EMPTY = { firstName: '', lastName: '', email: '', phone: '', password: '', role: 'CLASS_TEACHER' };
const input = 'mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background font-normal';

export function UserDirectory({ facultyOnly = false }: { facultyOnly?: boolean }) {
  const [users, setUsers] = useState<User[]>([]);
  const [me, setMe] = useState<{ id?: string; role?: string; isOwner?: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    () =>
      apiFetch<User[]>('/users')
        .then((rows) => setUsers(facultyOnly ? rows.filter((u) => FACULTY.includes(u.role)) : rows))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false)),
    [facultyOnly],
  );

  useEffect(() => {
    try {
      setMe(JSON.parse(localStorage.getItem('user') || '{}'));
    } catch {}
    load();
  }, [load]);

  const canManage = me.role === 'SUPER_ADMIN' || me.role === 'IT_ADMIN';
  // mirrors the API: admin and leadership accounts need the Super Admin or the platform owner
  const leads = me.role === 'SUPER_ADMIN' || me.isOwner === true;
  const creatable = [
    ...STAFF_ROLES,
    ...(facultyOnly ? [] : ['PARENT']),
    ...(leads ? ['DIRECTOR', ...(facultyOnly ? [] : ['SUPER_ADMIN'])] : []),
  ];

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { phone, ...rest } = form;
      await apiFetch('/users', { method: 'POST', body: JSON.stringify({ ...rest, ...(phone && { phone }) }) });
      setForm(EMPTY);
      setShowForm(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function setActive(u: User, isActive: boolean) {
    if (!isActive && !confirm(`Deactivate ${u.email}? They will be signed out.`)) return;
    setError('');
    try {
      await apiFetch(`/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const roles = ['All', ...Array.from(new Set(users.map((u) => u.role))).sort()];
  const filtered = users.filter((u) => {
    const text = `${u.firstName ?? ''} ${u.lastName ?? ''} ${u.email ?? ''}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (role === 'All' || u.role === role);
  });

  const field = (name: keyof typeof EMPTY, title: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block text-sm font-medium">
      {title}
      <input value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} className={input} {...props} />
    </label>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{facultyOnly ? 'Faculty Management' : 'User Management'}</h1>
          <p className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <Users className="h-4 w-4" />
            {users.length} {facultyOnly ? 'faculty' : 'users'}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => { setShowForm((v) => !v); setError(''); }}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Cancel' : facultyOnly ? 'Add Faculty' : 'Add User'}
          </button>
        )}
      </div>

      {error && <div role="alert" className="mb-4 p-3 rounded bg-destructive/10 text-destructive text-sm">{error}</div>}

      {showForm && (
        <form onSubmit={create} className="bg-card rounded-lg border p-4 mb-6">
          <div className="grid gap-4 md:grid-cols-3">
            {field('firstName', 'First name', { required: true })}
            {field('lastName', 'Last name', { required: true })}
            {field('email', 'Email', { required: true, type: 'email' })}
            {field('phone', 'Phone')}
            {field('password', 'Temporary password (min 8)', { required: true, type: 'password', minLength: 8, autoComplete: 'new-password' })}
            <label className="block text-sm font-medium">
              Role
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={input}>
                {creatable.map((r) => <option key={r} value={r}>{label(r)}</option>)}
              </select>
            </label>
          </div>
          <div className="flex justify-end mt-4">
            <button type="submit" disabled={saving} className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm disabled:opacity-60">
              {saving ? 'Saving...' : 'Create account'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-card rounded-lg border p-4 mb-4 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full border rounded-md pl-9 pr-3 py-2 text-sm bg-background"
          />
        </div>
        <select aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value)} className="border rounded-md px-3 py-2 text-sm bg-background">
          {roles.map((r) => <option key={r} value={r}>{r === 'All' ? 'All roles' : label(r)}</option>)}
        </select>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">No matching accounts.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {['Name', 'Email', 'Phone', 'Role', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const active = u.isActive !== false;
                // the API additionally refuses any change to the platform owner account
                const editable = canManage && u.id !== me.id && (leads || !PROTECTED.includes(u.role));
                return (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || '--'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email ?? '--'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.phone || '--'}</td>
                    <td className="px-4 py-3">{label(u.role)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${active ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                        {active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editable && (
                        <button onClick={() => setActive(u, !active)} className="text-sm text-primary hover:underline">
                          {active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
