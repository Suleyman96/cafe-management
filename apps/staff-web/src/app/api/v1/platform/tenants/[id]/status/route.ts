import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { logPlatformAudit } from '@/lib/api/platform-audit';
import { rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { verifyPlatformAdmin } from '@/lib/api/verify-platform-admin';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

// Activate / suspend a tenant. Reuses the soft-close `is_active` gate — a
// suspended tenant's current_tenant_id() collapses to NULL, so they lose all
// app access (staff and customer) immediately.
const SetStatusSchema = z.object({
  active: z.boolean(),
  reason: z.string().max(500).optional().nullable(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await verifyPlatformAdmin(request);
    if (admin instanceof NextResponse) return admin;

    // M9: throttle operator mutations keyed by the admin id (not IP).
    const { success, resetAt } = await rateLimit('platform', admin.id);
    if (!success) return jsonRateLimited(resetAt);

    const { id: tenantId } = await params;
    // Validate the path param before it reaches Postgres — a non-UUID would
    // otherwise surface as a generic 500 (invalid input syntax for uuid).
    if (!z.string().uuid().safeParse(tenantId).success) {
      return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
    }

    const { data, error } = await validateBody(request, SetStatusSchema);
    if (error) return error;

    const supabase = getSupabaseAdmin();

    // L12: capture the pre-change active state for the operator audit trail.
    const { data: before } = await supabase
      .from('tenants')
      .select('is_active')
      .eq('id', tenantId)
      .maybeSingle();

    // `deactivated_by` FKs to staff(id); a platform admin isn't a tenant staff
    // member, so leave it null and record the actor in the reason instead.
    const patch = data.active
      ? { is_active: true, deactivated_at: null, deactivated_by: null, deactivation_reason: null }
      : {
          is_active: false,
          deactivated_at: new Date().toISOString(),
          deactivated_by: null,
          deactivation_reason: `platform:${admin.email}${data.reason ? ` — ${data.reason}` : ''}`,
        };

    const { data: updated, error: updateErr } = await supabase
      .from('tenants')
      .update(patch)
      .eq('id', tenantId)
      .select('id, name, is_active')
      .maybeSingle();

    if (updateErr) {
      throw new Error(`platform set-status: update failed (${updateErr.message})`);
    }
    // No row → the tenant id doesn't exist. 404, not a 500.
    if (!updated) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // L12: audit the operator action (actor, tenant, old→new active state).
    await logPlatformAudit(supabase, {
      actorId: admin.id,
      actorEmail: admin.email,
      tenantId,
      action: 'status_change',
      oldValue: before ?? null,
      newValue: { is_active: updated.is_active },
      reason: data.reason ?? null,
    });

    return jsonOk({ tenant: updated });
  } catch (err) {
    return handleRouteError(err, request);
  }
}
