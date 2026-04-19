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

  const tableCalls = allCalls?.filter((call: any) => call.table_id === tableId) || [];

  return {
    ...rest,
    data: tableCalls,
  };
}

// Helper function to get call type info
export function getCallTypeInfo(type: string): { icon: string; label: string; color: string } {
  const types: Record<string, { icon: string; label: string; color: string }> = {
    assistance: { icon: '💬', label: 'General Help', color: 'blue' },
    bill: { icon: '🧾', label: 'Request Bill', color: 'green' },
    complaint: { icon: '⚠️', label: 'Complaint', color: 'red' },
    question: { icon: '❓', label: 'Question', color: 'yellow' },
    emergency: { icon: '🚨', label: 'Emergency', color: 'red' },
  };

  return types[type] || { icon: '📢', label: 'Call', color: 'gray' };
}

// Helper function to get priority info
export function getPriorityInfo(priority: string): { label: string; color: string } {
  const priorities: Record<string, { label: string; color: string }> = {
    low: { label: 'Low', color: 'gray' },
    normal: { label: 'Normal', color: 'blue' },
    high: { label: 'High', color: 'orange' },
    urgent: { label: 'Urgent', color: 'red' },
  };

  return priorities[priority] || { label: 'Unknown', color: 'gray' };
}
