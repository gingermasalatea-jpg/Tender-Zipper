import type { FormField, FormSchema, FormValues } from '@/lib/types';

export function isEmpty(v: unknown) {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

/** Keeps only known keys, coerces types and returns the first validation error (if any). */
export function cleanFormValues(schema: FormSchema | null | undefined, values: FormValues): { data: FormValues; error?: string } {
  const data: FormValues = {};
  for (const f of schema?.fields ?? []) {
    let v = values[f.key];
    switch (f.type) {
      case 'number':
        v = isEmpty(v) ? null : Number(v);
        if (v !== null && (Number.isNaN(v) || (v as number) < 0)) return { data, error: `${f.label}: enter a valid number` };
        break;
      case 'boolean':
        v = v === true || v === 'true';
        break;
      case 'multiselect':
        v = Array.isArray(v) ? v.filter((x) => f.options?.includes(String(x))) : [];
        break;
      case 'select':
        v = isEmpty(v) ? null : String(v);
        if (v !== null && f.options && !f.options.includes(v as string)) return { data, error: `${f.label}: choose a valid option` };
        break;
      case 'items': {
        const rows = Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
        v = rows
          .map((r) => Object.fromEntries((f.columns ?? []).map((c) => [c.key, c.type === 'number' ? Number(r[c.key] ?? 0) : String(r[c.key] ?? '').slice(0, 200)])))
          .filter((r) => Object.values(r).some((x) => x !== '' && x !== 0));
        break;
      }
      default:
        v = isEmpty(v) ? null : String(v).slice(0, f.type === 'textarea' ? 3000 : 300);
    }
    if (f.required && f.type !== 'boolean' && isEmpty(v)) return { data, error: `${f.label} is required` };
    data[f.key] = v;
  }
  return { data };
}

export function displayValue(field: FormField, value: unknown): string {
  if (isEmpty(value)) return '—';
  if (field.type === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  const s = String(value);
  return field.unit ? `${Number.isFinite(Number(s)) ? Number(s).toLocaleString('en-IN') : s} ${field.unit}` : s;
}
