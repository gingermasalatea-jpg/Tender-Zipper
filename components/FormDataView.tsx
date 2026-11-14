import { displayValue } from '@/lib/forms';
import type { FormSchema, FormValues } from '@/lib/types';

/** Read-only view of a tender's answers using its template labels. */
export function FormDataView({ schema, data }: { schema: FormSchema | null; data: FormValues }) {
  const fields = schema?.fields ?? [];
  if (!fields.length) return null;
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {fields.map((f) =>
        f.type === 'items' ? (
          <div key={f.key} className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{f.label}</dt>
            <dd className="mt-1 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    {(f.columns ?? []).map((c) => (
                      <th key={c.key} className="py-1 pr-4 font-medium">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(data[f.key]) ? (data[f.key] as Record<string, unknown>[]) : []).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {(f.columns ?? []).map((c) => (
                        <td key={c.key} className="py-1.5 pr-4">{String(r[c.key] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </dd>
          </div>
        ) : (
          <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{f.label}</dt>
            <dd className="mt-0.5 whitespace-pre-line text-sm text-slate-900">{displayValue(f, data[f.key])}</dd>
          </div>
        ),
      )}
    </dl>
  );
}
