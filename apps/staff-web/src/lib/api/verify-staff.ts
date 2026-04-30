import type { NextRequest } from 'next/server';
import { getStaffClaims } from './jwt-claims';
import { jsonError } from './response';
import { getSupabaseAdmin } from './verify-admin';
import { verifyTenantClaim } from './verify-tenant-claim';

/**
 * Verify the request is from any authenticated, active staff member.
 * Returns the staff record { id, role, tenant_id } if valid,
 * or a NextResponse error.
 *
 * Cross-checks `tenant_id` against the `tenants` and `staff` tables — a
 * forged JWT with a swapped tenant_id would otherwise route the caller
 * into another tenant's service-role queries (RLS still scopes, but
 * server-side handlers with `getSupabaseAdmin()` bypass RLS).
 */
export async function verifyStaff(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError('Unauthorized', 401);
  }

  const token = authHeader.slice(7);
  const supabaseAdmin = getSupabaseAdmin();

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return jsonError('Unauthorized', 401);
  }

  const claims = getStaffClaims(user, token);
  if (!claims) {
    return jsonError('Forbidden: active staff required', 403);
  }

  const claimErr = await verifyTenantClaim(claims.staff_id, claims.tenant_id, supabaseAdmin);
  if (claimErr) {
    return jsonError(`Forbidden: ${claimErr}`, 403);
  }

  return {
    id: claims.staff_id,
    role: claims.user_role,
    tenant_id: claims.tenant_id,
  };
}
