import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { AdminNav } from '@/components/AdminNav';
import { PageHeader } from '@/components/ui';
import type { Category } from '@/lib/types';
import { TemplateEditor } from './TemplateEditor';

export default async function EditTemplate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data: cat } = await supabase.from('categories').select('*').eq('id', Number(id)).maybeSingle<Category>();
  if (!cat || cat.level !== 3) notFound();
  const { data: tpl } = await supabase.from('category_templates').select('*').eq('category_id', cat.id).maybeSingle();

  return (
    <div>
      <PageHeader title={`Template: ${cat.name}`} subtitle="Edit the buyer form and the vendor quote format. Changes apply to new tenders." />
      <AdminNav />
      <TemplateEditor
        categoryId={cat.id}
        formSchema={JSON.stringify(tpl?.form_schema ?? { fields: [] }, null, 2)}
        quoteSchema={JSON.stringify(tpl?.quote_schema ?? { gst_default: 18, allow_custom_items: true, line_items: [], extra_fields: [] }, null, 2)}
        docs={(tpl?.required_vendor_docs ?? []).join(', ')}
        maxQuotes={tpl?.max_quotes ?? 10}
      />
    </div>
  );
}
