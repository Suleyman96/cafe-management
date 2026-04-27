import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { validatePassword } from '@/lib/api/password-validation';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { getSupabaseAdmin, verifyAdmin } from '@/lib/api/verify-admin';

const CreateStaffSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  full_name: z.string().min(1, 'Name is required').max(100),
  role: z.enum(['waiter', 'admin', 'kitchen', 'owner']),
  phone: z
    .string()
    .regex(/^[+\d\s\-()]{7,20}$/, 'Invalid phone format')
    .optional()
    .nullable(),
});

async function findAuthUserByEmail(supabaseAdmin: SupabaseClient, email: string) {
  let page = 1;
  const perPage = 100;
  while (true) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (!data?.users?.length) return null;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < perPage) return null;
    page++;
  }
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('staff', ip);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)) },
        },
      );
    }

    const adminOrError = await verifyAdmin(request);
    if (adminOrError instanceof NextResponse) return adminOrError;

    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();

    const parseResult = CreateStaffSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 },
      );
    }
    const { email, password, full_name, role, phone } = parseResult.data;

    // Validate password strength
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json({ error: passwordCheck.errors.join('. ') }, { status: 400 });
    }

    // Create auth user using admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for staff accounts
    });

    let authUserId: string;
    let createdNewAuthUser = true;

    if (authError) {
      // If the auth user already exists (e.g., same person at another tenant), reuse it
      if (authError.message?.includes('already been registered') || authError.status === 422) {
        const found = await findAuthUserByEmail(supabaseAdmin, email);
        if (!found) {
          Sentry.captureException(authError);
          return NextResponse.json({ error: 'Failed to create user account' }, { status: 400 });
        }
        authUserId = found.id;
        createdNewAuthUser = false;
      } else {
        Sentry.captureException(authError);
        return NextResponse.json({ error: 'Failed to create user account' }, { status: 400 });
      }
    } else if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    } else {
      authUserId = authData.user.id;
    }

    // Create staff record
    const { data: staffData, error: staffError } = await supabaseAdmin
      .from('staff')
      .insert({
        email,
        full_name,
        role,
        phone: phone || null,
        is_active: true,
        auth_user_id: authUserId,
        tenant_id: adminOrError.tenant_id,
      })
      .select()
      .single();

    if (staffError) {
      Sentry.captureException(staffError);
      // Only delete the auth user if we created it (not if it already existed)
      if (createdNewAuthUser && authData?.user) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      }
      return NextResponse.json({ error: 'Failed to create staff record' }, { status: 400 });
    }

    return NextResponse.json({ staff: staffData }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('staff', ip);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)) },
        },
      );
    }

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
      Sentry.captureException(deleteError);
      return NextResponse.json({ error: 'Failed to delete staff member' }, { status: 400 });
    }

    // Only delete the auth user if no other staff records reference it
    if (staffData.auth_user_id) {
      const { count } = await supabaseAdmin
        .from('staff')
        .select('id', { count: 'exact', head: true })
        .eq('auth_user_id', staffData.auth_user_id);

      if (!count || count === 0) {
        await supabaseAdmin.auth.admin.deleteUser(staffData.auth_user_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
