'use client';
import { useActionState } from 'react';
import { updateVendorProfile } from '@/app/actions/vendor';
import { Alert, Card, Field, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import type { City, Vendor } from '@/lib/types';

export function VendorProfileForm({ vendor, cities, groups, selected, pincodes }: {
  vendor: Vendor;
  cities: City[];
  groups: { sector: string; subs: { id: number; name: string }[] }[];
  selected: number[];
  pincodes: string;
}) {
  const [state, action] = useActionState(updateVendorProfile, undefined);
  return (
    <form action={action}>
      <Card className="space-y-4">
        <h2 className="font-semibold">Business profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" required><input name="business_name" className={inputClass} defaultValue={vendor.business_name} required /></Field>
          <Field label="Type">
            <select name="type" className={inputClass} defaultValue={vendor.type}>
              <option value="individual">Individual professional</option>
              <option value="agency">Agency / company</option>
            </select>
          </Field>
          <Field label="GSTIN"><input name="gstin" className={`${inputClass} uppercase`} defaultValue={vendor.gstin ?? ''} maxLength={15} /></Field>
          <Field label="City" required>
            <select name="city_id" className={inputClass} defaultValue={vendor.city_id ?? cities[0]?.id}>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Years of experience"><input name="years_experience" type="number" min={0} className={inputClass} defaultValue={vendor.years_experience ?? ''} /></Field>
          <Field label="Team size"><input name="team_size" type="number" min={0} className={inputClass} defaultValue={vendor.team_size ?? ''} /></Field>
        </div>
        <Field label="About your business"><textarea name="about" rows={3} className={inputClass} defaultValue={vendor.about ?? ''} maxLength={1500} /></Field>
        <Field label="Pincodes you serve" help="Comma separated. Leave empty to receive tenders from the whole city.">
          <input name="pincodes" className={inputClass} defaultValue={pincodes} />
        </Field>
        <div>
          <p className="text-sm font-medium text-slate-800">Services <span className="text-red-600">*</span></p>
          <div className="mt-2 space-y-3">
            {groups.map((g) => (
              <div key={g.sector}>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{g.sector}</p>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {g.subs.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
                      <input type="checkbox" name="category_ids" value={s.id} defaultChecked={selected.includes(s.id)} className="h-4 w-4 accent-brand-700" />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        {state?.error && <Alert>{state.error}</Alert>}
        {state?.ok && <Alert tone="green">{state.ok}</Alert>}
        <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
      </Card>
    </form>
  );
}
