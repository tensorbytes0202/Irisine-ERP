'use client';

export interface CatalogFeature {
  key: string;
  name: string;
  category: string;
  isCore: boolean;
  isActive: boolean;
}

export type FeatureSelection = Record<string, { enabled: boolean; adminManageable: boolean }>;

/**
 * Checklist of platform modules for one school. "Enabled" means the school may use it.
 * "School admin can switch" lets that school's own admin turn it off and on again (never add new ones).
 */
export function FeaturePicker({
  catalog,
  value,
  onChange,
}: {
  catalog: CatalogFeature[];
  value: FeatureSelection;
  onChange: (next: FeatureSelection) => void;
}) {
  const items = catalog.filter((f) => !f.isCore);
  const groups = Array.from(new Set(items.map((f) => f.category)));

  const set = (key: string, patch: Partial<{ enabled: boolean; adminManageable: boolean }>) =>
    onChange({
      ...value,
      [key]: { enabled: value[key]?.enabled ?? false, adminManageable: value[key]?.adminManageable ?? false, ...patch },
    });

  const allOn = items.every((f) => value[f.key]?.enabled);
  const toggleAll = () =>
    onChange(
      Object.fromEntries(
        items.map((f) => [f.key, { enabled: !allOn, adminManageable: value[f.key]?.adminManageable ?? false }]),
      ),
    );

  return (
    <div className="space-y-4">
      <button type="button" onClick={toggleAll} className="text-sm text-primary hover:underline">
        {allOn ? 'Clear all' : 'Select all'}
      </button>
      {groups.map((g) => (
        <div key={g}>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{g}</div>
          <div className="divide-y rounded-md border">
            {items
              .filter((f) => f.category === g)
              .map((f) => {
                const sel = value[f.key];
                return (
                  <div key={f.key} className="flex items-center justify-between gap-3 px-3 py-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!sel?.enabled}
                        onChange={(e) => set(f.key, { enabled: e.target.checked })}
                      />
                      <span>{f.name}</span>
                      {!f.isActive && <span className="text-xs text-destructive">(off platform-wide)</span>}
                    </label>
                    <label className={`flex items-center gap-1 text-xs ${sel?.enabled ? 'text-muted-foreground' : 'opacity-40'}`}>
                      <input
                        type="checkbox"
                        disabled={!sel?.enabled}
                        checked={!!sel?.adminManageable}
                        onChange={(e) => set(f.key, { adminManageable: e.target.checked })}
                      />
                      School admin can switch
                    </label>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
