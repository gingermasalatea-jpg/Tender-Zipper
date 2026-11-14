import { requireAdmin } from '@/lib/auth';
import { setTenderFlag } from '@/app/actions/admin';
import { AdminNav } from '@/components/AdminNav';
import { TenderStatusBadge } from '@/components/StatusBadge';
import { SubmitButton } from '@/components/SubmitButton';
import { Badge, PageHeader } from '@/components/ui';
import { dateTime } from '@/lib/format';
import type { TenderStatus } from '@/lib/types';

export const metadata = { title: 'Tender moderation' };

export default async function AdminTenders() {
  const { supabase } = await requireAdmin();
  const { data: tenders } = await supabase
    .from('tenders')
    .select('id, code, title, status, quote_count, area_label, is_flagged, flag_reason, created_at, categories(name)')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div>
      <PageHeader title="Tenders" subtitle="Remove spam, fake or prohibited tenders. Flagging also cancels the tender." />
      <AdminNav />
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Tender</th><th className="px-4 py-2">Quotes</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Posted</th><th /></tr></thead>
          <tbody>
            {(tenders ?? []).map((t) => (
              <tr key={t.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-2">
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-slate-500">{t.code} · {(t.categories as unknown as { name: string }).name} · {t.area_label}</p>
                  {t.is_flagged && <Badge tone="red" className="mt-1">Flagged: {t.flag_reason}</Badge>}
                </td>
                <td className="px-4 py-2">{t.quote_count}</td>
                <td className="px-4 py-2"><TenderStatusBadge status={t.status as TenderStatus} /></td>
                <td className="px-4 py-2 text-slate-500">{dateTime(t.created_at)}</td>
                <td className="px-4 py-2 text-right">
                  <form action={setTenderFlag} className="flex justify-end gap-2">
                    <input type="hidden" name="tender_id" value={t.id} />
                    <input type="hidden" name="flag" value={t.is_flagged ? '0' : '1'} />
                    {!t.is_flagged && <input name="reason" placeholder="Reason" className="w-28 rounded border border-slate-300 px-2 py-1 text-xs" />}
                    <SubmitButton variant={t.is_flagged ? 'ghost' : 'danger'} size="sm" confirm={t.is_flagged ? 'Unflag this tender?' : 'Flag and cancel this tender?'}>
                      {t.is_flagged ? 'Unflag' : 'Flag'}
                    </SubmitButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
