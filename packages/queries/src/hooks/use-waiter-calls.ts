import type { WaiterCall } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';

export function useWaiterCalls(status?: WaiterCall['status'], options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.WAITER_CALLS, status],
    queryFn: () => db.waiterCalls.findAll(status ? { status } : undefined) as Promise<WaiterCall[]>,
    enabled: options?.enabled ?? true,
  });
}

export function usePendingWaiterCallsCount(options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.WAITER_CALLS_COUNT],
    queryFn: () => db.waiterCalls.getPendingCount() as Promise<number>,
    enabled: options?.enabled ?? true,
  });
}
