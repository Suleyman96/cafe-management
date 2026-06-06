import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getSupabaseAdmin, verifyAdmin } from '@/lib/api/verify-admin';
import { isAuthorizedCron } from '@/lib/api/verify-cron-secret';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

// Dedupe: not needed — the `run_data_retention` RPC operates on time-windowed
// rows (delete-where-expired). A replay finds nothing left to delete and
// returns the same shape. Caller is an internal scheduler / admin one-shot.

export async function POST(request: NextRequest) {
  try {
    // Two callers (see the route comment above): the `data-retention` GitHub
    // Actions cron authenticates with the `x-cron-secret` shared secret; an
    // admin running it one-shot from the UI uses their session. When the cron
    // secret is unset, `isAuthorizedCron` returns false and the endpoint stays
    // admin-only (safe default).
    if (!isAuthorizedCron(request)) {
      const adminOrError = await verifyAdmin(request);
      if (adminOrError instanceof NextResponse) return adminOrError;
    }

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
