import { PLAN_LIMITS, QUERY_KEYS } from '@gustri/core';
import type { PlanName } from '@gustri/core';
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
  return useQuery({
    queryKey: [QUERY_KEYS.MONTHLY_ORDER_COUNT],
    queryFn: () => db.tenants.getMonthlyOrderCount(),
    staleTime: 60_000,
  });
}
