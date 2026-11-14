'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { cleanFormValues } from '@/lib/forms';
import { errorMessage } from '@/lib/format';
import type { FormSchema, FormValues } from '@/lib/types';

const tenderInput = z
  .object({
    category_id: z.number().int().positive(),
    title: z.string().trim().min(5, 'Title must be at least 5 characters').max(140),
    description: z.string().trim().max(3000).optional().default(''),
    form_data: z.record(z.unknown()),
    city_id: z.number().int().positive(),
    area_label: z.string().trim().min(2, 'Enter your area / locality').max(80),
    pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit pincode'),
    address: z.string().trim().max(500).optional().default(''),
    budget_min: z.number().nonnegative().nullable(),
    budget_max: z.number().nonnegative().nullable(),
    budget_visible: z.boolean(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    deadline_hours: z.number().int().min(12).max(24 * 14),
    site_visit_allowed: z.boolean(),
    media_paths: z.array(z.string().max(300)).max(10),
  })
  .refine((d) => d.budget_min == null || d.budget_max == null || d.budget_max >= d.budget_min, 'Maximum budget must be more than minimum');

export type CreateTenderInput = z.input<typeof tenderInput>;

export async function createTender(input: CreateTenderInput): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please log in again' };

  const parsed = tenderInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const { data: tpl } = await supabase.from('category_templates').select('form_schema').eq('category_id', d.category_id).maybeSingle();
  const cleaned = cleanFormValues(tpl?.form_schema as FormSchema | undefined, d.form_data as FormValues);
  if (cleaned.error) return { error: cleaned.error };

  if (d.media_paths.some((p) => !p.startsWith(`${user.id}/`))) return { error: 'Invalid photo upload' };

  const { data: tender, error } = await supabase
    .from('tenders')
    .insert({
      buyer_id: user.id,
      category_id: d.category_id,
      title: d.title,
      description: d.description || null,
      form_data: cleaned.data,
      city_id: d.city_id,
      area_label: d.area_label,
      pincode: d.pincode,
      address: d.address || null,
      budget_min: d.budget_min,
      budget_max: d.budget_max,
      budget_visible: d.budget_visible,
      start_date: d.start_date,
      quote_deadline: new Date(Date.now() + d.deadline_hours * 3_600_000).toISOString(),
      site_visit_allowed: d.site_visit_allowed,
    })
    .select('id')
    .single();
  if (error) return { error: errorMessage(error) };

  if (d.media_paths.length) {
    await supabase.from('tender_media').insert(d.media_paths.map((file_path) => ({ tender_id: tender.id, file_path, media_type: /\.mp4$/i.test(file_path) ? 'video' : 'image' })));
  }
  revalidatePath('/buyer');
  return { id: tender.id };
}

async function tenderStatus(formData: FormData, status: 'cancelled' | 'closed') {
  const id = String(formData.get('tender_id'));
  const supabase = await createClient();
  const { error } = await supabase.from('tenders').update({ status }).eq('id', id);
  if (error) throw new Error(errorMessage(error));
  revalidatePath(`/buyer/tenders/${id}`);
  revalidatePath('/buyer');
}

export async function cancelTender(formData: FormData) {
  await tenderStatus(formData, 'cancelled');
}

export async function closeTenderEarly(formData: FormData) {
  await tenderStatus(formData, 'closed');
}

export async function shortlistQuote(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('shortlist_quote', { p_quote: String(formData.get('quote_id')), p_shortlist: formData.get('undo') !== '1' });
  const tenderId = String(formData.get('tender_id'));
  if (error) redirect(`/buyer/tenders/${tenderId}?error=${encodeURIComponent(errorMessage(error))}`);
  revalidatePath(`/buyer/tenders/${tenderId}`);
}

export async function awardQuote(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('award_quote', { p_quote: String(formData.get('quote_id')) });
  const tenderId = String(formData.get('tender_id'));
  if (error) redirect(`/buyer/tenders/${tenderId}?error=${encodeURIComponent(errorMessage(error))}`);
  revalidatePath('/buyer');
  redirect(`/work-orders/${(data as { id: string }).id}`);
}

export async function completeContract(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get('contract_id'));
  const { error } = await supabase.rpc('complete_contract', { p_contract: id });
  if (error) redirect(`/work-orders/${id}?error=${encodeURIComponent(errorMessage(error))}`);
  revalidatePath(`/work-orders/${id}`);
}
