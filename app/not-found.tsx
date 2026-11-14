import { LinkButton } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <p className="text-5xl font-extrabold text-brand-700">404</p>
        <p className="mt-2 text-slate-600">This page doesn&apos;t exist or you don&apos;t have access to it.</p>
        <LinkButton href="/" className="mt-6">Go home</LinkButton>
      </div>
    </div>
  );
}
