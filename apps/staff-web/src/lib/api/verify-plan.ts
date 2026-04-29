import { PLAN_ORDER, type PlanName } from '@gustri/core';
import type { NextRequest } from 'next/server';
import { jsonError } from './response';
import { getSupabaseAdmin } from './verify-admin';
import { verifyStaff } from './verify-staff';

/**
 * Server-side plan enforcement.
 *
 * The mobile app (and the web sidebar) hide plan-gated UI based on a
 * client-resident `tenantPlan`. Nothing on the server checks plan, so a
 * modified client (Hermes-decompiled, MITM'd `/tenants` response, or
 * Zustand state mutated in dev tools) can spoof `tenantPlan = 'pro'` and
 * call any plan-gated endpoint — pro features become free.
 *
 * `verifyPlan(allowed)` resolves the tenant from the JWT (never from the
 * request body) via `verifyStaff`, looks up `tenants.plan` server-side,
 * and rejects with HTTP 403 when the plan isn't in `allowed`.
 *
 * The lookup is cached in-process for `PLAN_TTL_MS` so a burst of
 * mutations from one tenant doesn't translate to one DB roundtrip per
 * call. The cache is small enough to live in a `Map` — Next.js server
 * runtime keeps the module alive across requests, and stale entries
 * resolve naturally because plan upgrades are rare and the worst case
 * (denying a freshly upgraded tenant for ~30s) is acceptable.
 */

const PLAN_TTL_MS = 30_000;

interface CachedPlan {
  plan: PlanName;
  expiresAt: number;
}

const planCache = new Map<string, CachedPlan>();

async function loadPlan(tenantId: string): Promise<PlanName> {
  const cached = planCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.plan;
  }

  const { data, error } = await getSupabaseAdmin()
    .from('tenants')
    .select('plan')
    .eq('id', tenantId)
    .single();

  if (error || !data) {
    throw new Error('Tenant not found');
  }

  const plan = (data.plan ?? 'free') as PlanName;
  planCache.set(tenantId, { plan, expiresAt: Date.now() + PLAN_TTL_MS });
  return plan;
}

export interface VerifiedPlanContext {
  staff: { id: string; role: string; tenant_id: string };
  plan: PlanName;
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
 * Test/operations helper — drop the in-process cache. Server hot-reloads
 * pick up plan upgrades naturally, but tests need a deterministic reset.
 */
export function __resetPlanCacheForTests(): void {
  planCache.clear();
}

/**
 * Programmatic helper for non-route call sites (services, scripts) that
 * already have a tenant_id and need to gate work behind a plan check
 * without invoking the request-bound `verifyPlan`. Throws when denied so
 * the caller doesn't have to branch on a Response.
 */
export async function requirePlanAtLeast(tenantId: string, minimum: PlanName): Promise<PlanName> {
  const plan = await loadPlan(tenantId);
  if (PLAN_ORDER[plan] < PLAN_ORDER[minimum]) {
    const err = new Error('plan_required') as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  return plan;
}
