import Link from 'next/link';
import { Clock, MapPin, Search, ShieldAlert } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { Alert, Badge, EmptyState, inputClass, LinkButton, PageHeader } from '@/components/ui';
import { QuoteStatusBadge } from '@/components/StatusBadge';
import { budgetLabel, timeLeft } from '@/lib/format';
import { TENDER_TYPE_LABEL, type FeedTender } from '@/lib/types';

export const metadata = { title: 'Tender feed' };

export default async function VendorFeed({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q, category } = await searchParams;
  const { supabase, vendor } = await requireVendor();

  const [{ data: feed }, { data: myCats }, { count: docCount }] = await Promise.all([
    supabase.rpc('vendor_feed', { p_category: category ? Number(category) : null, p_search: q || null }),
    supabase.from('vendor_categories').select('category_id, categories(name)').eq('vendor_id', vendor.id),
    supabase.from('vendor_documents').select('id', { count: 'exact', head: true }).eq('vendor_id', vendor.id),
  ]);
  const tenders = ((feed ?? []) as FeedTender[]).filter((t) => !t.my_quote_status || t.my_quote_status === 'draft');

  return (
    <div>
      <PageHeader title="Tender feed" subtitle={`Open tenders matching ${vendor.business_name}'s services and areas.`} />

      {vendor.is_suspended && <div className="mb-4"><Alert>Your account is suspended. Please contact support.</Alert></div>}
      {vendor.verification_level < 1 && (
        <div className="mb-4">
          <Alert tone="amber">
            <span className="flex flex-wrap items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              {docCount ? 'Your documents are under review.' : 'Get the Verified badge — buyers shortlist verified vendors far more often.'}
              {!docCount && <Link href="/vendor/profile#documents" className="font-semibold underline">Upload documents</Link>}
            </span>
          </Alert>
        </div>
      )}

      <form className="mb-5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="Search title or area" className={`${inputClass} pl-9`} />
        </div>
        <select name="category" defaultValue={category ?? ''} className={`${inputClass} sm:w-56`}>
          <option value="">All my services</option>
          {(myCats ?? []).map((c) => (
            <option key={c.category_id} value={c.category_id}>{(c.categories as unknown as { name: string }).name}</option>
          ))}
        </select>
        <button className="rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white">Filter</button>
      </form>

      {!tenders.length ? (
        <EmptyState
          title="No open tenders right now"
          text="We'll notify you the moment a matching tender is posted. Adding more services or a wider service area brings more tenders."
          action={<LinkButton href="/vendor/profile" variant="outline">Edit services & areas</LinkButton>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {tenders.map((t) => (
            <Link key={t.id} href={`/vendor/tenders/${t.id}`} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-600 hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold text-slate-500">{t.code} · {t.category_name}</p>
                {t.my_quote_status ? <QuoteStatusBadge status={t.my_quote_status} /> : <Badge tone="blue">{TENDER_TYPE_LABEL[t.tender_type]}</Badge>}
              </div>
              <p className="mt-1 font-semibold text-slate-900">{t.title}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {t.area_label}, {t.city_name}</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {timeLeft(t.quote_deadline)}</span>
                <span>Budget: {budgetLabel(t.budget_min, t.budget_max)}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{t.quote_count}/{t.max_quotes} quotes so far</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
