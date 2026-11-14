import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { markAllNotificationsRead } from '@/app/actions/profile';
import { SubmitButton } from '@/components/SubmitButton';
import { EmptyState, PageHeader } from '@/components/ui';
import { dateTime } from '@/lib/format';
import type { Notification } from '@/lib/types';

export const metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
  const list = (data ?? []) as Notification[];
  const unread = list.some((n) => !n.read_at);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Notifications"
        action={unread ? (
          <form action={markAllNotificationsRead}><SubmitButton variant="outline" size="sm">Mark all as read</SubmitButton></form>
        ) : undefined}
      />
      {!list.length ? (
        <EmptyState title="You're all caught up" />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {list.map((n) => {
            const inner = (
              <div className="flex gap-3 px-4 py-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? 'bg-transparent' : 'bg-accent-500'}`} />
                <div>
                  <p className={`text-sm ${n.read_at ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>{n.title}</p>
                  {n.body && <p className="text-sm text-slate-600">{n.body}</p>}
                  <p className="mt-0.5 text-xs text-slate-400">{dateTime(n.created_at)}</p>
                </div>
              </div>
            );
            return <li key={n.id} className="hover:bg-slate-50">{n.link ? <Link href={n.link}>{inner}</Link> : inner}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
