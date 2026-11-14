'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { saveQuote } from '@/app/actions/quotes';
import { DynamicForm } from '@/components/DynamicForm';
import { Alert, Button, Card, Field, inputClass } from '@/components/ui';
import { rupees } from '@/lib/format';
import type { FormValues, LineItem, QuoteSchema } from '@/lib/types';

interface Existing {
  status: string;
  line_items: LineItem[];
  extra: FormValues;
  gst_percent: number;
  timeline_days: number | null;
  warranty_months: number | null;
  payment_terms: string | null;
  notes: string | null;
}

type Row = { key: string; label: string; unit: string; qty: string; rate: string; fixed: boolean };

/** Builds the starting rows from the category's quote template and the buyer's answers. */
function initialRows(schema: QuoteSchema | null, formData: FormValues, existing: Existing | null): Row[] {
  if (existing?.line_items?.length) {
    return existing.line_items.map((l) => ({ key: l.key, label: l.label, unit: l.unit, qty: String(l.qty), rate: String(l.rate), fixed: l.key !== 'custom' }));
  }
  const rows: Row[] = [];
  if (schema?.items_from && Array.isArray(formData[schema.items_from])) {
    (formData[schema.items_from] as Record<string, unknown>[]).forEach((r, i) => {
      const label = [r.item, r.spec].filter(Boolean).join(' — ');
      if (label) rows.push({ key: `item_${i}`, label: label.slice(0, 120), unit: 'nos', qty: String(r.qty ?? 1), rate: '', fixed: true });
    });
  }
  for (const l of schema?.line_items ?? []) {
    const fromForm = l.qty_from ? Number(formData[l.qty_from]) : NaN;
    const qty = Number.isFinite(fromForm) && fromForm > 0 ? fromForm : l.qty ?? '';
    rows.push({ key: l.key, label: l.label, unit: l.unit ?? '', qty: String(qty), rate: '', fixed: true });
  }
  if (!rows.length) rows.push({ key: 'custom', label: '', unit: '', qty: '1', rate: '', fixed: false });
  return rows;
}

export function QuoteBuilder({ tenderId, schema, formData, existing, periodLabel }: {
  tenderId: string;
  schema: QuoteSchema | null;
  formData: FormValues;
  existing: Existing | null;
  periodLabel?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => initialRows(schema, formData, existing));
  const [gst, setGst] = useState<number>(existing ? Number(existing.gst_percent) : schema?.gst_default ?? 18);
  const [timeline, setTimeline] = useState(existing?.timeline_days ? String(existing.timeline_days) : '');
  const [warranty, setWarranty] = useState(existing?.warranty_months != null ? String(existing.warranty_months) : '');
  const [terms, setTerms] = useState(existing?.payment_terms ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [extra, setExtra] = useState<FormValues>(existing?.extra ?? {});
  const [busy, setBusy] = useState<'draft' | 'submit' | null>(null);
  const [msg, setMsg] = useState<{ tone: 'red' | 'green'; text: string } | null>(null);
  const submitted = existing?.status === 'submitted';

  const amounts = rows.map((r) => Math.round((Number(r.qty) || 0) * (Number(r.rate) || 0) * 100) / 100);
  const subtotal = amounts.reduce((a, b) => a + b, 0);
  const gstAmount = Math.round(subtotal * gst) / 100;
  const total = subtotal + gstAmount;
  const period = periodLabel ? ` ${periodLabel}` : '';

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const contractMonths = useMemo(() => Number(formData.contract_months) || null, [formData]);

  async function save(submit: boolean) {
    setMsg(null);
    if (submit && rows.some((r) => r.label.trim() && Number(r.qty) > 0 && !(Number(r.rate) > 0))) {
      if (!window.confirm('Some line items have no rate and will be quoted at ₹0. Continue?')) return;
    }
    setBusy(submit ? 'submit' : 'draft');
    const res = await saveQuote(
      tenderId,
      {
        line_items: rows.filter((r) => r.label.trim()).map((r) => ({ key: r.fixed ? r.key : 'custom', label: r.label.trim(), unit: r.unit, qty: Number(r.qty) || 0, rate: Number(r.rate) || 0 })),
        extra,
        gst_percent: gst,
        timeline_days: timeline ? Number(timeline) : null,
        warranty_months: warranty ? Number(warranty) : null,
        payment_terms: terms,
        notes,
      },
      submit,
    );
    setBusy(null);
    if (res.error) setMsg({ tone: 'red', text: res.error });
    else {
      setMsg({ tone: 'green', text: res.ok! });
      router.refresh();
    }
  }

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{submitted ? 'Update your quote' : 'Your quotation'}</h2>
        <p className="text-sm text-slate-600">
          Every vendor quotes the same line items so the buyer can compare fairly. Prices are{period || ' for the full job'}.
          {submitted && ' You can revise until quotes close.'}
        </p>
      </div>

      <div className="space-y-3">
        <div className="hidden grid-cols-12 gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
          <span className="col-span-5">Item</span><span className="col-span-2">Qty</span><span className="col-span-2">Rate (₹)</span><span className="col-span-2 text-right">Amount</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-100 p-2 sm:border-0 sm:p-0">
            <div className="col-span-12 sm:col-span-5">
              {r.fixed ? (
                <p className="text-sm font-medium text-slate-800">{r.label}<span className="block text-xs font-normal text-slate-500">per {r.unit}</span></p>
              ) : (
                <div className="flex gap-1">
                  <input className={inputClass} placeholder="Item description" value={r.label} onChange={(e) => update(i, { label: e.target.value })} maxLength={120} />
                  <input className={`${inputClass} w-20`} placeholder="unit" value={r.unit} onChange={(e) => update(i, { unit: e.target.value })} maxLength={20} />
                </div>
              )}
            </div>
            <input className={`${inputClass} col-span-4 sm:col-span-2`} type="number" min={0} step="any" placeholder="Qty" aria-label="Quantity" value={r.qty} onChange={(e) => update(i, { qty: e.target.value })} />
            <input className={`${inputClass} col-span-4 sm:col-span-2`} type="number" min={0} step="any" placeholder="Rate" aria-label="Rate" value={r.rate} onChange={(e) => update(i, { rate: e.target.value })} />
            <span className="col-span-3 text-right text-sm font-semibold sm:col-span-2">{rupees(amounts[i])}</span>
            <button type="button" className="col-span-1 justify-self-end rounded p-1 text-slate-400 hover:text-red-600" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} aria-label="Remove line">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {schema?.allow_custom_items !== false && (
          <button type="button" className="flex items-center gap-1 text-sm font-semibold text-brand-700" onClick={() => setRows((rs) => [...rs, { key: 'custom', label: '', unit: '', qty: '1', rate: '', fixed: false }])}>
            <Plus className="h-4 w-4" /> Add line item
          </button>
        )}
      </div>

      <div className="space-y-1 rounded-lg bg-slate-50 p-4 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>{rupees(subtotal)}</span></div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            GST
            <select className="rounded border border-slate-300 bg-white px-1 py-0.5 text-sm" value={gst} onChange={(e) => setGst(Number(e.target.value))}>
              {[0, 5, 12, 18, 28].map((g) => <option key={g} value={g}>{g}%</option>)}
            </select>
          </span>
          <span>{rupees(gstAmount)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-extrabold text-brand-900"><span>Total{period}</span><span>{rupees(total)}</span></div>
        {periodLabel && contractMonths && (
          <p className="text-xs text-slate-500">≈ {rupees(total * contractMonths)} for the {contractMonths}-month contract</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={periodLabel ? 'Can start within (days)' : 'Completion time (days)'} required>
          <input className={inputClass} type="number" min={1} value={timeline} onChange={(e) => setTimeline(e.target.value)} />
        </Field>
        <Field label="Warranty / guarantee (months)">
          <input className={inputClass} type="number" min={0} value={warranty} onChange={(e) => setWarranty(e.target.value)} />
        </Field>
      </div>
      {!!schema?.extra_fields?.length && <DynamicForm fields={schema.extra_fields} values={extra} onChange={setExtra} />}
      <Field label="Payment terms" help="e.g. 30% advance, 40% midway, 30% on completion">
        <textarea className={inputClass} rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} maxLength={1000} />
      </Field>
      <Field label="Notes for the buyer">
        <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="What's included, what's not, why choose you…" />
      </Field>

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => save(true)} disabled={!!busy}>{busy === 'submit' ? 'Submitting…' : submitted ? 'Update quote' : 'Submit quote'}</Button>
        {!submitted && <Button type="button" variant="outline" onClick={() => save(false)} disabled={!!busy}>{busy === 'draft' ? 'Saving…' : 'Save draft'}</Button>}
      </div>
      <p className="text-xs text-slate-500">Your contact details are shared with the buyer only if they shortlist you. Zero commission on the work you win.</p>
    </Card>
  );
}
