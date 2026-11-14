import { BadgeCheck } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { loadCatalog } from '@/lib/catalog';
import { deleteVendorDocument } from '@/app/actions/vendor';
import { Badge, Card, PageHeader } from '@/components/ui';
import { DocStatusBadge } from '@/components/StatusBadge';
import { SubmitButton } from '@/components/SubmitButton';
import { dateOnly } from '@/lib/format';
import { DOC_TYPES, type DocStatus } from '@/lib/types';
import { VendorProfileForm } from './VendorProfileForm';
import { DocumentUpload } from './DocumentUpload';

export const metadata = { title: 'Profile & KYC' };

export default async function VendorProfilePage() {
  const { supabase, user, vendor } = await requireVendor();
  const [{ cities, groups }, { data: cats }, { data: areas }, { data: docs }] = await Promise.all([
    loadCatalog(supabase),
    supabase.from('vendor_categories').select('category_id').eq('vendor_id', vendor.id),
    supabase.from('vendor_service_areas').select('pincode').eq('vendor_id', vendor.id),
    supabase.from('vendor_documents').select('*').eq('vendor_id', vendor.id).order('created_at', { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={vendor.business_name}
        subtitle="Your services, service area and verification documents."
        action={vendor.verification_level >= 1 ? <Badge tone="green"><BadgeCheck className="h-4 w-4" /> Verified vendor</Badge> : <Badge tone="amber">Not verified yet</Badge>}
      />
      <VendorProfileForm
        vendor={vendor}
        cities={cities}
        selected={(cats ?? []).map((c) => c.category_id)}
        pincodes={(areas ?? []).map((a) => a.pincode).filter(Boolean).join(', ')}
        groups={groups.map((g) => ({ sector: g.sector.name, subs: g.categories.flatMap((c) => c.subs.map((s) => ({ id: s.id, name: s.name }))) }))}
      />

      <Card id="documents" className="space-y-4">
        <div>
          <h2 className="font-semibold">Verification documents</h2>
          <p className="text-sm text-slate-600">Upload at least one business document (GST, Udyam or PAN). Our team reviews within 1 working day. Documents are private and never shown to buyers.</p>
        </div>
        <DocumentUpload userId={user.id} />
        {!!docs?.length && (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{DOC_TYPES.find((x) => x.value === d.doc_type)?.label ?? d.doc_type}</p>
                  <p className="text-xs text-slate-500">Uploaded {dateOnly(d.created_at)}{d.review_note ? ` · ${d.review_note}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <DocStatusBadge status={d.status as DocStatus} />
                  {d.status !== 'verified' && (
                    <form action={deleteVendorDocument}>
                      <input type="hidden" name="doc_id" value={d.id} />
                      <SubmitButton variant="ghost" size="sm" confirm="Delete this document?">Delete</SubmitButton>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
