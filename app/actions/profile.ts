'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { errorMessage } from '@/lib/format';

export type ActionState = { error?: string; ok?: string } | undefined;

const pincodeList = z
  .string()
  .optional()
  .transform((s) => (s ?? '').split(/[\s,]+/).map((p) => p.trim()).filter(Boolean))
  .refine((arr) => arr.every((p) => /^[1-9][0-9]{5}$/.test(p)), 'Pincodes must be 6 digits, separated by commas');

const onboardingSchema = z.object({
  full_name: z.string().trim().min(2, 'Please enter your name').max(80),
  role: z.enum(['buyer', 'vendor']),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  business_name: z.string().trim().max(120).optional(),
  vendor_type: z.enum(['individual', 'agency']).optional(),
  city_id: z.coerce.number().int().optional(),
  pincodes: pincodeList,
  years_experience: z.coerce.number().int().min(0).max(80).optional(),
});

export async function completeOnboarding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const parsed = onboardingSchema.safeParse({
    full_name: formData.get('full_name'),
    role: formData.get('role'),
    email: formData.get('email') ?? '',
    business_name: formData.get('business_name') ?? undefined,
    vendor_type: formData.get('vendor_type') ?? undefined,
    city_id: formData.get('city_id') || undefined,
    pincodes: (formData.get('pincodes') as string) ?? '',
    years_experience: formData.get('years_experience') || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const categoryIds = formData.getAll('category_ids').map(Number).filter(Boolean);

  const { error: pErr } = await supabase
    .from('profiles')
    .update({ full_name: d.full_name, active_role: d.role, ...(d.email ? { email: d.email } : {}) })
    .eq('id', user.id);
  if (pErr) return { error: errorMessage(pErr) };

  if (d.role === 'vendor') {
    if (!d.business_name || d.business_name.length < 2) return { error: 'Enter your business name' };
    if (!d.city_id) return { error: 'Choose your city' };
    if (categoryIds.length === 0) return { error: 'Choose at least one service you provide' };

    const { data: existing } = await supabase.from('vendors').select('id').eq('owner_id', user.id).maybeSingle();
    let vendorId = existing?.id as string | undefined;
    if (!vendorId) {
      const { data: v, error } = await supabase
        .from('vendors')
        .insert({ owner_id: user.id, business_name: d.business_name, type: d.vendor_type ?? 'individual', city_id: d.city_id, years_experience: d.years_experience ?? null })
        .select('id')
        .single();
      if (error) return { error: errorMessage(error) };
      vendorId = v.id;
    }
    await supabase.from('vendor_categories').delete().eq('vendor_id', vendorId);
    const { error: cErr } = await supabase.from('vendor_categories').insert(categoryIds.map((category_id) => ({ vendor_id: vendorId, category_id })));
    if (cErr) return { error: errorMessage(cErr) };

    await supabase.from('vendor_service_areas').delete().eq('vendor_id', vendorId);
    const areas = d.pincodes.length ? d.pincodes.map((pincode) => ({ vendor_id: vendorId, city_id: d.city_id, pincode })) : [{ vendor_id: vendorId, city_id: d.city_id, pincode: null }];
    const { error: aErr } = await supabase.from('vendor_service_areas').insert(areas);
    if (aErr) return { error: errorMessage(aErr) };
  }

  revalidatePath('/', 'layout');
  redirect(d.role === 'vendor' ? '/vendor' : '/buyer');
}

export async function switchRole(formData: FormData) {
  const role = formData.get('role') === 'vendor' ? 'vendor' : 'buyer';
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (role === 'vendor') {
    const { data: vendor } = await supabase.from('vendors').select('id').eq('owner_id', user.id).maybeSingle();
    if (!vendor) redirect('/onboarding?role=vendor');
  }
  await supabase.from('profiles').update({ active_role: role }).eq('id', user.id);
  revalidatePath('/', 'layout');
  redirect(role === 'vendor' ? '/vendor' : '/buyer');
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
  revalidatePath('/', 'layout');
}
