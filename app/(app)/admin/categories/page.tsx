import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createSubCategory, toggleCategory } from '@/app/actions/admin';
import { AdminNav } from '@/components/AdminNav';
import { SubmitButton } from '@/components/SubmitButton';
import { Badge, Card, Field, inputClass, PageHeader } from '@/components/ui';
import { TENDER_TYPE_LABEL, type Category, type TenderType } from '@/lib/types';

export const metadata = { title: 'Categories' };

export default async function AdminCategories() {
  const { supabase } = await requireAdmin();
  const [{ data: cats }, { data: tpls }] = await Promise.all([
    supabase.from('categories').select('*').order('sort'),
    supabase.from('category_templates').select('category_id, version'),
  ]);
  const all = (cats ?? []) as Category[];
  const hasTpl = new Map((tpls ?? []).map((t) => [t.category_id, t.version]));
  const sectors = all.filter((c) => c.level === 1);

  return (
    <div>
      <PageHeader title="Categories & templates" subtitle="Each sub-category needs a template before you activate it. No code changes needed." />
      <AdminNav />
      <div className="space-y-6">
        {sectors.map((s) => (
          <Card key={s.id}>
            <h2 className="font-bold text-slate-900">{s.name}</h2>
            {all.filter((c) => c.level === 2 && c.parent_id === s.id).map((c) => (
              <div key={c.id} className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{c.name}</p>
                <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {all.filter((x) => x.level === 3 && x.parent_id === c.id).map((sub) => (
                    <li key={sub.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/categories/${sub.id}`} className="font-medium text-brand-700 hover:underline">{sub.name}</Link>
                        <Badge>{TENDER_TYPE_LABEL[sub.tender_type!]}</Badge>
                        {hasTpl.has(sub.id) ? <Badge tone="blue">Template v{hasTpl.get(sub.id)}</Badge> : <Badge tone="amber">No template</Badge>}
                      </div>
                      <form action={toggleCategory} className="flex items-center gap-2">
                        <input type="hidden" name="category_id" value={sub.id} />
                        <input type="hidden" name="active" value={sub.is_active ? '0' : '1'} />
                        {sub.is_active ? <Badge tone="green">Live</Badge> : <Badge>Hidden</Badge>}
                        <SubmitButton variant="ghost" size="sm">{sub.is_active ? 'Hide' : 'Make live'}</SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Card>
        ))}

        <Card>
          <h2 className="font-semibold">Add a sub-category</h2>
          <form action={createSubCategory} className="mt-3 grid gap-3 sm:grid-cols-4 sm:items-end">
            <Field label="Name"><input name="name" className={inputClass} placeholder="Pest Control" required /></Field>
            <Field label="Under">
              <select name="parent_id" className={inputClass}>
                {all.filter((c) => c.level === 2).map((c) => (
                  <option key={c.id} value={c.id}>{sectors.find((s) => s.id === c.parent_id)?.name} → {c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Tender type">
              <select name="tender_type" className={inputClass}>
                {(Object.keys(TENDER_TYPE_LABEL) as TenderType[]).map((t) => <option key={t} value={t}>{TENDER_TYPE_LABEL[t]}</option>)}
              </select>
            </Field>
            <SubmitButton>Create & edit template</SubmitButton>
          </form>
        </Card>
      </div>
    </div>
  );
}
