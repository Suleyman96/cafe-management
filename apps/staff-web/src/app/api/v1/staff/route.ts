import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { validatePassword } from '@/lib/api/password-validation';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonRateLimited } from '@/lib/api/response';
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
export const preferredRegion = ['sin1'];

// Dedupe: not applied. Mobile does not call this route — staff CRUD is web-only
// per the Mobile Parity rule, and the web UI doesn't replay through a persister.
// Concurrency is bounded by the UNIQUE constraint on `staff.email` and the
// service-role auth-user lookup that reuses an existing auth user when one is
// found, so a duplicate POST collapses on the second insert with a 23505 error
// rather than creating two rows.

export async function POST(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('staff', ip);
    if (!success) return jsonRateLimited(resetAt);

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
    return handleRouteError(err, request);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('staff', ip);
    if (!success) return jsonRateLimited(resetAt);

    const adminOrError = await verifyAdmin(request);
    if (adminOrError instanceof NextResponse) return adminOrError;

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('id');

    if (!staffId) {
      return NextResponse.json({ error: 'Missing staff ID' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Confirm the staff member exists in the admin's tenant.
    const { data: staffData, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, tenant_id')
      .eq('id', staffId)
      .eq('tenant_id', adminOrError.tenant_id)
      .single();

    if (staffError || !staffData) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    // Prevent self-deactivation
    if (staffData.id === adminOrError.id) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 });
    }

    // Soft-remove via deactivation rather than a hard DELETE (M8). A hard
    // delete either FK-fails (refunds.processed_by, orders.delivery_person_id,
    // and staff_schedules.staff_id are ON DELETE RESTRICT) or nulls out
    // historical attribution (assigned_waiter, discount_applied_by, stock
    // performed_by, …). Deactivation keeps the row and all history intact;
    // `current_tenant_id()` only resolves for `is_active` staff, so a
    // deactivated member is fully locked out of tenant data and an admin can
    // re-activate them later. The auth user is intentionally retained so that
    // re-activation restores access — it is not destroyed here.
    //
    // (This mirrors `db.staff.delete()` in @gustri/api-client, which already
    // sets is_active=false; converting this route removes the last hard-delete
    // path so the two staff-removal entry points are consistent.)
    const { error: deactivateError } = await supabaseAdmin
      .from('staff')
      .update({ is_active: false })
      .eq('id', staffId);

    if (deactivateError) {
      Sentry.captureException(deactivateError);
      return NextResponse.json({ error: 'Failed to deactivate staff member' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError(err, request);
  }
}
