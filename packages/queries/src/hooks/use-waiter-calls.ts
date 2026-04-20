import { QUERY_KEYS } from '@gustri/core';
import type { WaiterCall } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { useDb } from '../provider';

export function useWaiterCalls(status?: WaiterCall['status']) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.WAITER_CALLS, status],
    queryFn: () => db.waiterCalls.findAll(status) as Promise<WaiterCall[]>,
  });
}

export function usePendingWaiterCallsCount() {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.WAITER_CALLS_COUNT],
    queryFn: () => db.waiterCalls.getPendingCount() as Promise<number>,
  });
}
