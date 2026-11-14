'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { errorMessage } from '@/lib/format';
import { DOC_TYPES } from '@/lib/types';
import type { ActionState } from '@/app/actions/profile';

async function myVendor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: vendor } = user ? await supabase.from('vendors').select('id, city_id').eq('owner_id', user.id).maybeSingle() : { data: null };
  return { supabase, user, vendor };
}

const profileSchema = z.object({
  business_name: z.string().trim().min(2).max(120),
  type: z.enum(['individual', 'agency']),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Enter a valid 15-character GSTIN'),
  about: z.string().trim().max(1500),
  years_experience: z.coerce.number().int().min(0).max(80).nullable(),
  team_size: z.coerce.number().int().min(0).max(100000).nullable(),
  city_id: z.coerce.number().int().positive(),
  pincodes: z.string(),
});

export async function updateVendorProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, vendor } = await myVendor();
  if (!vendor) return { error: 'Vendor profile not found' };
  const num = (k: string) => (formData.get(k) ? formData.get(k) : null);
  const parsed = profileSchema.safeParse({
    business_name: formData.get('business_name'),
    type: formData.get('type'),
    gstin: formData.get('gstin') ?? '',
    about: formData.get('about') ?? '',
    years_experience: num('years_experience'),
    team_size: num('team_size'),
    city_id: formData.get('city_id'),
    pincodes: formData.get('pincodes') ?? '',
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const pins = d.pincodes.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
  if (pins.some((p) => !/^[1-9][0-9]{5}$/.test(p))) return { error: 'Pincodes must be 6 digits, separated by commas' };
  const categoryIds = formData.getAll('category_ids').map(Number).filter(Boolean);
  if (!categoryIds.length) return { error: 'Choose at least one service' };

  const { error } = await supabase
    .from('vendors')
    .update({ business_name: d.business_name, type: d.type, gstin: d.gstin || null, about: d.about || null, years_experience: d.years_experience, team_size: d.team_size, city_id: d.city_id })
    .eq('id', vendor.id);
  if (error) return { error: errorMessage(error) };

  await supabase.from('vendor_categories').delete().eq('vendor_id', vendor.id);
  await supabase.from('vendor_categories').insert(categoryIds.map((category_id) => ({ vendor_id: vendor.id, category_id })));
  await supabase.from('vendor_service_areas').delete().eq('vendor_id', vendor.id);
  await supabase
    .from('vendor_service_areas')
    .insert(pins.length ? pins.map((pincode) => ({ vendor_id: vendor.id, city_id: d.city_id, pincode })) : [{ vendor_id: vendor.id, city_id: d.city_id, pincode: null }]);

  revalidatePath('/vendor', 'layout');
  return { ok: 'Profile saved. Your tender feed is updated.' };
}

export async function addVendorDocument(docType: string, path: string): Promise<{ error?: string }> {
  const { supabase, user, vendor } = await myVendor();
  if (!vendor || !user) return { error: 'Vendor profile not found' };
  if (!DOC_TYPES.some((d) => d.value === docType)) return { error: 'Choose a document type' };
  if (!path.startsWith(`${user.id}/`)) return { error: 'Invalid upload' };
  const { error } = await supabase.from('vendor_documents').insert({ vendor_id: vendor.id, doc_type: docType, file_path: path });
  if (error) return { error: errorMessage(error) };
  revalidatePath('/vendor/profile');
  return {};
}

export async function deleteVendorDocument(formData: FormData) {
  const { supabase } = await myVendor();
  const id = String(formData.get('doc_id'));
  const { data: doc } = await supabase.from('vendor_documents').select('file_path').eq('id', id).maybeSingle();
  const { error } = await supabase.from('vendor_documents').delete().eq('id', id);
  if (!error && doc) await supabase.storage.from('vendor-docs').remove([doc.file_path]);
  revalidatePath('/vendor/profile');
}
