import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';

export function useRevenueSummary(tenantId: string | undefined, from: string, to: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.REPORTS, 'revenue', from, to],
    queryFn: () => db.reports.getRevenueSummary(tenantId!, from, to),
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
  return useQuery({
    queryKey: [QUERY_KEYS.REPORTS, 'top-items', from, to, limit],
    queryFn: () => db.reports.getTopSoldItems(tenantId!, from, to, limit),
    enabled: !!tenantId && !!from && !!to,
    staleTime: 5 * 60 * 1000,
  });
}

export function useExpenseSummary(tenantId: string | undefined, from: string, to: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.REPORTS, 'expenses', from, to],
    queryFn: () => db.reports.getExpenseSummary(tenantId!, from, to),
    enabled: !!tenantId && !!from && !!to,
    staleTime: 5 * 60 * 1000,
  });
}

export function useWasteSummary(tenantId: string | undefined, from: string, to: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.REPORTS, 'waste', from, to],
    queryFn: () => db.reports.getWasteSummary(tenantId!, from, to),
    enabled: !!tenantId && !!from && !!to,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStaffPerformance(tenantId: string | undefined, from: string, to: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.REPORTS, 'staff-performance', from, to],
    queryFn: () => db.reports.getStaffPerformance(tenantId!, from, to),
    enabled: !!tenantId && !!from && !!to,
    staleTime: 5 * 60 * 1000,
  });
}
