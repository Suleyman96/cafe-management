/**
 * Type-Safe Waiter Calls Hooks
 * Uses the wrapped client for type safety without 'as any'
 */

import { QUERY_KEYS } from '@gustri/core';
import type { Database } from '@gustri/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateWaiterCalls } from '@/lib/query-helpers';
import { db } from '@/lib/supabase/wrapped-client';

type WaiterCall = Database['public']['Tables']['waiter_calls']['Row'];
type WaiterCallStatus = WaiterCall['status'];

export function useWaiterCalls(status?: WaiterCallStatus) {
  return useQuery({
    queryKey: [QUERY_KEYS.WAITER_CALLS, status],
    queryFn: async (): Promise<WaiterCall[]> => db.waiterCalls.findAll(status),
    // Polling removed: useRealtimeSync on the calls page handles freshness.
  });
}

export function usePendingWaiterCallsCount() {
  return useQuery({
    queryKey: [QUERY_KEYS.WAITER_CALLS_COUNT, 'pending'],
    queryFn: async (): Promise<number> => db.waiterCalls.getPendingCount(),
    // Polling removed: useRealtimeSync on the calls page handles freshness.
  });
}

export function useAcknowledgeWaiterCall() {
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ callId, notes }: { callId: string; notes?: string }) =>
      db.waiterCalls.resolve(callId, notes),
    onSuccess: () => {
      invalidateWaiterCalls(queryClient);
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
    },
  });
}

// Helper to get active calls for a specific table
export function useActiveCallsForTable(tableId: string) {
  const { data: allCalls, ...rest } = useWaiterCalls('pending');

  const tableCalls = allCalls?.filter((call) => call.table_id === tableId) || [];

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
