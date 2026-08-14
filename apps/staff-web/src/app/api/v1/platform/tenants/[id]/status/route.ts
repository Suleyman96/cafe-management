import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { jsonOk } from '@/lib/api/response';
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

    const { id: tenantId } = await params;
    const { data, error } = await validateBody(request, SetStatusSchema);
    if (error) return error;

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

    const { data: updated, error: updateErr } = await getSupabaseAdmin()
      .from('tenants')
      .update(patch)
      .eq('id', tenantId)
      .select('id, name, is_active')
      .single();

    if (updateErr || !updated) {
      throw new Error(`platform set-status: update failed (${updateErr?.message ?? 'no row'})`);
    }

    return jsonOk({ tenant: updated });
  } catch (err) {
    return handleRouteError(err, request);
  }
}
