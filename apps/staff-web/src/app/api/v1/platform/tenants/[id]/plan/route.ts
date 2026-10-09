import { computePeriodEnd } from '@gustri/core';
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
// `plan` column automatically.
//
// Billing cadence (monthly/yearly) is orthogonal to the tier — it only drives
// the renewal date, not capabilities. Optional:
//   - a paid plan + `billing_cycle` with no explicit `current_period_end`
//     computes the paid-through date as now + 1 month (monthly) / 12 months
//     (yearly);
//   - an explicit `current_period_end` (ISO) overrides the computed date (e.g.
//     backdating an existing subscription);
//   - `plan: 'free'` clears both billing_cycle and current_period_end.
const SetPlanSchema = z.object({
  plan: z.enum(['free', 'standard', 'pro', 'business']),
  billing_cycle: z.enum(['monthly', 'yearly']).optional(),
  current_period_end: z.string().datetime().optional(),
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

    // Build the billing-cadence patch alongside the plan change.
    //  - free: clear cadence + paid-through date (no subscription).
    //  - paid + explicit date: use it as-is (e.g. migrating an existing sub).
    //  - paid + cycle (no date): compute now + 1 month / 12 months.
    //  - paid, neither: leave cadence/date untouched (a pure tier change).
    const patch: {
      plan: typeof data.plan;
      billing_cycle?: 'monthly' | 'yearly' | null;
      current_period_end?: string | null;
    } = { plan: data.plan };

    if (data.plan === 'free') {
      patch.billing_cycle = null;
      patch.current_period_end = null;
    } else if (data.billing_cycle) {
      patch.billing_cycle = data.billing_cycle;
      patch.current_period_end =
        data.current_period_end ?? computePeriodEnd(data.billing_cycle).toISOString();
    } else if (data.current_period_end) {
      patch.current_period_end = data.current_period_end;
    }

    const { data: updated, error: updateErr } = await getSupabaseAdmin()
      .from('tenants')
      .update(patch)
      .eq('id', tenantId)
      .select('id, name, plan, billing_cycle, current_period_end')
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
