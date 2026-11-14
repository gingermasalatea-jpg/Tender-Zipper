import Link from 'next/link';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-extrabold tracking-tight text-brand-700">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-700 text-sm text-accent-400">TZ</span>
      <span className="text-lg">Tender<span className="text-accent-500">Zipper</span></span>
    </Link>
  );
}
