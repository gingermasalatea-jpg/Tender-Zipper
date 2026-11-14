import { notFound } from 'next/navigation';
import { Clock, MapPin, Phone, Mail } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { withdrawQuote } from '@/app/actions/quotes';
import { FormDataView } from '@/components/FormDataView';
import { QuoteStatusBadge, TenderStatusBadge } from '@/components/StatusBadge';
import { SubmitButton } from '@/components/SubmitButton';
import { Alert, Badge, Card, LinkButton } from '@/components/ui';
import { budgetLabel, dateOnly, dateTime, publicMediaUrl, rupees, timeLeft } from '@/lib/format';
import { TENDER_TYPE_LABEL, type FormSchema, type FormValues, type LineItem, type QuoteSchema, type QuoteStatus, type TenderStatus, type TenderType } from '@/lib/types';
import { QuoteBuilder } from './QuoteBuilder';

interface Detail {
  id: string; code: string; title: string; description: string | null; category_name: string; tender_type: TenderType;
  form_data: FormValues; city_name: string; area_label: string; pincode: string; budget_min: number | null; budget_max: number | null;
  status: TenderStatus; quote_deadline: string; start_date: string | null; site_visit_allowed: boolean; quote_count: number; max_quotes: number;
  form_schema: FormSchema | null; quote_schema: QuoteSchema | null; media: { path: string; type: string }[];
  my_quote: null | { id: string; status: QuoteStatus; line_items: LineItem[]; extra: FormValues; gst_percent: number; subtotal: number; gst_amount: number; total: number;
    timeline_days: number | null; warranty_months: number | null; payment_terms: string | null; notes: string | null };
  contact: null | { name: string | null; phone: string | null; email: string | null; address: string | null };
}

export default async function VendorTenderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, vendor } = await requireVendor();
  const { data, error } = await supabase.rpc('vendor_tender_detail', { p_tender: id });
  if (error || !data) notFound();
  const t = data as Detail;
  const q = t.my_quote;
  const open = t.status === 'open' && new Date(t.quote_deadline) > new Date();
  const editable = open && (!q || q.status === 'draft' || q.status === 'submitted');
  const full = !q && t.quote_count >= t.max_quotes;

  const { data: contract } = q?.status === 'awarded' ? await supabase.from('contracts').select('id, code').eq('quote_id', q.id).maybeSingle() : { data: null };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-slate-500">{t.code} · {t.category_name}</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{t.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <TenderStatusBadge status={t.status} />
          <Badge tone="blue">{TENDER_TYPE_LABEL[t.tender_type]}</Badge>
          {q && <QuoteStatusBadge status={q.status} />}
          <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {t.area_label}, {t.city_name} {t.pincode}</span>
          {open && <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {timeLeft(t.quote_deadline)}</span>}
        </div>
      </div>

      {t.contact && (
        <Card className="border-emerald-200 bg-emerald-50">
          <p className="font-semibold text-emerald-900">{q?.status === 'awarded' ? '🎉 You won this tender!' : 'You are shortlisted — contact the buyer'}</p>
          <div className="mt-2 grid gap-1 text-sm text-emerald-900 sm:grid-cols-2">
            <p className="font-medium">{t.contact.name}</p>
            {t.contact.phone && <a href={`tel:${t.contact.phone}`} className="flex items-center gap-1"><Phone className="h-4 w-4" /> {t.contact.phone}</a>}
            {t.contact.email && <a href={`mailto:${t.contact.email}`} className="flex items-center gap-1"><Mail className="h-4 w-4" /> {t.contact.email}</a>}
            {t.contact.address && <p className="sm:col-span-2">{t.contact.address}</p>}
          </div>
          {contract && <LinkButton href={`/work-orders/${contract.id}`} className="mt-3" size="sm">Open work order {contract.code}</LinkButton>}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="mb-4 font-semibold">Requirement</h2>
            <FormDataView schema={t.form_schema} data={t.form_data} />
            {t.description && <p className="mt-4 whitespace-pre-line border-t border-slate-100 pt-4 text-sm text-slate-700">{t.description}</p>}
            {!!t.media.length && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {t.media.map((m) =>
                  m.type === 'video' ? (
                    <video key={m.path} src={publicMediaUrl('tender-media', m.path)} controls className="h-24 rounded-lg" />
                  ) : (
                    <a key={m.path} href={publicMediaUrl('tender-media', m.path)} target="_blank" rel="noreferrer">
                      <img src={publicMediaUrl('tender-media', m.path)} alt="" className="h-24 w-24 rounded-lg object-cover" />
                    </a>
                  ),
                )}
              </div>
            )}
          </Card>
          <Card className="space-y-2 text-sm">
            <p><span className="text-slate-500">Budget:</span> {budgetLabel(t.budget_min, t.budget_max)}</p>
            <p><span className="text-slate-500">Preferred start:</span> {dateOnly(t.start_date)}</p>
            <p><span className="text-slate-500">Quotes close:</span> {dateTime(t.quote_deadline)}</p>
            <p><span className="text-slate-500">Site visit:</span> {t.site_visit_allowed ? 'Allowed — request it via the buyer once shortlisted' : 'Not offered'}</p>
            <p><span className="text-slate-500">Competition:</span> {t.quote_count}/{t.max_quotes} quotes</p>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {vendor.is_suspended ? (
            <Alert>Your account is suspended, so you can&apos;t quote.</Alert>
          ) : editable && !full ? (
            <>
              <QuoteBuilder tenderId={t.id} schema={t.quote_schema} formData={t.form_data} existing={q} periodLabel={t.quote_schema?.period_label} />
              {q?.status === 'submitted' && (
                <form action={withdrawQuote} className="mt-3">
                  <input type="hidden" name="quote_id" value={q.id} />
                  <input type="hidden" name="tender_id" value={t.id} />
                  <SubmitButton variant="ghost" size="sm" confirm="Withdraw your quote? You won't be able to quote again on this tender.">Withdraw quote</SubmitButton>
                </form>
              )}
            </>
          ) : full ? (
            <Alert tone="amber">This tender has already received the maximum of {t.max_quotes} quotes.</Alert>
          ) : q ? (
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Your quote</h2>
                <QuoteStatusBadge status={q.status} />
              </div>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {q.line_items.map((l, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2">{l.label}<span className="block text-xs text-slate-500">{l.qty} {l.unit} × {rupees(l.rate)}</span></td>
                      <td className="py-2 text-right">{rupees(l.amount)}</td>
                    </tr>
                  ))}
                  <tr><td className="py-2 text-slate-500">GST {Number(q.gst_percent)}%</td><td className="py-2 text-right">{rupees(q.gst_amount)}</td></tr>
                  <tr className="font-bold"><td className="py-2">Total{t.quote_schema?.period_label ? ` ${t.quote_schema.period_label}` : ''}</td><td className="py-2 text-right">{rupees(q.total)}</td></tr>
                </tbody>
              </table>
            </Card>
          ) : (
            <Alert tone="amber">This tender is no longer accepting quotes.</Alert>
          )}
        </div>
      </div>
    </div>
  );
}
