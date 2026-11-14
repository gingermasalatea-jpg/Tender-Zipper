import { notFound } from 'next/navigation';
import { CheckCircle2, Download, Mail, Phone } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { completeContract } from '@/app/actions/tenders';
import { FormDataView } from '@/components/FormDataView';
import { SubmitButton } from '@/components/SubmitButton';
import { Alert, Badge, buttonClass, Card } from '@/components/ui';
import { dateOnly, rupees } from '@/lib/format';
import type { WorkOrder } from '@/lib/work-order';

export const metadata = { title: 'Work order' };

export default async function WorkOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, user } = await requireUser();
  const { data, error: rpcErr } = await supabase.rpc('work_order_detail', { p_contract: id });
  if (rpcErr || !data) notFound();
  const wo = data as WorkOrder;
  const { data: c } = await supabase.from('contracts').select('buyer_id').eq('id', id).single();
  const isBuyer = c?.buyer_id === user.id;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">Work order · Tender {wo.tender.code}</p>
          <h1 className="text-2xl font-bold text-slate-900">{wo.code}</h1>
          <p className="mt-1 text-slate-700">{wo.tender.title}</p>
          <div className="mt-2 flex gap-2">
            <Badge tone={wo.status === 'completed' ? 'purple' : 'green'}>{wo.status === 'completed' ? 'Completed' : 'Active'}</Badge>
            <Badge>Issued {dateOnly(wo.created_at)}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/work-orders/${wo.id}/pdf`} className={buttonClass('outline')}><Download className="h-4 w-4" /> Download PDF</a>
          {isBuyer && wo.status === 'active' && (
            <form action={completeContract}>
              <input type="hidden" name="contract_id" value={wo.id} />
              <SubmitButton confirm="Mark this job as complete?"><CheckCircle2 className="h-4 w-4" /> Mark job complete</SubmitButton>
            </form>
          )}
        </div>
      </div>

      <Alert tone="blue">
        Tender Zipper charges zero commission. Agree on milestones and pay the vendor directly as per the payment terms below. Keep receipts for your records.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { title: 'Buyer', name: wo.buyer.name, sub: [wo.tender.address, `${wo.tender.area_label ?? ''}, ${wo.tender.city_name} ${wo.tender.pincode ?? ''}`].filter(Boolean).join('\n'), phone: wo.buyer.phone, email: wo.buyer.email },
          { title: 'Vendor', name: wo.vendor.business_name, sub: [wo.vendor.contact_name, wo.vendor.gstin ? `GSTIN ${wo.vendor.gstin}` : null].filter(Boolean).join('\n'), phone: wo.vendor.phone, email: wo.vendor.email },
        ].map((p) => (
          <Card key={p.title} className="text-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{p.title}</p>
            <p className="mt-1 font-semibold text-slate-900">{p.name}</p>
            <p className="whitespace-pre-line text-slate-600">{p.sub}</p>
            {p.phone && <a href={`tel:${p.phone}`} className="mt-2 flex items-center gap-1 text-brand-700"><Phone className="h-4 w-4" /> {p.phone}</a>}
            {p.email && <a href={`mailto:${p.email}`} className="flex items-center gap-1 text-brand-700"><Mail className="h-4 w-4" /> {p.email}</a>}
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">Agreed price</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr><th className="py-2">Item</th><th className="py-2">Qty</th><th className="py-2">Rate</th><th className="py-2 text-right">Amount</th></tr>
          </thead>
          <tbody>
            {wo.quote.line_items.map((l, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-2">{l.label}</td><td className="py-2">{l.qty} {l.unit}</td><td className="py-2">{rupees(l.rate)}</td><td className="py-2 text-right">{rupees(l.amount)}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-200"><td colSpan={3} className="py-2 text-right text-slate-500">Subtotal</td><td className="py-2 text-right">{rupees(wo.quote.subtotal)}</td></tr>
            <tr><td colSpan={3} className="py-1 text-right text-slate-500">GST {Number(wo.quote.gst_percent)}%</td><td className="py-1 text-right">{rupees(wo.quote.gst_amount)}</td></tr>
            <tr className="text-base font-extrabold"><td colSpan={3} className="py-2 text-right">Total</td><td className="py-2 text-right text-brand-800">{rupees(wo.quote.total)}</td></tr>
          </tbody>
        </table>
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3">
          <p><span className="block text-xs text-slate-500">Timeline</span>{wo.quote.timeline_days ? `${wo.quote.timeline_days} days` : '—'}</p>
          <p><span className="block text-xs text-slate-500">Warranty</span>{wo.quote.warranty_months ? `${wo.quote.warranty_months} months` : '—'}</p>
          <p><span className="block text-xs text-slate-500">Preferred start</span>{dateOnly(wo.tender.start_date)}</p>
          <p className="sm:col-span-3 whitespace-pre-line"><span className="block text-xs text-slate-500">Payment terms</span>{wo.quote.payment_terms || 'To be agreed directly between buyer and vendor'}</p>
          {wo.quote.notes && <p className="sm:col-span-3 whitespace-pre-line"><span className="block text-xs text-slate-500">Vendor notes</span>{wo.quote.notes}</p>}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Scope of work — {wo.tender.category_name}</h2>
        <FormDataView schema={wo.tender.form_schema} data={wo.tender.form_data} />
        {wo.tender.description && <p className="mt-4 whitespace-pre-line border-t border-slate-100 pt-4 text-sm">{wo.tender.description}</p>}
      </Card>
    </div>
  );
}
