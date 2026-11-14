import Link from 'next/link';
import { Bell, LogOut, Repeat } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { switchRole } from '@/app/actions/profile';
import { getSession } from '@/lib/auth';

export async function AppShell({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await getSession();
  let unread = 0;
  if (user) {
    const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
    unread = count ?? 0;
  }
  const role = profile?.active_role;

  const links =
    role === 'vendor'
      ? [
          { href: '/vendor', label: 'Tender feed' },
          { href: '/vendor/quotes', label: 'My quotes' },
          { href: '/vendor/profile', label: 'Profile & KYC' },
        ]
      : role === 'buyer'
        ? [
            { href: '/buyer', label: 'My tenders' },
            { href: '/buyer/tenders/new', label: 'Post a tender' },
          ]
        : [];
  if (profile?.is_admin) links.push({ href: '/admin', label: 'Admin' });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Logo href={role === 'vendor' ? '/vendor' : role === 'buyer' ? '/buyer' : '/'} />
          {user ? (
            <div className="flex items-center gap-1 sm:gap-2">
              {role && (
                <form action={switchRole}>
                  <input type="hidden" name="role" value={role === 'vendor' ? 'buyer' : 'vendor'} />
                  <button className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 sm:text-sm" title="Switch mode">
                    <Repeat className="h-4 w-4" />
                    <span className="hidden sm:inline">{role === 'vendor' ? 'Switch to buyer' : 'I am a vendor'}</span>
                  </button>
                </form>
              )}
              <Link href="/notifications" className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-brand-900">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </Link>
              <form action="/auth/signout" method="post">
                <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Sign out" title="Sign out">
                  <LogOut className="h-5 w-5" />
                </button>
              </form>
            </div>
          ) : (
            <Link href="/login" className="text-sm font-semibold text-brand-700">Log in</Link>
          )}
        </div>
        {links.length > 0 && (
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-700">
                {l.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        Tender Zipper connects you directly with vendors. Zero commission — you deal and pay directly.
      </footer>
    </div>
  );
}
