import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { jsonOk } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { verifyPlatformAdmin } from '@/lib/api/verify-platform-admin';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

// This is the manual-billing action: bump a tenant to a paid plan (or back down)
// once payment is confirmed. Plan enforcement (RLS + plan_limits) follows the
// column automatically.
const SetPlanSchema = z.object({
  plan: z.enum(['free', 'standard', 'pro', 'business']),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await verifyPlatformAdmin(request);
    if (admin instanceof NextResponse) return admin;

    const { id: tenantId } = await params;
    // Validate the path param before it reaches Postgres — a non-UUID would
    // otherwise surface as a generic 500 (invalid input syntax for uuid).
    if (!z.string().uuid().safeParse(tenantId).success) {
      return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
    }

    const { data, error } = await validateBody(request, SetPlanSchema);
    if (error) return error;

    const { data: updated, error: updateErr } = await getSupabaseAdmin()
      .from('tenants')
      .update({ plan: data.plan })
      .eq('id', tenantId)
      .select('id, name, plan')
      .maybeSingle();

    if (updateErr) {
      throw new Error(`platform set-plan: update failed (${updateErr.message})`);
    }
    // No row → the tenant id doesn't exist. 404, not a 500.
    if (!updated) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return jsonOk({ tenant: updated });
  } catch (err) {
    return handleRouteError(err, request);
  }
}
