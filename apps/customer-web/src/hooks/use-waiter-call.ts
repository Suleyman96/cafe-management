import { QUERY_KEYS } from '@gustri/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import type { WaiterCall } from '@/types';

type CallType = 'assistance' | 'bill' | 'question' | 'complaint' | 'emergency';
type CallPriority = 'low' | 'normal' | 'high' | 'urgent';

export function useWaiterCalls(tableId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.WAITER_CALLS, tableId],
    queryFn: async (): Promise<WaiterCall[]> => db.waiterCalls.findByTable(tableId, 'pending'),
  });
}

interface CreateWaiterCallData {
  tableId: string;
  callType: CallType;
  reason: string;
  priority: CallPriority;
  notes?: string;
}

export function useCreateWaiterCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tableId,
      callType,
      reason,
      priority,
      notes,
    }: CreateWaiterCallData): Promise<WaiterCall> =>
      db.waiterCalls.create({
        table_id: tableId,
        call_type: callType,
        reason: reason,
        priority: priority,
        ...(notes ? { notes } : {}),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.WAITER_CALLS, variables.tableId],
      });
    },
  });
}

// Keep for backwards compatibility
export const useCallWaiter = useCreateWaiterCall;
