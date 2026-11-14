import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, Clock, FileText, MapPin } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { cancelTender, closeTenderEarly } from '@/app/actions/tenders';
import { CompareTable } from '@/components/CompareTable';
import { FormDataView } from '@/components/FormDataView';
import { TenderStatusBadge } from '@/components/StatusBadge';
import { SubmitButton } from '@/components/SubmitButton';
import { Alert, Badge, Card, EmptyState, LinkButton } from '@/components/ui';
import { budgetLabel, dateOnly, dateTime, publicMediaUrl, timeLeft } from '@/lib/format';
import { TENDER_TYPE_LABEL, type BuyerQuote, type FormSchema, type QuoteSchema, type Tender } from '@/lib/types';

export default async function BuyerTenderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ posted?: string; error?: string }> }) {
  const { id } = await params;
  const { posted, error } = await searchParams;
  const { supabase } = await requireUser();

  const { data: tender } = await supabase.from('tenders').select('*, categories(name), cities(name)').eq('id', id).maybeSingle();
  if (!tender) notFound();
  const t = tender as Tender & { categories: { name: string }; cities: { name: string } };

  const [{ data: tpl }, { data: media }, { data: quotesJson }, { data: contract }] = await Promise.all([
    supabase.from('category_templates').select('form_schema, quote_schema').eq('category_id', t.category_id).maybeSingle(),
    supabase.from('tender_media').select('file_path, media_type').eq('tender_id', id),
    supabase.rpc('buyer_tender_quotes', { p_tender: id }),
    supabase.from('contracts').select('id, code').eq('tender_id', id).maybeSingle(),
  ]);
  const quotes = (quotesJson ?? []) as BuyerQuote[];
  const canAct = t.status === 'open' || t.status === 'closed';

  return (
    <div className="space-y-6">
      {posted && <Alert tone="green">Your tender is live! Matching verified vendors have been notified. You&apos;ll get a notification for every quote.</Alert>}
      {error && <Alert>{error}</Alert>}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">{t.code} · {t.categories.name}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{t.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <TenderStatusBadge status={t.status} />
            <Badge tone="blue">{TENDER_TYPE_LABEL[t.tender_type]}</Badge>
            <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {t.area_label}, {t.cities.name} {t.pincode}</span>
            {t.status === 'open' && <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {timeLeft(t.quote_deadline)}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {contract && <LinkButton href={`/work-orders/${contract.id}`}><FileText className="h-4 w-4" /> Work order {contract.code}</LinkButton>}
          {t.status === 'open' && quotes.length > 0 && (
            <form action={closeTenderEarly}>
              <input type="hidden" name="tender_id" value={t.id} />
              <SubmitButton variant="outline" confirm="Stop accepting new quotes now?">Stop new quotes</SubmitButton>
            </form>
          )}
          {canAct && (
            <form action={cancelTender}>
              <input type="hidden" name="tender_id" value={t.id} />
              <SubmitButton variant="ghost" confirm="Cancel this tender? Vendors will no longer be able to quote.">Cancel tender</SubmitButton>
            </form>
          )}
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-bold text-slate-900">Quotes ({quotes.length}/{t.max_quotes})</h2>
          {quotes.length > 0 && canAct && <p className="text-xs text-slate-500">Shortlist up to 3 to unlock their contact details, then award one.</p>}
        </div>
        {quotes.length ? (
          <CompareTable tenderId={t.id} quotes={quotes} quoteSchema={(tpl?.quote_schema as QuoteSchema) ?? null} canAct={canAct} />
        ) : (
          <EmptyState title="Waiting for quotes" text="Vendors have been notified. Most tenders receive their first quotes within a few hours." />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-semibold">Requirement</h2>
          <FormDataView schema={(tpl?.form_schema as FormSchema) ?? null} data={t.form_data} />
          {t.description && <p className="mt-4 whitespace-pre-line border-t border-slate-100 pt-4 text-sm text-slate-700">{t.description}</p>}
          {!!media?.length && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {media.map((m) =>
                m.media_type === 'video' ? (
                  <video key={m.file_path} src={publicMediaUrl('tender-media', m.file_path)} controls className="h-28 rounded-lg" />
                ) : (
                  <a key={m.file_path} href={publicMediaUrl('tender-media', m.file_path)} target="_blank" rel="noreferrer">
                    <img src={publicMediaUrl('tender-media', m.file_path)} alt="" className="h-28 w-28 rounded-lg object-cover" />
                  </a>
                ),
              )}
            </div>
          )}
        </Card>
        <Card className="space-y-3 text-sm">
          <h2 className="font-semibold">Details</h2>
          <p><span className="text-slate-500">Budget:</span> {budgetLabel(t.budget_min, t.budget_max)} {!t.budget_visible && <span className="text-xs text-slate-400">(hidden from vendors)</span>}</p>
          <p className="flex items-center gap-1"><CalendarDays className="h-4 w-4 text-slate-400" /> Start: {dateOnly(t.start_date)}</p>
          <p><span className="text-slate-500">Quotes close:</span> {dateTime(t.quote_deadline)}</p>
          <p><span className="text-slate-500">Site visits:</span> {t.site_visit_allowed ? 'Allowed' : 'Not allowed'}</p>
          {t.address && <p><span className="text-slate-500">Address (private):</span> {t.address}</p>}
          <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">Posted {dateTime(t.created_at)}. <Link href="/buyer" className="text-brand-700">All tenders</Link></p>
        </Card>
      </div>
    </div>
  );
}
