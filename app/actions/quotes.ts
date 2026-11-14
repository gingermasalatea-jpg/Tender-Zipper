'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { cleanFormValues } from '@/lib/forms';
import { errorMessage } from '@/lib/format';
import type { QuoteSchema } from '@/lib/types';

const quoteInput = z.object({
  line_items: z
    .array(z.object({ key: z.string().max(60), label: z.string().trim().max(120), unit: z.string().max(20), qty: z.number().min(0), rate: z.number().min(0) }))
    .max(60),
  extra: z.record(z.unknown()),
  gst_percent: z.number().refine((n) => [0, 5, 12, 18, 28].includes(n), 'Invalid GST rate'),
  timeline_days: z.number().int().positive().max(3650).nullable(),
  warranty_months: z.number().int().min(0).max(240).nullable(),
  payment_terms: z.string().max(1000),
  notes: z.string().max(2000),
});

export type QuoteInput = z.input<typeof quoteInput>;

export async function saveQuote(tenderId: string, input: QuoteInput, submit: boolean): Promise<{ error?: string; ok?: string }> {
  const parsed = quoteInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();

  // Validate the vendor's extra answers against the template
  const { data: detail, error: dErr } = await supabase.rpc('vendor_tender_detail', { p_tender: tenderId });
  if (dErr) return { error: errorMessage(dErr) };
  const schema = (detail as { quote_schema: QuoteSchema | null }).quote_schema;
  const extra = cleanFormValues({ fields: schema?.extra_fields ?? [] }, parsed.data.extra);
  if (submit && extra.error) return { error: extra.error };
  if (submit && !parsed.data.timeline_days) return { error: 'Enter how many days the work will take' };

  const { error } = await supabase.rpc('save_quote', {
    p_tender: tenderId,
    p_payload: { ...parsed.data, extra: extra.data },
    p_submit: submit,
  });
  if (error) return { error: errorMessage(error) };
  revalidatePath(`/vendor/tenders/${tenderId}`);
  revalidatePath('/vendor/quotes');
  return { ok: submit ? 'Quote submitted! The buyer has been notified.' : 'Draft saved.' };
}

export async function withdrawQuote(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('withdraw_quote', { p_quote: String(formData.get('quote_id')) });
  if (error) throw new Error(errorMessage(error));
  revalidatePath(`/vendor/tenders/${formData.get('tender_id')}`);
  revalidatePath('/vendor/quotes');
}
