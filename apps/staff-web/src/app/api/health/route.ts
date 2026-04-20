import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('cafe_settings').select('id').limit(1);

    return NextResponse.json({
      status: error ? 'degraded' : 'ok',
      timestamp,
      db: error ? 'unreachable' : 'connected',
    });
  } catch {
    return NextResponse.json({ status: 'error', timestamp, db: 'unreachable' }, { status: 503 });
  }
}
