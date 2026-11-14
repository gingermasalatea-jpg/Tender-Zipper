import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/** Closes tenders whose quote deadline has passed. Scheduled by vercel.json. */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data, error } = await createAdminClient().rpc('close_expired_tenders');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ closed: data });
}
