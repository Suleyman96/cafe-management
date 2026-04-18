import type { NextRequest } from 'next/server';
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

  const { data: staffData, error: staffError } = await supabaseAdmin
    .from('staff')
    .select('id, role, tenant_id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .single();

  if (staffError || !staffData) {
    return jsonError('Forbidden: active staff required', 403);
  }

  return staffData;
}
