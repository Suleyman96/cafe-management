import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { verifyPlatformAdmin } from '@/lib/api/verify-platform-admin';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

/**
 * GET /api/v1/platform/tenants — the platform console's tenant list.
 * Platform-admin only; service role reads cross-tenant (bypasses RLS).
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyPlatformAdmin(request);
    if (admin instanceof NextResponse) return admin;

    const supabase = getSupabaseAdmin();

    const [tenantsRes, staffRes, tablesRes] = await Promise.all([
      supabase
        .from('tenants')
        .select(
          'id, name, slug, plan, is_active, created_at, billing_email, deactivated_at, deactivation_reason',
        )
        .order('created_at', { ascending: false }),
      supabase.from('staff').select('tenant_id').eq('is_active', true),
      supabase.from('tables').select('tenant_id'),
    ]);

    if (tenantsRes.error) {
      throw new Error(`platform/tenants: list failed (${tenantsRes.error.message})`);
    }

    // Cheap per-tenant activity signals (staff + tables are small tables).
    // Order counts are heavier and deferred to the tenant-detail view.
    const countBy = (rows: { tenant_id: string | null }[] | null) => {
      const m = new Map<string, number>();
      for (const r of rows ?? []) {
        if (r.tenant_id) m.set(r.tenant_id, (m.get(r.tenant_id) ?? 0) + 1);
      }
      return m;
    };
    const staffCounts = countBy(staffRes.data);
    const tableCounts = countBy(tablesRes.data);

    const tenants = (tenantsRes.data ?? []).map((t) => ({
      ...t,
      staff_count: staffCounts.get(t.id) ?? 0,
      table_count: tableCounts.get(t.id) ?? 0,
    }));

    return NextResponse.json({ tenants, count: tenants.length });
  } catch (err) {
    return handleRouteError(err, request);
  }
}

const CreateTenantSchema = z.object({
  cafe_name: z.string().trim().min(1).max(100),
  owner_email: z.string().trim().email(),
  owner_name: z.string().trim().max(100).optional().nullable(),
  // bcrypt truncates at 72 bytes; min 8 is a sane floor for an admin-set password.
  password: z.string().min(8).max(72),
  plan: z.enum(['free', 'standard', 'pro', 'business']),
});

/**
 * POST /api/v1/platform/tenants — operator-created tenant (manual onboarding).
 *
 * Reuses the self-serve provisioning path rather than duplicating it: creating
 * the owner auth user with `signup` metadata fires handle_new_tenant_signup()
 * (migration 20260728000001), which provisions the tenant (forced `free`) +
 * owner staff + cafe_settings + default categories in the same transaction.
 * We then bump the plan if the operator picked a paid tier. Email is
 * pre-confirmed so the owner can log in immediately (no SMTP dependency).
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('staff', ip);
    if (!success) return jsonRateLimited(resetAt);

    const admin = await verifyPlatformAdmin(request);
    if (admin instanceof NextResponse) return admin;

    const { data, error } = await validateBody(request, CreateTenantSchema);
    if (error) return error;

    const supabase = getSupabaseAdmin();

    // 1. Create the owner. `signup` metadata triggers provisioning; passing
    //    restaurant_name/full_name names the cafe upfront (self-serve omits them
    //    and falls back to "My Restaurant").
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: data.owner_email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        signup: 'platform',
        restaurant_name: data.cafe_name,
        full_name: data.owner_name || 'Owner',
      },
    });

    if (createErr || !created?.user) {
      const msg = createErr?.message ?? 'unknown';
      // Duplicate email is the expected user-facing case → 409 sentinel.
      if (/already|exist|registered/i.test(msg)) {
        return NextResponse.json({ error: 'email_in_use' }, { status: 409 });
      }
      throw new Error(`platform create-tenant: createUser failed (${msg})`);
    }
    const authUserId = created.user.id;

    // 2. The AFTER INSERT trigger committed with the user insert, so the owner
    //    staff row (→ tenant_id) exists now. If it doesn't, provisioning didn't
    //    run — delete the orphan auth user so no dangling login is left behind.
    const { data: staffRow, error: staffErr } = await supabase
      .from('staff')
      .select('tenant_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (staffErr || !staffRow?.tenant_id) {
      await supabase.auth.admin.deleteUser(authUserId).catch(() => {});
      throw new Error('platform create-tenant: provisioning did not create a tenant');
    }
    const tenantId = staffRow.tenant_id;

    // 3. The trigger always provisions `free`; apply the chosen paid plan.
    if (data.plan !== 'free') {
      const { error: planErr } = await supabase
        .from('tenants')
        .update({ plan: data.plan })
        .eq('id', tenantId);
      if (planErr) {
        throw new Error(`platform create-tenant: set-plan failed (${planErr.message})`);
      }
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name, plan, is_active')
      .eq('id', tenantId)
      .single();

    return jsonOk({ tenant, owner_email: data.owner_email }, 201);
  } catch (err) {
    return handleRouteError(err, request);
  }
}
