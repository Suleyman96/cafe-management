import type { TenantPublicProfile } from '@gustri/api-client';
import type { PlanName } from '@gustri/core';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';
import { STALE_TIMES } from '../stale-times';

/**
 * The slice of the tenants row that the wrapper exposes to clients.
 * Narrowed in `@gustri/api-client` to enumerate columns explicitly so
 * adding a sensitive column to the table doesn't silently leak it
 * into the React Query cache.
 */
export type Tenant = TenantPublicProfile;

/**
 * Current tenant row (narrowed projection), keyed by tenant id.
 * Refetched on focus so plan upgrades / downgrades propagate without
 * requiring re-login.
 */
export function useTenant() {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.TENANT),
    queryFn: () => db.tenants.getCurrent(),
    enabled: !!tenantId,
    staleTime: STALE_TIMES.MEDIUM,
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
