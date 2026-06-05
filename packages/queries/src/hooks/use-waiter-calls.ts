import type { WaiterCall } from '@gustri/database/types';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';

export function useWaiterCalls(status?: WaiterCall['status'], options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.WAITER_CALLS, status),
    queryFn: () => db.waiterCalls.findAll(status ? { status } : undefined) as Promise<WaiterCall[]>,
    enabled: options?.enabled ?? true,
  });
}

export function usePendingWaiterCallsCount(options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.WAITER_CALLS_COUNT),
    queryFn: () => db.waiterCalls.getPendingCount() as Promise<number>,
    enabled: options?.enabled ?? true,
  });
}
