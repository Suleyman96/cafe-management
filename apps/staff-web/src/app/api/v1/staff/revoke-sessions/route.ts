import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonError, jsonOk, jsonRateLimited } from '@/lib/api/response';
import { getSupabaseAdmin, verifyAdmin } from '@/lib/api/verify-admin';

// C3 — revoke all refresh tokens + sessions for a target staff member.
//
// Used by the staff-edit modal when admin flips `is_active: false`.
// Self-service password change does NOT call this route — it uses
// `supabase.auth.signOut({ scope: 'others' })` from the client, which
// is JWT-keyed (caller has their own JWT) and keeps the current
// session alive. See `admin_revoke_user_sessions` migration for why a
// userId-keyed server route is needed for the admin-deactivation case.

const RevokeSessionsSchema = z.object({
  staffId: z.string().uuid('Invalid staff ID format'),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('revoke-sessions', ip);
    if (!success) return jsonRateLimited(resetAt);

    const adminOrError = await verifyAdmin(request);
    if (adminOrError instanceof NextResponse) return adminOrError;

    const body = await request.json();
    const parsed = RevokeSessionsSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Validation failed', 400, {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }
    const { staffId } = parsed.data;

    const supabaseAdmin = getSupabaseAdmin();

    // Tenant scoping is enforced here, not in the RPC. Looking up the
    // target staff under the admin's own tenant ensures an admin from
    // tenant A can't revoke tokens for a user in tenant B even if the
    // admin somehow obtained tenant B's staff id.
    const { data: staffData, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('auth_user_id')
      .eq('id', staffId)
      .eq('tenant_id', adminOrError.tenant_id)
      .single();

    if (staffError || !staffData) {
      return jsonError('Staff member not found', 404);
    }

    if (!staffData.auth_user_id) {
      // No linked auth user — nothing to revoke. Treat as success so
      // the client can call this unconditionally on deactivation
      // without first having to know whether the staff has an auth row.
      return jsonOk({ success: true, revoked: 0 });
    }

    const { data: revokedCount, error: rpcError } = await supabaseAdmin.rpc(
      'admin_revoke_user_sessions',
      { p_user_id: staffData.auth_user_id },
    );

    if (rpcError) {
      Sentry.captureException(rpcError, {
        tags: { area: 'staff.revoke-sessions' },
        extra: { staffId },
      });
      return jsonError('Failed to revoke sessions', 500);
    }

    return jsonOk({ success: true, revoked: revokedCount ?? 0 });
  } catch (err) {
    return handleRouteError(err);
  }
}
