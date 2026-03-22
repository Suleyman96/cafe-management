import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, verifyAdmin } from '@/lib/api/verify-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verify caller is an authenticated admin
    const adminOrError = await verifyAdmin(request);
    if (adminOrError instanceof NextResponse) return adminOrError;

    const body = await request.json();
    const { staffId, newPassword } = body;

    if (!staffId || !newPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Fetch staff record to get auth_user_id
    const { data: staffData, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('auth_user_id')
      .eq('id', staffId)
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
