'use client';
import { useActionState, useMemo, useState } from 'react';
import { saveTemplate } from '@/app/actions/admin';
import { DynamicForm } from '@/components/DynamicForm';
import { Alert, Card, Field, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import type { FormSchema, FormValues } from '@/lib/types';

const HELP = `Field: { "key": "area_sqft", "label": "Area", "type": "number", "unit": "sq ft", "required": true }
Types: text, textarea, number, select (needs "options"), multiselect, boolean, date, items (needs "columns")
Quote line item: { "key": "paint", "label": "Paint 2 coats", "unit": "sq ft", "qty_from": "area_sqft" }`;

export function TemplateEditor(props: { categoryId: number; formSchema: string; quoteSchema: string; docs: string; maxQuotes: number }) {
  const [state, action] = useActionState(saveTemplate, undefined);
  const [form, setForm] = useState(props.formSchema);
  const [preview, setPreview] = useState<FormValues>({});
  const parsed = useMemo<FormSchema | null>(() => {
    try {
      return JSON.parse(form) as FormSchema;
    } catch {
      return null;
    }
  }, [form]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={action} className="space-y-4">
        <input type="hidden" name="category_id" value={props.categoryId} />
        <Card className="space-y-4">
          <Field label="Buyer form (form_schema JSON)">
            <textarea name="form_schema" rows={18} className={`${inputClass} font-mono text-xs`} value={form} onChange={(e) => setForm(e.target.value)} spellCheck={false} />
          </Field>
          <Field label="Vendor quote format (quote_schema JSON)">
            <textarea name="quote_schema" rows={14} className={`${inputClass} font-mono text-xs`} defaultValue={props.quoteSchema} spellCheck={false} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Required vendor documents" help="Comma separated, e.g. gst, psara_licence">
              <input name="required_vendor_docs" className={inputClass} defaultValue={props.docs} />
            </Field>
            <Field label="Max quotes per tender">
              <input name="max_quotes" type="number" min={1} max={50} className={inputClass} defaultValue={props.maxQuotes} />
            </Field>
          </div>
          <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{HELP}</pre>
          {state?.error && <Alert>{state.error}</Alert>}
          {state?.ok && <Alert tone="green">{state.ok}</Alert>}
          <SubmitButton>Save template</SubmitButton>
        </Card>
      </form>
      <Card>
        <h2 className="mb-4 font-semibold">Live preview (buyer form)</h2>
        {parsed?.fields ? <DynamicForm fields={parsed.fields} values={preview} onChange={setPreview} /> : <Alert tone="amber">JSON is not valid yet.</Alert>}
      </Card>
    </div>
  );
}
