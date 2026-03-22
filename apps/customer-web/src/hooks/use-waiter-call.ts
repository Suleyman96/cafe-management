import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/query-keys';
import { db } from '@/lib/supabase';
import type { WaiterCall } from '@/types';

type CallType = 'assistance' | 'bill' | 'question' | 'complaint' | 'emergency';
type CallPriority = 'low' | 'normal' | 'high' | 'urgent';

export function useWaiterCalls(tableId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.WAITER_CALLS, tableId],
    queryFn: async () => {
      const data = await db.waiterCalls.findByTable(tableId, 'pending');
      return data as WaiterCall[];
    },
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
    mutationFn: async ({ tableId, callType, reason, priority, notes }: CreateWaiterCallData) => {
      const data = await db.waiterCalls.create({
        table_id: tableId,
        call_type: callType,
        reason: notes || reason,
        priority: priority,
      });
      return data as WaiterCall;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.WAITER_CALLS, variables.tableId],
      });
    },
  });
}

// Keep for backwards compatibility
export const useCallWaiter = useCreateWaiterCall;
