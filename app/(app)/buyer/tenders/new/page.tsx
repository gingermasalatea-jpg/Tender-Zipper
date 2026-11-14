import { requireUser } from '@/lib/auth';
import { loadCatalog } from '@/lib/catalog';
import type { FormSchema } from '@/lib/types';
import { NewTenderWizard } from './NewTenderWizard';

export const metadata = { title: 'Post a tender' };

export default async function NewTenderPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const { supabase, user } = await requireUser();
  const { cities, groups, subs } = await loadCatalog(supabase);
  const { data: templates } = await supabase.from('category_templates').select('category_id, form_schema').in('category_id', subs.map((s) => s.id));

  return (
    <NewTenderWizard
      userId={user.id}
      cities={cities}
      initialCategoryId={category ? Number(category) : null}
      groups={groups.map((g) => ({
        sector: g.sector.name,
        subs: g.categories.flatMap((c) => c.subs.map((s) => ({ id: s.id, name: s.name, group: c.category.name, tender_type: s.tender_type! }))),
      }))}
      templates={Object.fromEntries((templates ?? []).map((t) => [t.category_id, t.form_schema as FormSchema]))}
    />
  );
}
