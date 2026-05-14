import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { jsonOk } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { verifyStaff } from '@/lib/api/verify-staff';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

// Expo push tokens are opaque strings of the shape
// `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]`. Validate the prefix loosely so
// device-development tokens (which can omit the bracket form) still pass.
const RegisterPushTokenSchema = z.object({
  expo_token: z.string().min(20).max(200),
  platform: z.enum(['ios', 'android']).optional().nullable(),
});

/**
 * Bind an Expo push token to the calling staff member.
 *
 * The DELETE-then-INSERT sequence is the cross-tenant eviction the audit
 * requires: if the same physical device previously belonged to a different
 * tenant's user (handoff at end-of-shift, factory-reset reuse, …), the prior
 * row is removed before the new row binds, so the dispatcher can never reach
 * the previous tenant from this device. The global UNIQUE on `expo_token`
 * guarantees no duplicate row survives.
 */
export async function POST(request: NextRequest) {
  try {
    const staffOrError = await verifyStaff(request);
    if (staffOrError instanceof NextResponse) return staffOrError;

    const { data, error } = await validateBody(request, RegisterPushTokenSchema);
    if (error) return error;

    const admin = getSupabaseAdmin();

    // Cross-tenant DELETE first. This is intentionally not scoped by
    // tenant_id — the same expo_token can only ever live with one staff
    // member, regardless of tenant.
    const { error: deleteErr } = await admin
      .from('staff_push_tokens')
      .delete()
      .eq('expo_token', data.expo_token);

    if (deleteErr) throw deleteErr;

    const { data: inserted, error: insertErr } = await admin
      .from('staff_push_tokens')
      .insert({
        tenant_id: staffOrError.tenant_id,
        staff_id: staffOrError.id,
        expo_token: data.expo_token,
        platform: data.platform ?? null,
        last_seen_at: new Date().toISOString(),
      })
      .select('id, tenant_id, staff_id, expo_token, platform, last_seen_at')
      .single();

    if (insertErr) throw insertErr;

    return jsonOk({ token: inserted }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
