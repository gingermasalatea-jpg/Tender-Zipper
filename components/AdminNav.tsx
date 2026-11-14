import Link from 'next/link';

export function AdminNav() {
  const links = [
    ['/admin', 'Overview'],
    ['/admin/kyc', 'KYC & vendors'],
    ['/admin/tenders', 'Tenders'],
    ['/admin/categories', 'Categories & templates'],
  ];
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {links.map(([href, label]) => (
        <Link key={href} href={href} className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:ring-brand-600">
          {label}
        </Link>
      ))}
    </div>
  );
}
