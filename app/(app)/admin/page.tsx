import { requireAdmin } from '@/lib/auth';
import { AdminNav } from '@/components/AdminNav';
import { PageHeader } from '@/components/ui';
import { rupees } from '@/lib/format';

export const metadata = { title: 'Admin' };

export default async function AdminHome() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc('admin_stats');
  const s = (data ?? {}) as Record<string, number>;
  const cards: [string, string | number][] = [
    ['Open tenders', s.tenders_open],
    ['Total tenders', s.tenders_total],
    ['Awarded tenders', s.tenders_awarded],
    ['Quotes submitted', s.quotes_submitted],
    ['Awarded work value', rupees(s.awarded_value)],
    ['Buyers', s.buyers],
    ['Vendors', s.vendors],
    ['Verified vendors', s.verified_vendors],
    ['Documents to review', s.pending_documents],
    ['Flagged tenders', s.flagged_tenders],
  ];
  return (
    <div>
      <PageHeader title="Admin" subtitle="Platform health at a glance." />
      <AdminNav />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-extrabold text-brand-800">{value ?? 0}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
