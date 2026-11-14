import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { TenderStatusBadge } from '@/components/StatusBadge';
import { dateOnly, timeLeft } from '@/lib/format';
import type { TenderStatus } from '@/lib/types';

export const metadata = { title: 'My tenders' };

const TABS: { key: string; label: string; statuses: TenderStatus[] }[] = [
  { key: 'active', label: 'Active', statuses: ['open', 'closed'] },
  { key: 'awarded', label: 'Awarded', statuses: ['awarded', 'completed'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
];

export default async function BuyerHome({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'active' } = await searchParams;
  const { supabase, user, profile } = await requireUser();
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];

  const { data: tenders } = await supabase
    .from('tenders')
    .select('id, code, title, status, quote_count, max_quotes, quote_deadline, area_label, created_at, categories(name)')
    .eq('buyer_id', user.id)
    .in('status', current.statuses)
    .order('created_at', { ascending: false });

  return (
    <div>
      <PageHeader
        title={`Hi ${profile.full_name?.split(' ')[0] ?? ''} 👋`}
        subtitle="Your tenders and the quotes you've received."
        action={
          <LinkButton href="/buyer/tenders/new">
            <Plus className="h-4 w-4" /> Post a tender
          </LinkButton>
        }
      />
      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/buyer?tab=${t.key}`} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${t.key === current.key ? 'bg-brand-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>
            {t.label}
          </Link>
        ))}
      </div>

      {!tenders?.length ? (
        <EmptyState
          title={current.key === 'active' ? 'No active tenders' : 'Nothing here yet'}
          text="Post a tender card and verified vendors in your area will send you comparable quotes."
          action={<LinkButton href="/buyer/tenders/new">Post your first tender</LinkButton>}
        />
      ) : (
        <div className="grid gap-3">
          {tenders.map((t) => {
            const cat = (t.categories as unknown as { name: string } | null)?.name;
            return (
              <Link key={t.id} href={`/buyer/tenders/${t.id}`} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-600 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">{t.code} · {cat} · {t.area_label}</p>
                  <p className="mt-0.5 font-semibold text-slate-900">{t.title}</p>
                  <p className="mt-1 text-xs text-slate-500">Posted {dateOnly(t.created_at)}{t.status === 'open' && ` · ${timeLeft(t.quote_deadline)}`}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm"><b className="text-lg text-brand-700">{t.quote_count}</b><span className="text-slate-500">/{t.max_quotes} quotes</span></span>
                  <TenderStatusBadge status={t.status as TenderStatus} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
