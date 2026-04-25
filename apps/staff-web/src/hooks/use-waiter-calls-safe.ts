/**
 * Type-Safe Waiter Calls Hooks
 * Re-exports from @gustri/queries, with local composite hooks and helpers
 */

import {
  invalidateWaiterCalls,
  useDb,
  useWaiterCalls as useWaiterCallsShared,
} from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Re-export shared read hooks
export { usePendingWaiterCallsCount, useWaiterCalls } from '@gustri/queries';

// Local mutations — staff-web consumers use { callId } param shape
export function useAcknowledgeWaiterCall() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ callId, staffId }: { callId: string; staffId: string }) =>
      db.waiterCalls.acknowledge(callId, staffId),
    onSuccess: () => {
      invalidateWaiterCalls(queryClient);
    },
  });
}

export function useResolveWaiterCall() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ callId, notes }: { callId: string; notes?: string }) =>
      db.waiterCalls.resolve(callId, notes),
    onSuccess: () => {
      invalidateWaiterCalls(queryClient);
    },
  });
}

// Composite hook: filters active calls for a specific table (app-specific)
export function useActiveCallsForTable(tableId: string) {
  const { data: allCalls, ...rest } = useWaiterCallsShared('pending');

  const tableCalls = allCalls?.filter((call) => call.table_id === tableId) || [];

  return {
    ...rest,
    data: tableCalls,
  };
}
