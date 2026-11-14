import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notificationEmail, sendEmail } from '@/lib/email';

/** Emails notifications that haven't been emailed yet (users with an email address). */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ skipped: 'RESEND_API_KEY not set' });

  const db = createAdminClient();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { data: rows, error } = await db
    .from('notifications')
    .select('id, title, body, link, profiles!inner(email)')
    .is('emailed_at', null)
    .gte('created_at', since)
    .not('profiles.email', 'is', null)
    .order('created_at')
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const n of rows ?? []) {
    const email = (n.profiles as unknown as { email: string }).email;
    const ok = await sendEmail(email, n.title, notificationEmail(n.title, n.body, n.link));
    if (ok) {
      await db.from('notifications').update({ emailed_at: new Date().toISOString() }).eq('id', n.id);
      sent++;
    }
  }
  return NextResponse.json({ sent });
}
