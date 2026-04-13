import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, verifyAdmin } from '@/lib/api/verify-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verify caller is an authenticated admin
    const adminOrError = await verifyAdmin(request);
    if (adminOrError instanceof NextResponse) return adminOrError;

    const body = await request.json();
    const { email, password, full_name, role, phone } = body;

    // Validate required fields
    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate role
    if (!['waiter', 'admin', 'kitchen', 'owner'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Create auth user using admin API
    const { data: authData, error: authError } = await getSupabaseAdmin().auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for staff accounts
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Create staff record
    const { data: staffData, error: staffError } = await getSupabaseAdmin()
      .from('staff')
      .insert({
        email,
        full_name,
        role,
        phone: phone || null,
        is_active: true,
        auth_user_id: authData.user.id,
        tenant_id: adminOrError.tenant_id,
      })
      .select()
      .single();

    if (staffError) {
      // Rollback: delete the auth user if staff creation fails
      await getSupabaseAdmin().auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: staffError.message }, { status: 400 });
    }

    return NextResponse.json({ staff: staffData }, { status: 201 });
  } catch (error) {
    console.error('Error creating staff:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const adminOrError = await verifyAdmin(request);
    if (adminOrError instanceof NextResponse) return adminOrError;

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('id');

    if (!staffId) {
      return NextResponse.json({ error: 'Missing staff ID' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Fetch staff record to get auth_user_id
    const { data: staffData, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, auth_user_id, tenant_id')
      .eq('id', staffId)
      .eq('tenant_id', adminOrError.tenant_id)
      .single();

    if (staffError || !staffData) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    // Prevent self-deletion
    if (staffData.id === adminOrError.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    // Delete staff record first
    const { error: deleteError } = await supabaseAdmin.from('staff').delete().eq('id', staffId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    // Delete auth user if linked
    if (staffData.auth_user_id) {
      await supabaseAdmin.auth.admin.deleteUser(staffData.auth_user_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting staff:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
