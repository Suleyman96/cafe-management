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
    if (!['waiter', 'admin', 'kitchen'].includes(role)) {
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
