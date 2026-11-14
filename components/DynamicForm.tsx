'use client';
import { Plus, Trash2 } from 'lucide-react';
import { Field, inputClass } from '@/components/ui';
import type { FormField, FormValues } from '@/lib/types';

/** Renders any category template (form_schema.fields) as a controlled form. */
export function DynamicForm({ fields, values, onChange }: { fields: FormField[]; values: FormValues; onChange: (v: FormValues) => void }) {
  const set = (key: string, v: unknown) => onChange({ ...values, [key]: v });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => {
        const v = values[f.key];
        const wide = f.type === 'textarea' || f.type === 'items' || f.type === 'multiselect';
        if (f.type === 'boolean') {
          return (
            <label key={f.key} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm sm:col-span-1">
              <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={v === true} onChange={(e) => set(f.key, e.target.checked)} />
              <span className="font-medium text-slate-800">{f.label}</span>
            </label>
          );
        }
        return (
          <Field key={f.key} label={f.unit ? `${f.label} (${f.unit})` : f.label} required={f.required} help={f.help} className={wide ? 'sm:col-span-2' : ''}>
            {f.type === 'select' ? (
              <select className={inputClass} value={(v as string) ?? ''} onChange={(e) => set(f.key, e.target.value)} required={f.required}>
                <option value="">Select…</option>
                {f.options?.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : f.type === 'multiselect' ? (
              <div className="flex flex-wrap gap-2">
                {f.options?.map((o) => {
                  const arr = Array.isArray(v) ? (v as string[]) : [];
                  const on = arr.includes(o);
                  return (
                    <button
                      type="button"
                      key={o}
                      onClick={() => set(f.key, on ? arr.filter((x) => x !== o) : [...arr, o])}
                      className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            ) : f.type === 'textarea' ? (
              <textarea className={inputClass} rows={3} value={(v as string) ?? ''} onChange={(e) => set(f.key, e.target.value)} required={f.required} />
            ) : f.type === 'items' ? (
              <ItemsTable field={f} rows={Array.isArray(v) ? (v as Record<string, unknown>[]) : []} onChange={(rows) => set(f.key, rows)} />
            ) : (
              <input
                className={inputClass}
                type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                min={f.type === 'number' ? 0 : undefined}
                step="any"
                value={(v as string | number | undefined) ?? ''}
                onChange={(e) => set(f.key, e.target.value)}
                required={f.required}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}

function ItemsTable({ field, rows, onChange }: { field: FormField; rows: Record<string, unknown>[]; onChange: (r: Record<string, unknown>[]) => void }) {
  const cols = field.columns ?? [];
  const list = rows.length ? rows : [{}];
  const update = (i: number, key: string, val: string) => onChange(list.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));

  return (
    <div className="space-y-2">
      {list.map((row, i) => (
        <div key={i} className="flex gap-2">
          {cols.map((c) => (
            <input
              key={c.key}
              className={`${inputClass} ${c.type === 'number' ? 'w-20 shrink-0' : ''}`}
              type={c.type === 'number' ? 'number' : 'text'}
              min={0}
              placeholder={c.placeholder ?? c.label}
              aria-label={c.label}
              value={(row[c.key] as string) ?? ''}
              onChange={(e) => update(i, c.key, e.target.value)}
            />
          ))}
          <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => onChange(list.filter((_, idx) => idx !== i))} aria-label="Remove row">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button type="button" className="flex items-center gap-1 text-sm font-semibold text-brand-700" onClick={() => onChange([...list, {}])}>
        <Plus className="h-4 w-4" /> Add item
      </button>
    </div>
  );
}
