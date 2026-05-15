import { AuthorizationError, NotFoundError, PLAN_ORDER, type PlanName } from '@gustri/core';
import type { NextRequest } from 'next/server';
import { jsonError } from './response';
import { getSupabaseAdmin } from './verify-admin';
import { verifyStaff } from './verify-staff';

/**
 * Server-side plan enforcement.
 *
 * The mobile app (and the web sidebar) hide plan-gated UI based on the
 * `useTenantPlan` TanStack Query result. Nothing on the server trusts
 * that — a modified client (Hermes-decompiled, MITM'd `/tenants`
 * response, query cache mutated in dev tools) can spoof the value.
 *
 * `verifyPlan(allowed)` resolves the tenant from the JWT (never from
 * the request body) via `verifyStaff`, looks up `tenants.plan`
 * server-side every time, and rejects with HTTP 403 when the plan
 * isn't in `allowed`.
 *
 * Why no in-process cache: this used to keep a 30s Map per Next.js
 * instance. That created two real problems:
 *   1. Per-instance drift. Serverless = N processes per region, each
 *      with its own cache. After an admin upgrade or downgrade, two
 *      back-to-back requests can land on different instances and get
 *      contradictory plan answers for ~30s.
 *   2. Downgrade-still-allowed window. A tenant demoted from pro→free
 *      could still hit plan-gated routes for 30s.
 *
 * Plan-gated routes are few (`/api/v1/stock/[id]/adjust`, settings
 * branding fields) and plan changes are admin-initiated and rare —
 * the call rate doesn't justify caching. One indexed `tenants.plan`
 * fetch is <5ms in-region, comparable to an Upstash hit, and adding
 * Upstash here would still leave a stale window. Drop the cache,
 * read fresh.
 */

export interface VerifiedPlanContext {
  staff: { id: string; role: string; tenant_id: string };
  plan: PlanName;
}

async function loadPlan(tenantId: string): Promise<PlanName> {
  const { data, error } = await getSupabaseAdmin()
    .from('tenants')
    .select('plan')
    .eq('id', tenantId)
    .single();

  if (error || !data) {
    throw new NotFoundError('Tenant');
  }

  return (data.plan ?? 'free') as PlanName;
}

/**
 * Verify the JWT belongs to active staff AND the resolved plan is in
 * `allowed`. Returns either:
 *  - a `Response` to short-circuit the route (auth failure or plan denial)
 *  - a `VerifiedPlanContext` for the route to proceed with
 *
 * Usage:
 * ```ts
 * const ctx = await verifyPlan(request, ['pro', 'business']);
 * if (ctx instanceof Response) return ctx;
 * // ctx.staff and ctx.plan are now safe to use
 * ```
 */
export async function verifyPlan(
  request: NextRequest,
  allowed: PlanName[],
): Promise<VerifiedPlanContext | Response> {
  const staffOrError = await verifyStaff(request);
  if (staffOrError instanceof Response) return staffOrError;

  let plan: PlanName;
  try {
    plan = await loadPlan(staffOrError.tenant_id);
  } catch {
    // Treat lookup failure as 'free' to fail closed — a transient DB error
    // shouldn't grant pro-tier access. Tests + monitoring catch the
    // underlying failure separately.
    plan = 'free';
  }

  if (!allowed.includes(plan)) {
    return jsonError('plan_required', 403);
  }

  return { staff: staffOrError, plan };
}

/**
 * Programmatic helper for non-route call sites (services, scripts) that
 * already have a tenant_id and need to gate work behind a plan check
 * without invoking the request-bound `verifyPlan`. Throws when denied so
 * the caller doesn't have to branch on a Response.
 *
 * Errors are typed `AppError` subclasses (`AuthorizationError` for
 * plan-denied, `NotFoundError` for tenant lookup miss) so routes that
 * wrap their handler with `handleRouteError` get correct status codes
 * and the `plan_required` sentinel automatically. Callers don't need
 * to convert the error themselves.
 */
export async function requirePlanAtLeast(tenantId: string, minimum: PlanName): Promise<PlanName> {
  const plan = await loadPlan(tenantId);
  if (PLAN_ORDER[plan] < PLAN_ORDER[minimum]) {
    throw new AuthorizationError('plan_required');
  }
  return plan;
}
