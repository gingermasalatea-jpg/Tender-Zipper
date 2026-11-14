import { requireAdmin } from '@/lib/auth';
import { reviewDocument, setVendorSuspended } from '@/app/actions/admin';
import { AdminNav } from '@/components/AdminNav';
import { DocStatusBadge } from '@/components/StatusBadge';
import { SubmitButton } from '@/components/SubmitButton';
import { Badge, Card, EmptyState, inputClass, PageHeader } from '@/components/ui';
import { dateOnly } from '@/lib/format';
import { DOC_TYPES, type DocStatus } from '@/lib/types';

export const metadata = { title: 'KYC review' };

export default async function KycPage() {
  const { supabase } = await requireAdmin();
  const [{ data: docs }, { data: vendors }] = await Promise.all([
    supabase.from('vendor_documents').select('*, vendors(business_name, gstin)').eq('status', 'pending').order('created_at'),
    supabase.from('vendors').select('id, business_name, type, verification_level, is_suspended, created_at').order('created_at', { ascending: false }).limit(100),
  ]);
  const signed = await Promise.all(
    (docs ?? []).map(async (d) => (await supabase.storage.from('vendor-docs').createSignedUrl(d.file_path, 600)).data?.signedUrl ?? null),
  );

  return (
    <div>
      <PageHeader title="KYC & vendors" />
      <AdminNav />
      <h2 className="mb-3 font-semibold">Pending documents ({docs?.length ?? 0})</h2>
      {!docs?.length ? (
        <EmptyState title="No documents waiting" />
      ) : (
        <div className="grid gap-3">
          {docs.map((d, i) => {
            const v = d.vendors as unknown as { business_name: string; gstin: string | null };
            return (
              <Card key={d.id} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm">
                  <p className="font-semibold">{v.business_name}</p>
                  <p className="text-slate-600">{DOC_TYPES.find((x) => x.value === d.doc_type)?.label ?? d.doc_type} · uploaded {dateOnly(d.created_at)}{v.gstin ? ` · GSTIN ${v.gstin}` : ''}</p>
                  {signed[i] && <a href={signed[i]!} target="_blank" rel="noreferrer" className="font-semibold text-brand-700">Open document ↗</a>}
                </div>
                <form action={reviewDocument} className="flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="doc_id" value={d.id} />
                  <input name="note" placeholder="Note (optional / reason)" className={`${inputClass} sm:w-56`} />
                  <button name="status" value="verified" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Verify</button>
                  <button name="status" value="rejected" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">Reject</button>
                </form>
              </Card>
            );
          })}
        </div>
      )}

      <h2 className="mb-3 mt-8 font-semibold">Recent vendors</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Vendor</th><th className="px-4 py-2">Joined</th><th className="px-4 py-2">Status</th><th /></tr></thead>
          <tbody>
            {(vendors ?? []).map((v) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{v.business_name} <span className="text-xs text-slate-500">({v.type})</span></td>
                <td className="px-4 py-2 text-slate-500">{dateOnly(v.created_at)}</td>
                <td className="px-4 py-2 space-x-1">
                  {v.verification_level >= 1 ? <DocStatusBadge status={'verified' as DocStatus} /> : <Badge>Unverified</Badge>}
                  {v.is_suspended && <Badge tone="red">Suspended</Badge>}
                </td>
                <td className="px-4 py-2 text-right">
                  <form action={setVendorSuspended}>
                    <input type="hidden" name="vendor_id" value={v.id} />
                    <input type="hidden" name="suspend" value={v.is_suspended ? '0' : '1'} />
                    <SubmitButton variant="ghost" size="sm" confirm={v.is_suspended ? 'Restore this vendor?' : 'Suspend this vendor? They will stop receiving tenders.'}>
                      {v.is_suspended ? 'Restore' : 'Suspend'}
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
