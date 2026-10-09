import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { rateLimit } from '@/lib/api/rate-limit';
import { jsonRateLimited } from '@/lib/api/response';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { verifyPlatformAdmin } from '@/lib/api/verify-platform-admin';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

export async function GET(request: NextRequest) {
  try {
    // M1: db-stats returns platform-wide telemetry (slow queries, connection
    // stats, table sizes across every tenant's data). A per-tenant admin must
    // not see it — gate on the platform operator, not `verifyAdmin`.
    const adminOrError = await verifyPlatformAdmin(request);
    if (adminOrError instanceof NextResponse) return adminOrError;

    const { success, resetAt } = await rateLimit('platform', adminOrError.id);
    if (!success) return jsonRateLimited(resetAt);

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
    return handleRouteError(err, request);
  }
}
