import { AuthorizationError, NotFoundError, PLAN_LIMITS, type PlanName } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Plan gate shared by every `/api/v1/customer/*` service that writes
 * on behalf of a customer-web user.
 *
 * QR ordering is gated by `PLAN_LIMITS[plan].qrOrdering`; every service
 * that writes a customer-facing row (orders, waiter calls, feedback,
 * delivery) runs the same check so the policy lives in one place.
 *
 * NOTE (#227): the free tier is now a real trial with `qrOrdering: true`,
 * so every current plan passes this gate — the reject path is latent,
 * kept so a future gated tier (or re-disabling free) is enforced without
 * touching each caller.
 *
 * Pre-this-helper, the check was duplicated three times:
 *   - customer-order-service:    inline tenant fetch + PLAN_LIMITS check
 *   - customer-qr-token-service: inline tenant fetch + PLAN_LIMITS check
 *   - customer-engagement-service: local `assertPlanAllowsCustomerEngagement`
 *
 * Drift between them was inevitable. This helper is the single source.
 *
 * Throws `AuthorizationError('plan_required')` so
 * [`handle-route-error.ts`](../api/handle-route-error.ts) maps it via
 * the `isAppError` branch (HTTP 403 + `{ error: "plan_required" }`).
 * The customer-web `localizeErrorMessage` then renders the
 * `plan_required` key from the active locale.
 *
 * Tenant ID must come from the route's server-side `resolveTenantId`
 * step (table row / qr_token row), not from the request body — the
 * C1 fix already covers that on the callers' side.
 *
 * Returns the resolved plan so callers can short-circuit additional
 * plan-tier branches without re-fetching.
 */
export async function assertCustomerPlanAllowsWrites(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
): Promise<PlanName> {
  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .select('plan')
    .eq('id', tenantId)
    .single();

  if (error || !tenant) {
    // Reachable only when tenantId points at a row that doesn't exist
    // — a server-internal inconsistency, not a client mistake.
    throw new NotFoundError('Tenant');
  }

  const plan = ((tenant as { plan?: string }).plan ?? 'free') as PlanName;

  if (!PLAN_LIMITS[plan].qrOrdering) {
    throw new AuthorizationError('plan_required');
  }

  return plan;
}
