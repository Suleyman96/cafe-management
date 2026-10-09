import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonRateLimited } from '@/lib/api/response';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { isAuthorizedCron } from '@/lib/api/verify-cron-secret';
import { verifyPlatformAdmin } from '@/lib/api/verify-platform-admin';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

// Dedupe: not needed — the `run_data_retention` RPC operates on time-windowed
// rows (delete-where-expired). A replay finds nothing left to delete and
// returns the same shape. Caller is an internal scheduler / platform one-shot.

export async function POST(request: NextRequest) {
  try {
    // H2: `run_data_retention` deletes across ALL tenants, so it must NEVER be
    // reachable by a single tenant's admin (the old `verifyAdmin` fallback let
    // any tenant admin fire a platform-wide purge). Authorize ONLY via the
    // `x-cron-secret` shared secret (the GitHub Actions scheduler) OR the
    // platform-operator gate. When the cron secret is unset, `isAuthorizedCron`
    // is false and the endpoint is platform-admin-only (fail-closed).
    let actorId = getRateLimitIdentifier(request);
    if (!isAuthorizedCron(request)) {
      const adminOrError = await verifyPlatformAdmin(request);
      if (adminOrError instanceof NextResponse) return adminOrError;
      actorId = adminOrError.id;
    }

    const { success, resetAt } = await rateLimit('platform', actorId);
    if (!success) return jsonRateLimited(resetAt);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('run_data_retention');

    if (error) {
      return NextResponse.json({ error: 'Retention failed' }, { status: 500 });
    }

    return NextResponse.json({ status: 'completed', results: data });
  } catch (err) {
    return handleRouteError(err, request);
  }
}
