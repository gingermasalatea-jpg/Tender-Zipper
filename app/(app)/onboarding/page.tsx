import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { loadCatalog } from '@/lib/catalog';
import { OnboardingForm } from './OnboardingForm';

export const metadata = { title: 'Set up your account' };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect('/login');

  const { data: vendor } = await supabase.from('vendors').select('id').eq('owner_id', user.id).maybeSingle();
  const complete = !!profile.full_name && !!profile.active_role;

  if (complete && role !== 'vendor') redirect(profile.active_role === 'vendor' ? '/vendor' : '/buyer');
  if (complete && role === 'vendor' && vendor) redirect('/vendor/profile');

  const { cities, groups } = await loadCatalog(supabase);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">{role === 'vendor' ? 'Register as a vendor' : 'Welcome to Tender Zipper'}</h1>
      <p className="mt-1 text-sm text-slate-600">Takes less than a minute. You can switch between buyer and vendor any time.</p>
      <OnboardingForm
        defaultRole={role === 'vendor' ? 'vendor' : 'buyer'}
        defaultName={profile.full_name ?? ''}
        defaultEmail={profile.email ?? ''}
        cities={cities}
        groups={groups.map((g) => ({
          sector: g.sector.name,
          categories: g.categories.map((c) => ({ name: c.category.name, subs: c.subs.map((s) => ({ id: s.id, name: s.name })) })),
        }))}
      />
    </div>
  );
}
