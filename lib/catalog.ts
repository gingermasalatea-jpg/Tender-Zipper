import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category, City } from '@/lib/types';

export interface CategoryGroup {
  sector: Category;
  categories: { category: Category; subs: Category[] }[];
}

/** Active cities and a sector → category → sub-category tree of active categories. */
export async function loadCatalog(supabase: SupabaseClient) {
  const [{ data: cities }, { data: cats }] = await Promise.all([
    supabase.from('cities').select('*').eq('is_active', true).order('name'),
    supabase.from('categories').select('*').eq('is_active', true).order('sort'),
  ]);
  const all = (cats ?? []) as Category[];
  const groups: CategoryGroup[] = all
    .filter((c) => c.level === 1)
    .map((sector) => ({
      sector,
      categories: all
        .filter((c) => c.level === 2 && c.parent_id === sector.id)
        .map((category) => ({ category, subs: all.filter((s) => s.level === 3 && s.parent_id === category.id) }))
        .filter((g) => g.subs.length > 0),
    }))
    .filter((g) => g.categories.length > 0);
  const subs = all.filter((c) => c.level === 3);
  return { cities: (cities ?? []) as City[], groups, subs };
}
