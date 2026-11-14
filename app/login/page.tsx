import { Suspense } from 'react';
import { Logo } from '@/components/Logo';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-white px-4">
      <Logo />
      <div className="mt-6 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
      <p className="mt-6 max-w-sm text-center text-xs text-slate-500">
        By continuing you agree to Tender Zipper&apos;s Terms and Privacy Policy. Your number is never shown to vendors until you shortlist them.
      </p>
    </div>
  );
}
