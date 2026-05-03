import type { PlanName } from '@gustri/core';
import { PLAN_LIMITS } from '@gustri/core';
import { QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';
import { useAuthStore } from '@/store/auth-store';

export function useTenantPlan(): PlanName {
  return useAuthStore((s) => s.tenantPlan) ?? 'free';
}

export function usePlanLimits() {
  const plan = useTenantPlan();
  return PLAN_LIMITS[plan];
}

export function useMonthlyOrderCount() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.MONTHLY_ORDER_COUNT),
    queryFn: () => db.tenants.getMonthlyOrderCount(),
    staleTime: 60_000,
  });
}
