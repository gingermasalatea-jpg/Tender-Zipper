import { BadgeCheck, Phone, Mail, Star, Trophy, AlertTriangle } from 'lucide-react';
import { awardQuote, shortlistQuote } from '@/app/actions/tenders';
import { Badge } from '@/components/ui';
import { QuoteStatusBadge } from '@/components/StatusBadge';
import { SubmitButton } from '@/components/SubmitButton';
import { displayValue } from '@/lib/forms';
import { rupees } from '@/lib/format';
import type { BuyerQuote, QuoteSchema } from '@/lib/types';

function lineKey(l: { key: string; label: string }) {
  return `${l.key}::${l.label}`;
}

/** Side-by-side comparison of all quotes on a tender. Vendors = columns, line items = rows. */
export function CompareTable({ tenderId, quotes, quoteSchema, canAct }: { tenderId: string; quotes: BuyerQuote[]; quoteSchema: QuoteSchema | null; canAct: boolean }) {
  const rows: { id: string; label: string; unit: string }[] = [];
  for (const q of quotes)
    for (const l of q.line_items)
      if (!rows.some((r) => r.id === lineKey(l))) rows.push({ id: lineKey(l), label: l.label, unit: l.unit });

  const totals = quotes.map((q) => Number(q.total));
  const lowest = Math.min(...totals);
  const sorted = [...totals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const fastest = Math.min(...quotes.map((q) => q.timeline_days ?? Infinity));
  const period = quoteSchema?.period_label ? ` ${quoteSchema.period_label}` : '';
  const shortlistedCount = quotes.filter((q) => q.status === 'shortlisted').length;

  const lowestFor = (rowId: string) => {
    const amounts = quotes.map((q) => q.line_items.find((l) => lineKey(l) === rowId)?.amount).filter((a): a is number => a != null && a > 0);
    return amounts.length > 1 ? Math.min(...amounts) : null;
  };

  const th = 'sticky left-0 z-10 bg-slate-50 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[150px]';
  const td = 'px-3 py-2.5 align-top text-sm min-w-[190px]';

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-200">
            <th className={th}>Vendor</th>
            {quotes.map((q) => (
              <th key={q.id} className={`${td} text-left`}>
                <p className="font-bold text-slate-900">{q.vendor.business_name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {q.vendor.verified ? <Badge tone="green"><BadgeCheck className="h-3 w-3" /> Verified</Badge> : <Badge>Unverified</Badge>}
                  <QuoteStatusBadge status={q.status} />
                </div>
                <p className="mt-1 text-xs font-normal text-slate-500">
                  {q.vendor.type === 'agency' ? 'Agency' : 'Individual'}
                  {q.vendor.years_experience != null && ` · ${q.vendor.years_experience} yrs exp`}
                  {` · ${q.vendor.completed_jobs} jobs done`}
                </p>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const low = lowestFor(r.id);
            return (
              <tr key={r.id} className="border-b border-slate-100">
                <th className={th}>
                  <span className="normal-case text-slate-700">{r.label}</span>
                  {r.unit && <span className="block normal-case font-normal">per {r.unit}</span>}
                </th>
                {quotes.map((q) => {
                  const l = q.line_items.find((x) => lineKey(x) === r.id);
                  return (
                    <td key={q.id} className={td}>
                      {l ? (
                        <>
                          <span className={l.amount === low ? 'font-bold text-emerald-700' : 'font-medium'}>{rupees(l.amount)}</span>
                          <span className="block text-xs text-slate-500">{l.qty.toLocaleString('en-IN')} × {rupees(l.rate)}</span>
                        </>
                      ) : (
                        <span className="text-slate-400">Not quoted</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr className="border-b border-slate-100">
            <th className={th}>Subtotal</th>
            {quotes.map((q) => <td key={q.id} className={td}>{rupees(q.subtotal)}</td>)}
          </tr>
          <tr className="border-b border-slate-100">
            <th className={th}>GST</th>
            {quotes.map((q) => <td key={q.id} className={td}>{rupees(q.gst_amount)} <span className="text-xs text-slate-500">({Number(q.gst_percent)}%)</span></td>)}
          </tr>
          <tr className="border-b border-slate-200 bg-brand-50/50">
            <th className={`${th} bg-brand-50`}>Total{period}</th>
            {quotes.map((q) => (
              <td key={q.id} className={td}>
                <span className={`text-lg font-extrabold ${Number(q.total) === lowest ? 'text-emerald-700' : 'text-slate-900'}`}>{rupees(q.total)}</span>
                {Number(q.total) === lowest && quotes.length > 1 && <Badge tone="green" className="ml-1"><Trophy className="h-3 w-3" /> Lowest</Badge>}
                {quotes.length >= 3 && Number(q.total) < median * 0.7 && (
                  <span className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700"><AlertTriangle className="h-3 w-3" /> Unusually low — check scope & materials</span>
                )}
              </td>
            ))}
          </tr>
          <tr className="border-b border-slate-100">
            <th className={th}>Timeline</th>
            {quotes.map((q) => (
              <td key={q.id} className={td}>
                {q.timeline_days ? `${q.timeline_days} days` : '—'} {q.timeline_days === fastest && quotes.length > 1 && <Badge tone="blue">Fastest</Badge>}
              </td>
            ))}
          </tr>
          <tr className="border-b border-slate-100">
            <th className={th}>Warranty</th>
            {quotes.map((q) => <td key={q.id} className={td}>{q.warranty_months ? `${q.warranty_months} months` : '—'}</td>)}
          </tr>
          {(quoteSchema?.extra_fields ?? []).map((f) => (
            <tr key={f.key} className="border-b border-slate-100">
              <th className={th}><span className="normal-case">{f.label}</span></th>
              {quotes.map((q) => <td key={q.id} className={`${td} whitespace-pre-line`}>{displayValue(f, q.extra?.[f.key])}</td>)}
            </tr>
          ))}
          <tr className="border-b border-slate-100">
            <th className={th}>Payment terms</th>
            {quotes.map((q) => <td key={q.id} className={`${td} whitespace-pre-line`}>{q.payment_terms || '—'}</td>)}
          </tr>
          <tr className="border-b border-slate-100">
            <th className={th}>Notes</th>
            {quotes.map((q) => <td key={q.id} className={`${td} whitespace-pre-line text-slate-600`}>{q.notes || '—'}</td>)}
          </tr>
          <tr className="border-b border-slate-100">
            <th className={th}>Contact</th>
            {quotes.map((q) => (
              <td key={q.id} className={td}>
                {q.vendor.phone ? (
                  <div className="space-y-1">
                    <p className="font-medium">{q.vendor.contact_name}</p>
                    <a href={`tel:${q.vendor.phone}`} className="flex items-center gap-1 text-brand-700"><Phone className="h-3.5 w-3.5" /> {q.vendor.phone}</a>
                    <a href={`https://wa.me/${q.vendor.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="block text-xs font-semibold text-emerald-700">WhatsApp</a>
                    {q.vendor.email && <a href={`mailto:${q.vendor.email}`} className="flex items-center gap-1 text-xs text-slate-600"><Mail className="h-3 w-3" /> {q.vendor.email}</a>}
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">Shortlist to unlock contact</span>
                )}
              </td>
            ))}
          </tr>
          {canAct && (
            <tr>
              <th className={th}>Action</th>
              {quotes.map((q) => (
                <td key={q.id} className={`${td} space-y-2`}>
                  {q.status === 'submitted' && shortlistedCount < 3 && (
                    <form action={shortlistQuote}>
                      <input type="hidden" name="quote_id" value={q.id} />
                      <input type="hidden" name="tender_id" value={tenderId} />
                      <SubmitButton variant="outline" size="sm" className="w-full"><Star className="h-4 w-4" /> Shortlist</SubmitButton>
                    </form>
                  )}
                  {q.status === 'shortlisted' && (
                    <form action={shortlistQuote}>
                      <input type="hidden" name="quote_id" value={q.id} />
                      <input type="hidden" name="tender_id" value={tenderId} />
                      <input type="hidden" name="undo" value="1" />
                      <SubmitButton variant="ghost" size="sm" className="w-full">Remove from shortlist</SubmitButton>
                    </form>
                  )}
                  {(q.status === 'submitted' || q.status === 'shortlisted') && (
                    <form action={awardQuote}>
                      <input type="hidden" name="quote_id" value={q.id} />
                      <input type="hidden" name="tender_id" value={tenderId} />
                      <SubmitButton size="sm" className="w-full" confirm={`Award this tender to ${q.vendor.business_name} for ${rupees(q.total)}? Other vendors will be informed.`}>
                        <Trophy className="h-4 w-4" /> Award
                      </SubmitButton>
                    </form>
                  )}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
