import { PLAN_LIMITS, type PlanName } from '@gustri/core';
import {
  QUERY_KEYS,
  STALE_TIMES,
  tenantKey,
  useTenant,
  useTenantId,
  useTenantPlan,
} from '@gustri/queries';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';

// Re-export the shared hooks so existing app imports keep working.
// New consumers should import directly from `@gustri/queries`.
export { useTenant, useTenantPlan };

/**
 * Plan limits for the current tenant, or `null` while the plan is
 * unknown. Returning `null` rather than free-tier limits prevents
 * client-side soft pre-checks (e.g. cap gates) from firing against a
 * fictitious "free" plan during load.
 */
export function usePlanLimits(): (typeof PLAN_LIMITS)[PlanName] | null {
  const { plan } = useTenantPlan();
  return plan ? PLAN_LIMITS[plan] : null;
}

export function useMonthlyOrderCount() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.MONTHLY_ORDER_COUNT),
    queryFn: () => db.tenants.getMonthlyOrderCount(),
    staleTime: STALE_TIMES.SHORT,
  });
}
