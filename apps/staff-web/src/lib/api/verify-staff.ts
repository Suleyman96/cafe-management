import type { NextRequest } from 'next/server';
import { getStaffClaims } from './jwt-claims';
import { jsonError } from './response';
import { getSupabaseAdmin } from './verify-admin';

/**
 * Verify the request is from any authenticated, active staff member.
 * Returns the staff record { id, role, tenant_id } if valid,
 * or a NextResponse error.
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

  const claims = getStaffClaims(token);
  if (!claims) {
    return jsonError('Forbidden: active staff required', 403);
  }

  return {
    id: claims.staff_id,
    role: claims.user_role,
    tenant_id: claims.tenant_id,
  };
}
