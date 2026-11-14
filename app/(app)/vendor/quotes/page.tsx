import Link from 'next/link';
import { requireVendor } from '@/lib/auth';
import { EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { QuoteStatusBadge } from '@/components/StatusBadge';
import { dateOnly, rupees } from '@/lib/format';
import type { FeedTender, QuoteStatus } from '@/lib/types';

export const metadata = { title: 'My quotes' };

export default async function MyQuotes() {
  const { supabase, vendor } = await requireVendor();
  const [{ data: feed }, { data: quotes }, { data: contracts }] = await Promise.all([
    supabase.rpc('vendor_feed', { p_category: null, p_search: null }),
    supabase.from('quotes').select('id, tender_id, status, total, submitted_at, updated_at').eq('vendor_id', vendor.id).order('updated_at', { ascending: false }),
    supabase.from('contracts').select('id, code, tender_id').eq('vendor_id', vendor.id),
  ]);
  const tenders = new Map(((feed ?? []) as FeedTender[]).map((t) => [t.id, t]));
  const list = quotes ?? [];

  const stats = {
    quoted: list.filter((q) => q.status !== 'draft').length,
    shortlisted: list.filter((q) => q.status === 'shortlisted' || q.status === 'awarded').length,
    won: list.filter((q) => q.status === 'awarded').length,
  };

  return (
    <div>
      <PageHeader title="My quotes" subtitle="Track every quote you've sent." />
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          ['Quoted', stats.quoted],
          ['Shortlisted', stats.shortlisted],
          ['Won', stats.won],
        ].map(([label, n]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <p className="text-2xl font-extrabold text-brand-700">{n}</p>
            <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
          </div>
        ))}
      </div>
      {!list.length ? (
        <EmptyState title="No quotes yet" text="Open a tender from your feed and send your first quote." action={<LinkButton href="/vendor">Browse tenders</LinkButton>} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-3">Tender</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Updated</th><th /></tr>
            </thead>
            <tbody>
              {list.map((q) => {
                const t = tenders.get(q.tender_id);
                const c = contracts?.find((x) => x.tender_id === q.tender_id);
                return (
                  <tr key={q.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link href={`/vendor/tenders/${q.tender_id}`} className="font-medium text-slate-900 hover:text-brand-700">{t?.title ?? 'Tender'}</Link>
                      <span className="block text-xs text-slate-500">{t ? `${t.code} · ${t.area_label}` : ''}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{rupees(q.total)}</td>
                    <td className="px-4 py-3"><QuoteStatusBadge status={q.status as QuoteStatus} /></td>
                    <td className="px-4 py-3 text-slate-500">{dateOnly(q.updated_at)}</td>
                    <td className="px-4 py-3 text-right">{c && <Link href={`/work-orders/${c.id}`} className="font-semibold text-brand-700">{c.code}</Link>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
