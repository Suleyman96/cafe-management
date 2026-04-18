import { type NextRequest, NextResponse } from 'next/server';
import { validatePassword } from '@/lib/api/password-validation';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { getSupabaseAdmin, verifyAdmin } from '@/lib/api/verify-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 requests per 5 minutes per IP (stricter for password reset)
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = rateLimit(`password-reset:${ip}`, {
      limit: 5,
      windowSeconds: 300,
    });
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)) },
        },
      );
    }

    // Verify caller is an authenticated admin
    const adminOrError = await verifyAdmin(request);
    if (adminOrError instanceof NextResponse) return adminOrError;

    const body = await request.json();
    const { staffId, newPassword } = body;

    if (!staffId || !newPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate password strength
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      return NextResponse.json({ error: passwordCheck.errors.join('. ') }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Fetch staff record — scoped to admin's tenant to prevent cross-tenant access
    const { data: staffData, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('auth_user_id')
      .eq('id', staffId)
      .eq('tenant_id', adminOrError.tenant_id)
      .single();

    if (staffError || !staffData) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    if (!staffData.auth_user_id) {
      return NextResponse.json(
        { error: 'Staff member has no linked auth account' },
        { status: 400 },
      );
    }

    // Update password using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      staffData.auth_user_id,
      { password: newPassword },
    );

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
