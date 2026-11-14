'use client';
import { Button } from '@/components/ui';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-white p-6 text-center">
      <p className="font-semibold text-slate-900">Something went wrong</p>
      <p className="mt-1 text-sm text-slate-600">{error.message || 'Please try again.'}</p>
      <Button className="mt-4" onClick={reset}>Try again</Button>
    </div>
  );
}
