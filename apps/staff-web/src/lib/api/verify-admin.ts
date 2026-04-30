import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { getStaffClaims } from './jwt-claims';
import { verifyTenantClaim } from './verify-tenant-claim';

let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }
  return _supabaseAdmin;
}

/**
 * Verify the request is from an authenticated admin user.
 * Returns the staff record if valid, or a NextResponse error.
 */
export async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const supabaseAdmin = getSupabaseAdmin();

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const claims = getStaffClaims(user, token);
  if (!claims || !['admin', 'owner'].includes(claims.user_role)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  // Cross-check the claimed tenant_id against the staff row. A forged JWT
  // with a swapped tenant_id would otherwise let the caller act as admin
  // for a tenant they don't belong to, since admin endpoints use the
  // service role and bypass RLS.
  const claimErr = await verifyTenantClaim(claims.staff_id, claims.tenant_id, supabaseAdmin);
  if (claimErr) {
    return NextResponse.json({ error: `Forbidden: ${claimErr}` }, { status: 403 });
  }

  return {
    id: claims.staff_id,
    role: claims.user_role,
    tenant_id: claims.tenant_id,
  };
}
