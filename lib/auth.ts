import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, Vendor } from '@/lib/types';

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as Profile | null };
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
  return { supabase, user, profile };
}

export async function requireUser() {
  const s = await getSession();
  if (!s.user || !s.profile) redirect('/login');
  if (!s.profile.active_role || !s.profile.full_name) redirect('/onboarding');
  return { ...s, user: s.user, profile: s.profile };
}

export async function requireVendor() {
  const s = await requireUser();
  const { data: vendor } = await s.supabase.from('vendors').select('*').eq('owner_id', s.user.id).maybeSingle<Vendor>();
  if (!vendor) redirect('/onboarding?role=vendor');
  return { ...s, vendor };
}

export async function requireAdmin() {
  const s = await requireUser();
  if (!s.profile.is_admin) redirect('/');
  return s;
}
