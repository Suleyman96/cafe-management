import type { PlanName } from '@gustri/core';
import type { Database } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';

export type Tenant = Database['public']['Tables']['tenants']['Row'];

/**
 * Current tenant row, keyed by tenant id. Refetched on focus so plan
 * upgrades / downgrades propagate without requiring re-login.
 */
export function useTenant() {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.TENANT),
    queryFn: () => db.tenants.getCurrent(),
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
  });
}

/**
 * Current tenant plan. Returns `{ plan: null, isLoading: true }` while
 * the tenant query is pending — consumers MUST treat that as "unknown"
 * (hide gated UI / skip soft pre-checks) rather than coerce to `'free'`,
 * which would lock paying tenants out during the load window.
 *
 * Authorization is enforced server-side (RLS + `verifyPlan`). This hook
 * only decides whether the UI surfaces a gated affordance.
 */
export function useTenantPlan(): { plan: PlanName | null; isLoading: boolean } {
  const { data, isLoading } = useTenant();
  return { plan: (data?.plan as PlanName) ?? null, isLoading };
}
