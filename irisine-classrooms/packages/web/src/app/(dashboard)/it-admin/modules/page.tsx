'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface Module {
  key: string;
  name: string;
  category: string;
  adminManageable: boolean;
  adminEnabled: boolean;
}

export default function ModulesPage() {
  const [modules, setModules] = useState<Module[] | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(
    () => apiFetch<Module[]>('/school/modules').then(setModules).catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => { load(); }, [load]);

  async function toggle(m: Module) {
    setBusy(m.key);
    setError('');
    try {
      await apiFetch(`/school/features/${m.key}`, { method: 'PATCH', body: JSON.stringify({ enabled: !m.adminEnabled }) });
      await load();
      window.dispatchEvent(new Event('school-features-changed')); // refresh the menu
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Modules</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        Only modules granted by the platform owner are listed. Switching one off hides it and keeps its data.
      </p>
      {error && <div role="alert" className="mb-4 p-3 rounded bg-destructive/10 text-destructive text-sm">{error}</div>}
      {!modules ? (
        !error && <div className="text-muted-foreground">Loading...</div>
      ) : modules.length === 0 ? (
        <p className="text-sm text-muted-foreground">No modules have been granted to your school yet.</p>
      ) : (
        <div className="bg-card border rounded-lg divide-y">
          {modules.map((m) => (
            <div key={m.key} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">
                  {m.adminManageable ? 'You can switch this module' : 'Controlled by the platform owner'}
                </p>
              </div>
              {m.adminManageable ? (
                <button
                  onClick={() => toggle(m)}
                  disabled={busy === m.key}
                  aria-pressed={m.adminEnabled}
                  className={`px-3 py-1.5 rounded-md text-sm border disabled:opacity-50 ${m.adminEnabled ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
                >
                  {m.adminEnabled ? 'On' : 'Off'}
                </button>
              ) : (
                <span className="text-sm text-muted-foreground">On</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
