import { ArrowRight, BadgeCheck, Building2, ClipboardList, Columns3, Home, IndianRupee, ShieldCheck, Users } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { LinkButton } from '@/components/ui';
import { getSession } from '@/lib/auth';

export default async function Landing() {
  const { profile } = await getSession();
  const startHref = profile?.active_role === 'vendor' ? '/vendor' : profile ? '/buyer/tenders/new' : '/login?next=/buyer/tenders/new';
  const vendorHref = profile ? '/onboarding?role=vendor' : '/login?next=/onboarding?role=vendor';

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <LinkButton href={profile ? (profile.active_role === 'vendor' ? '/vendor' : '/buyer') : '/login'} variant="outline" size="sm">
          {profile ? 'Open dashboard' : 'Log in'}
        </LinkButton>
      </header>

      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          <div>
            <span className="inline-block rounded-full bg-accent-400/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-600">
              Zero commission · Now live in Ahmedabad
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight text-brand-900 md:text-5xl">
              Post once. Get verified quotes. <span className="text-accent-500">Choose with confidence.</span>
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              Painting, wiring, plumbing, housekeeping, security guards, furniture and more — for your flat, society or office. Vendors come to you with
              comparable quotes. You pick, and deal directly.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href={startHref} size="lg">
                Post a tender — it&apos;s free <ArrowRight className="h-5 w-5" />
              </LinkButton>
              <LinkButton href={vendorHref} size="lg" variant="outline">
                I&apos;m a vendor
              </LinkButton>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-xs font-semibold uppercase text-slate-500">Tender TZ-AMD-000123 · Bopal</p>
            <p className="mt-1 text-lg font-bold">Paint my 2BHK flat — 1,200 sq ft, premium emulsion</p>
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 text-sm">
              <div className="grid grid-cols-4 bg-slate-50 font-semibold">
                <span className="p-2">Line item</span><span className="p-2">Vendor A</span><span className="p-2">Vendor B</span><span className="p-2">Vendor C</span>
              </div>
              {[
                ['Putty / sq ft', '₹7', '₹6', '₹8'],
                ['Paint / sq ft', '₹18', '₹21', '₹17'],
                ['Timeline', '6 days', '5 days', '8 days'],
                ['Total', '₹35,400', '₹36,816', '₹35,400'],
              ].map((r) => (
                <div key={r[0]} className="grid grid-cols-4 border-t border-slate-100">
                  {r.map((c, i) => (
                    <span key={i} className={`p-2 ${i === 0 ? 'text-slate-500' : 'font-medium'}`}>{c}</span>
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">Side-by-side, apples-to-apples. Contact details unlock only when you shortlist.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-center text-2xl font-bold text-brand-900">How it works</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-4">
          {[
            { icon: ClipboardList, t: 'Post a tender card', d: 'Pick the work, fill a short smart form, add photos. Free.' },
            { icon: Users, t: 'Verified vendors quote', d: 'Only matching vendors in your area — max 10 quotes, no spam calls.' },
            { icon: Columns3, t: 'Compare side by side', d: 'Same line items for everyone, so prices are truly comparable.' },
            { icon: BadgeCheck, t: 'Award & get a work order', d: 'Shortlist, talk, award. Deal and pay the vendor directly.' },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-xl border border-slate-200 p-5">
              <Icon className="h-7 w-7 text-brand-700" />
              <p className="mt-3 font-semibold">{t}</p>
              <p className="mt-1 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand-900 text-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-3">
          {[
            { icon: Home, t: 'Homes & flats', d: 'Painting, wiring, plumbing, furniture.' },
            { icon: Building2, t: 'Societies & offices', d: 'Housekeeping and security contracts with transparent comparison for your committee.' },
            { icon: IndianRupee, t: 'Zero commission', d: 'We are only the bridge. No mark-ups, no cut from your job value.' },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t}>
              <Icon className="h-7 w-7 text-accent-400" />
              <p className="mt-3 text-lg font-semibold">{t}</p>
              <p className="mt-1 text-sm text-brand-100">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-brand-700" />
        <h2 className="mt-3 text-2xl font-bold text-brand-900">Vendors: get ready-to-quote requirements, not cold leads</h2>
        <p className="mx-auto mt-2 max-w-2xl text-slate-600">
          Every tender comes with area, scope and photos. Quote on what matches your services, win work, keep 100% of your earnings.
        </p>
        <LinkButton href={vendorHref} className="mt-6" variant="accent" size="lg">
          Register as a vendor
        </LinkButton>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Tender Zipper. Tender Zipper is an intermediary platform and is not a party to agreements between buyers and vendors.
      </footer>
    </div>
  );
}
