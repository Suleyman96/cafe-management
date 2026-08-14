import { type NextRequest, NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { verifyPlatformAdmin } from '@/lib/api/verify-platform-admin';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

/**
 * GET /api/v1/platform/me — cheap gate check so the client can show/hide the
 * platform console. 200 = platform admin; 403 otherwise. The actual routes are
 * independently gated server-side, so this is only a UI hint.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyPlatformAdmin(request);
    if (admin instanceof NextResponse) return admin;
    return NextResponse.json({ isPlatformAdmin: true, email: admin.email });
  } catch (err) {
    return handleRouteError(err, request);
  }
}
