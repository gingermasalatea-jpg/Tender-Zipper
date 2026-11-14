'use client';
import { useActionState, useState } from 'react';
import { Briefcase, Home } from 'lucide-react';
import { completeOnboarding } from '@/app/actions/profile';
import { Alert, Card, Field, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { cn } from '@/lib/format';
import type { City } from '@/lib/types';

interface Group {
  sector: string;
  categories: { name: string; subs: { id: number; name: string }[] }[];
}

export function OnboardingForm(props: { defaultRole: 'buyer' | 'vendor'; defaultName: string; defaultEmail: string; cities: City[]; groups: Group[] }) {
  const [role, setRole] = useState(props.defaultRole);
  const [state, action] = useActionState(completeOnboarding, undefined);

  return (
    <form action={action} className="mt-6 space-y-6">
      <input type="hidden" name="role" value={role} />
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { value: 'buyer' as const, icon: Home, title: 'I want to get work done', text: 'Post tenders for my home, society or office' },
          { value: 'vendor' as const, icon: Briefcase, title: 'I provide services / products', text: 'Find tenders and send quotes' },
        ].map(({ value, icon: Icon, title, text }) => (
          <button
            key={value}
            type="button"
            onClick={() => setRole(value)}
            className={cn('rounded-xl border-2 p-4 text-left transition', role === value ? 'border-brand-700 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300')}
          >
            <Icon className={cn('h-6 w-6', role === value ? 'text-brand-700' : 'text-slate-400')} />
            <p className="mt-2 font-semibold">{title}</p>
            <p className="text-sm text-slate-600">{text}</p>
          </button>
        ))}
      </div>

      <Card className="space-y-4">
        <Field label="Your full name" required>
          <input name="full_name" className={inputClass} defaultValue={props.defaultName} required minLength={2} />
        </Field>
        <Field label="Email (for quote alerts & work orders)">
          <input name="email" type="email" className={inputClass} defaultValue={props.defaultEmail} placeholder="you@example.com" />
        </Field>
      </Card>

      {role === 'vendor' && (
        <Card className="space-y-4">
          <h2 className="font-semibold text-slate-900">Business details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business / trade name" required>
              <input name="business_name" className={inputClass} placeholder="Shree Painters" />
            </Field>
            <Field label="You are">
              <select name="vendor_type" className={inputClass} defaultValue="individual">
                <option value="individual">Individual professional</option>
                <option value="agency">Agency / company</option>
              </select>
            </Field>
            <Field label="City" required>
              <select name="city_id" className={inputClass} defaultValue={props.cities[0]?.id}>
                {props.cities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Years of experience">
              <input name="years_experience" type="number" min={0} max={80} className={inputClass} />
            </Field>
          </div>
          <Field label="Pincodes you serve" help="Comma separated, e.g. 380058, 380015. Leave empty to receive tenders from the whole city.">
            <input name="pincodes" className={inputClass} placeholder="Leave empty for whole city" />
          </Field>
          <div>
            <p className="text-sm font-medium text-slate-800">Services you provide <span className="text-red-600">*</span></p>
            <div className="mt-3 space-y-4">
              {props.groups.map((g) => (
                <div key={g.sector}>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{g.sector}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {g.categories.flatMap((c) =>
                      c.subs.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
                          <input type="checkbox" name="category_ids" value={s.id} className="h-4 w-4 accent-brand-700" />
                          {s.name}
                        </label>
                      )),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {state?.error && <Alert>{state.error}</Alert>}
      <SubmitButton size="lg" className="w-full sm:w-auto" pendingText="Saving…">
        {role === 'vendor' ? 'Create vendor profile' : 'Continue'}
      </SubmitButton>
    </form>
  );
}
