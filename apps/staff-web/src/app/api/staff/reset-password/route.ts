import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { validatePassword } from '@/lib/api/password-validation';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { getSupabaseAdmin, verifyAdmin } from '@/lib/api/verify-admin';

const ResetPasswordSchema = z.object({
  staffId: z.string().uuid('Invalid staff ID format'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('password-reset', ip);
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

    const parseResult = ResetPasswordSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 },
      );
    }
    const { staffId, newPassword } = parseResult.data;

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
      Sentry.captureException(updateError);
      return NextResponse.json({ error: 'Failed to reset password' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
