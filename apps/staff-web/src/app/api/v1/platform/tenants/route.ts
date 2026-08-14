import { type NextRequest, NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/api/handle-route-error';
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
