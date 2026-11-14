'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { errorMessage } from '@/lib/format';
import type { FormSchema, QuoteSchema } from '@/lib/types';

const VALID_TYPES = ['text', 'textarea', 'number', 'select', 'multiselect', 'boolean', 'date', 'items'];

export async function reviewDocument(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_review_document', {
    p_doc: String(formData.get('doc_id')),
    p_status: String(formData.get('status')),
    p_note: (formData.get('note') as string) || null,
  });
  if (error) throw new Error(errorMessage(error));
  revalidatePath('/admin/kyc');
}

export async function setVendorSuspended(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from('vendors').update({ is_suspended: formData.get('suspend') === '1' }).eq('id', String(formData.get('vendor_id')));
  if (error) throw new Error(errorMessage(error));
  revalidatePath('/admin/kyc');
}

export async function toggleCategory(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from('categories').update({ is_active: formData.get('active') === '1' }).eq('id', Number(formData.get('category_id')));
  if (error) throw new Error(errorMessage(error));
  revalidatePath('/admin/categories');
}

export async function setTenderFlag(formData: FormData) {
  const supabase = await createClient();
  const flag = formData.get('flag') === '1';
  const { error } = await supabase
    .from('tenders')
    .update({ is_flagged: flag, flag_reason: flag ? String(formData.get('reason') || 'Flagged by admin') : null, ...(flag ? { status: 'cancelled' } : {}) })
    .eq('id', String(formData.get('tender_id')));
  if (error) throw new Error(errorMessage(error));
  revalidatePath('/admin/tenders');
}

function validateSchemas(form: FormSchema, quote: QuoteSchema): string | null {
  if (!Array.isArray(form.fields)) return 'form_schema.fields must be an array';
  const keys = new Set<string>();
  for (const f of form.fields) {
    if (!f.key || !f.label) return 'Every form field needs a key and label';
    if (!VALID_TYPES.includes(f.type)) return `Unknown field type "${f.type}" on ${f.key}`;
    if ((f.type === 'select' || f.type === 'multiselect') && !f.options?.length) return `${f.key} needs options`;
    if (f.type === 'items' && !f.columns?.length) return `${f.key} needs columns`;
    if (keys.has(f.key)) return `Duplicate field key ${f.key}`;
    keys.add(f.key);
  }
  if (!Array.isArray(quote.line_items)) return 'quote_schema.line_items must be an array';
  for (const l of quote.line_items) if (!l.key || !l.label) return 'Every quote line item needs a key and label';
  return null;
}

export async function saveTemplate(_prev: { error?: string; ok?: string } | undefined, formData: FormData) {
  const supabase = await createClient();
  const categoryId = Number(formData.get('category_id'));
  let form: FormSchema, quote: QuoteSchema;
  try {
    form = JSON.parse(String(formData.get('form_schema')));
    quote = JSON.parse(String(formData.get('quote_schema')));
  } catch {
    return { error: 'Invalid JSON — check commas and quotes' };
  }
  const problem = validateSchemas(form, quote);
  if (problem) return { error: problem };
  const docs = String(formData.get('required_vendor_docs') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const maxQuotes = Number(formData.get('max_quotes')) || 10;

  const { data: existing } = await supabase.from('category_templates').select('version').eq('category_id', categoryId).maybeSingle();
  const { error } = await supabase.from('category_templates').upsert(
    { category_id: categoryId, form_schema: form, quote_schema: quote, required_vendor_docs: docs, max_quotes: maxQuotes, version: (existing?.version ?? 0) + 1, updated_at: new Date().toISOString() },
    { onConflict: 'category_id' },
  );
  if (error) return { error: errorMessage(error) };
  revalidatePath('/admin/categories');
  return { ok: 'Template saved. New tenders will use it immediately.' };
}

export async function createSubCategory(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get('name') ?? '').trim();
  const parentId = Number(formData.get('parent_id'));
  const tenderType = String(formData.get('tender_type'));
  if (name.length < 3 || !parentId) throw new Error('Name and parent are required');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const { data, error } = await supabase
    .from('categories')
    .insert({ parent_id: parentId, level: 3, name, slug, tender_type: tenderType, is_active: false })
    .select('id')
    .single();
  if (error) throw new Error(errorMessage(error));
  redirect(`/admin/categories/${data.id}`);
}
