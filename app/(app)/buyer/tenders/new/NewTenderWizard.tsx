'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ImagePlus, Search, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createTender } from '@/app/actions/tenders';
import { DynamicForm } from '@/components/DynamicForm';
import { Alert, Badge, Button, Card, Field, inputClass } from '@/components/ui';
import { cn, publicMediaUrl } from '@/lib/format';
import { cleanFormValues } from '@/lib/forms';
import { TENDER_TYPE_LABEL, type City, type FormSchema, type FormValues, type TenderType } from '@/lib/types';

interface Sub { id: number; name: string; group: string; tender_type: TenderType }

const DEADLINES = [
  { hours: 24, label: '24 hours' },
  { hours: 48, label: '2 days' },
  { hours: 72, label: '3 days (recommended)' },
  { hours: 120, label: '5 days' },
  { hours: 168, label: '7 days' },
];

export function NewTenderWizard(props: {
  userId: string;
  cities: City[];
  groups: { sector: string; subs: Sub[] }[];
  templates: Record<number, FormSchema>;
  initialCategoryId: number | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const allSubs = props.groups.flatMap((g) => g.subs);
  const [categoryId, setCategoryId] = useState<number | null>(allSubs.some((s) => s.id === props.initialCategoryId) ? props.initialCategoryId : null);
  const [query, setQuery] = useState('');
  const [values, setValues] = useState<FormValues>({});
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cityId, setCityId] = useState<number>(props.cities[0]?.id ?? 0);
  const [area, setArea] = useState('');
  const [pincode, setPincode] = useState('');
  const [address, setAddress] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [budgetVisible, setBudgetVisible] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState(72);
  const [siteVisit, setSiteVisit] = useState(true);
  const [media, setMedia] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sub = allSubs.find((s) => s.id === categoryId) ?? null;
  const schema = categoryId ? props.templates[categoryId] : undefined;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return props.groups
      .map((g) => ({ ...g, subs: g.subs.filter((s) => !q || s.name.toLowerCase().includes(q) || s.group.toLowerCase().includes(q)) }))
      .filter((g) => g.subs.length);
  }, [query, props.groups]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    for (const file of Array.from(files).slice(0, 10 - media.length)) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} is larger than 10 MB`);
        continue;
      }
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${props.userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('tender-media').upload(path, file, { contentType: file.type });
      if (error) setError(error.message);
      else setMedia((m) => [...m, path]);
    }
    setUploading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) return;
    setError(null);
    const check = cleanFormValues(schema, values);
    if (check.error) {
      setError(check.error);
      return;
    }
    setBusy(true);
    const res = await createTender({
      category_id: categoryId,
      title: title || `${sub?.name} in ${area}`,
      description,
      form_data: values,
      city_id: cityId,
      area_label: area,
      pincode,
      address,
      budget_min: budgetMin ? Number(budgetMin) : null,
      budget_max: budgetMax ? Number(budgetMax) : null,
      budget_visible: budgetVisible,
      start_date: startDate || null,
      deadline_hours: deadline,
      site_visit_allowed: siteVisit,
      media_paths: media,
    });
    setBusy(false);
    if (res.error) setError(res.error);
    else router.push(`/buyer/tenders/${res.id}?posted=1`);
  }

  if (!sub) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900">What do you need done?</h1>
        <p className="mt-1 text-sm text-slate-600">Pick a service. You&apos;ll fill a short form so vendors can quote accurately.</p>
        <div className="relative mt-5">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input className={cn(inputClass, 'pl-9')} placeholder="Search: painting, security, furniture…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        </div>
        <div className="mt-6 space-y-6">
          {filtered.map((g) => (
            <div key={g.sector}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{g.sector}</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.subs.map((s) => (
                  <button key={s.id} onClick={() => setCategoryId(s.id)} className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand-600 hover:shadow-sm">
                    <p className="font-semibold text-slate-900">{s.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{s.group} · {TENDER_TYPE_LABEL[s.tender_type]}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!filtered.length && <p className="text-sm text-slate-500">No matching service yet. More categories are coming soon.</p>}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6">
      <div>
        <button type="button" onClick={() => setCategoryId(null)} className="flex items-center gap-1 text-sm font-medium text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Change service
        </button>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{sub.name}</h1>
        <Badge tone="blue" className="mt-2">{TENDER_TYPE_LABEL[sub.tender_type]}</Badge>
      </div>

      <Card className="space-y-4">
        <h2 className="font-semibold">1. Requirement details</h2>
        <Field label="Tender title" help="Leave blank and we’ll create one for you">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${sub.name} in ${area || 'your area'}`} maxLength={140} />
        </Field>
        {schema?.fields?.length ? <DynamicForm fields={schema.fields} values={values} onChange={setValues} /> : null}
        <Field label="Anything else vendors should know?">
          <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Access timings, materials you already have, special instructions…" />
        </Field>
        <div>
          <p className="text-sm font-medium text-slate-800">Photos / videos (optional, up to 10)</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {media.map((p) => (
              <div key={p} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                {/\.mp4$/i.test(p) ? <span className="grid h-full place-items-center text-xs text-slate-500">Video</span> : <img src={publicMediaUrl('tender-media', p)} alt="" className="h-full w-full object-cover" />}
                <button type="button" onClick={() => setMedia((m) => m.filter((x) => x !== p))} className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5" aria-label="Remove">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {media.length < 10 && (
              <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-brand-600 hover:text-brand-700">
                <ImagePlus className="h-6 w-6" />
                <input type="file" accept="image/*,video/mp4" multiple className="hidden" onChange={(e) => upload(e.target.files)} disabled={uploading} />
              </label>
            )}
          </div>
          {uploading && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">2. Location</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="City" required>
            <select className={inputClass} value={cityId} onChange={(e) => setCityId(Number(e.target.value))}>
              {props.cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Area / locality" required>
            <input className={inputClass} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Bopal" required />
          </Field>
          <Field label="Pincode" required>
            <input className={inputClass} inputMode="numeric" maxLength={6} value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))} placeholder="380058" required />
          </Field>
        </div>
        <Field label="Full address" help="Private. Shared only with vendors you shortlist.">
          <textarea className={inputClass} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">3. Budget & timing</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Budget from (₹)">
            <input className={inputClass} type="number" min={0} value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} />
          </Field>
          <Field label="Budget up to (₹)">
            <input className={inputClass} type="number" min={0} value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={budgetVisible} onChange={(e) => setBudgetVisible(e.target.checked)} />
          Show my budget to vendors <span className="text-slate-500">(hidden budgets usually get more honest quotes)</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preferred start date">
            <input className={inputClass} type="date" value={startDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Accept quotes for">
            <select className={inputClass} value={deadline} onChange={(e) => setDeadline(Number(e.target.value))}>
              {DEADLINES.map((d) => (
                <option key={d.hours} value={d.hours}>{d.label}</option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={siteVisit} onChange={(e) => setSiteVisit(e.target.checked)} />
          Vendors may request a site visit before quoting
        </label>
      </Card>

      {error && <Alert>{error}</Alert>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" disabled={busy || uploading}>
          {busy ? 'Posting…' : 'Post tender — free'}
        </Button>
        <p className="text-xs text-slate-500">Matching verified vendors are notified right away. Max 10 quotes, no spam calls.</p>
      </div>
    </form>
  );
}
