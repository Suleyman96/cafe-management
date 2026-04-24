import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const supabase = getSupabaseAdmin();

    const { error: dbError } = await supabase.from('cafe_settings').select('id').limit(1);

    if (dbError) {
      return NextResponse.json({
        status: 'degraded',
        timestamp,
        db: 'unreachable',
      });
    }

    const { data: connStats } = await supabase.rpc('get_connection_stats');

    const activeConnections = (connStats || []).reduce(
      (sum: number, row: { connection_count: number }) => sum + Number(row.connection_count),
      0,
    );

    return NextResponse.json({
      status: 'ok',
      timestamp,
      db: 'connected',
      connections: activeConnections,
    });
  } catch {
    return NextResponse.json({ status: 'error', timestamp, db: 'unreachable' }, { status: 503 });
  }
}
