'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Alert, Button, Field, inputClass } from '@/components/ui';
import { cn } from '@/lib/format';

type Mode = 'phone' | 'email';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const [mode, setMode] = useState<Mode>('phone');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'enter' | 'verify'>('enter');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const target = mode === 'phone' ? `+91${identifier.replace(/\D/g, '').slice(-10)}` : identifier.trim().toLowerCase();

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === 'phone' && !/^[6-9]\d{9}$/.test(identifier.replace(/\D/g, '').slice(-10))) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    setBusy(true);
    const { error } = mode === 'phone' ? await supabase.auth.signInWithOtp({ phone: target }) : await supabase.auth.signInWithOtp({ email: target });
    setBusy(false);
    if (error) setError(error.message);
    else setStep('verify');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } =
      mode === 'phone'
        ? await supabase.auth.verifyOtp({ phone: target, token: otp, type: 'sms' })
        : await supabase.auth.verifyOtp({ email: target, token: otp, type: 'email' });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace(next && next.startsWith('/') ? next : '/onboarding');
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">{step === 'enter' ? 'Log in or sign up' : 'Enter the code'}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {step === 'enter' ? 'We will send you a one-time code.' : `Sent to ${mode === 'phone' ? target : identifier}`}
      </p>

      {step === 'enter' && (
        <div className="mt-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
          {(['phone', 'email'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setIdentifier('');
                setError(null);
              }}
              className={cn('rounded-md py-1.5', mode === m ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600')}
            >
              {m === 'phone' ? 'Mobile' : 'Email'}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={step === 'enter' ? sendOtp : verify} className="mt-5 space-y-4">
        {step === 'enter' ? (
          mode === 'phone' ? (
            <Field label="Mobile number">
              <div className="flex">
                <span className="grid place-items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-600">+91</span>
                <input
                  className={cn(inputClass, 'rounded-l-none')}
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="98XXXXXXXX"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>
            </Field>
          ) : (
            <Field label="Email">
              <input className={inputClass} type="email" autoComplete="email" placeholder="you@example.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
            </Field>
          )
        ) : (
          <Field label="6-digit code">
            <input
              className={cn(inputClass, 'text-center text-lg tracking-[0.5em]')}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
            />
          </Field>
        )}
        {error && <Alert>{error}</Alert>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Please wait…' : step === 'enter' ? 'Send code' : 'Verify & continue'}
        </Button>
        {step === 'verify' && (
          <button type="button" className="w-full text-sm font-medium text-brand-700" onClick={() => { setStep('enter'); setOtp(''); }}>
            Change {mode === 'phone' ? 'number' : 'email'}
          </button>
        )}
      </form>
    </div>
  );
}
