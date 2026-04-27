import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getSupabaseAdmin, verifyAdmin } from '@/lib/api/verify-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const adminOrError = await verifyAdmin(request);
    if (adminOrError instanceof NextResponse) return adminOrError;

    const supabase = getSupabaseAdmin();

    const [slowQueries, connStats, tableStats] = await Promise.all([
      supabase.rpc('get_slow_queries', { p_limit: 10 }),
      supabase.rpc('get_connection_stats'),
      supabase.rpc('get_table_stats'),
    ]);

    return NextResponse.json({
      slow_queries: slowQueries.data || [],
      connections: connStats.data || [],
      tables: tableStats.data || [],
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
