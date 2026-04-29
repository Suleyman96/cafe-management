import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';

export const dynamic = 'force-dynamic';

const RevokePushTokenSchema = z.object({
  expo_token: z.string().min(20).max(200),
});

/**
 * Detach an Expo push token from whichever staff currently owns it.
 *
 * Intentionally **unauthenticated**: a logout that happened offline drains
 * its queued revoke from the new login session (different user) or before
 * any user logs in, so requiring `verifyStaff` would strand the request.
 * Holding the token is itself proof of device ownership — it's stored in
 * the OS keystore on the device that registered it. Combined with the
 * global UNIQUE constraint, the worst case for a leaked token is the
 * legitimate owner losing push notifications until they re-register.
 *
 * Idempotent: 200 even when zero rows match (the row was already deleted
 * by a fresh register call from another device, etc.). Rate-limited per
 * IP to prevent enumeration attacks.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('push-token-revoke', ip);
    if (!success) return jsonRateLimited(resetAt);

    const { data, error } = await validateBody(request, RevokePushTokenSchema);
    if (error) return error;

    const admin = getSupabaseAdmin();

    const { error: deleteErr } = await admin
      .from('staff_push_tokens')
      .delete()
      .eq('expo_token', data.expo_token);

    if (deleteErr) throw deleteErr;

    return jsonOk({ revoked: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
