import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';

// The RPCs derive tenant from the session via current_tenant_id(); the
// `tenantId` param here doubles as an "auth ready" gate AND as the cache
// scope so two tenants never collide on the same date range.
export function useRevenueSummary(tenantId: string | undefined, from: string, to: string) {
  const db = useDb();
  const ctxTenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(ctxTenantId, QUERY_KEYS.REPORTS, 'revenue', from, to),
    queryFn: () => db.reports.getRevenueSummary(from, to),
    enabled: !!tenantId && !!from && !!to,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTopSoldItems(
  tenantId: string | undefined,
  from: string,
  to: string,
  limit?: number,
) {
  const db = useDb();
  const ctxTenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(ctxTenantId, QUERY_KEYS.REPORTS, 'top-items', from, to, limit),
    queryFn: () => db.reports.getTopSoldItems(from, to, limit),
    enabled: !!tenantId && !!from && !!to,
    staleTime: 5 * 60 * 1000,
  });
}

export function useExpenseSummary(tenantId: string | undefined, from: string, to: string) {
  const db = useDb();
  const ctxTenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(ctxTenantId, QUERY_KEYS.REPORTS, 'expenses', from, to),
    queryFn: () => db.reports.getExpenseSummary(from, to),
    enabled: !!tenantId && !!from && !!to,
    staleTime: 5 * 60 * 1000,
  });
}

export function useWasteSummary(tenantId: string | undefined, from: string, to: string) {
  const db = useDb();
  const ctxTenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(ctxTenantId, QUERY_KEYS.REPORTS, 'waste', from, to),
    queryFn: () => db.reports.getWasteSummary(from, to),
    enabled: !!tenantId && !!from && !!to,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStaffPerformance(tenantId: string | undefined, from: string, to: string) {
  const db = useDb();
  const ctxTenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(ctxTenantId, QUERY_KEYS.REPORTS, 'staff-performance', from, to),
    queryFn: () => db.reports.getStaffPerformance(from, to),
    enabled: !!tenantId && !!from && !!to,
    staleTime: 5 * 60 * 1000,
  });
}
