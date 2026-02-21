import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { WaiterCall } from '@/types';

type CallType = 'assistance' | 'bill' | 'question' | 'complaint' | 'emergency';
type CallPriority = 'low' | 'normal' | 'high' | 'urgent';

export function useWaiterCalls(tableId: string) {
  return useQuery({
    queryKey: ['waiter_calls', tableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waiter_calls')
        .select('*')
        .eq('table_id', tableId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
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
      // Use type assertion to work around Supabase client type inference issue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('waiter_calls')
        .insert({
          table_id: tableId,
          call_type: callType,
          reason: notes || reason,
          priority: priority,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data as WaiterCall;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['waiter_calls', variables.tableId],
      });
    },
  });
}

// Keep for backwards compatibility
export const useCallWaiter = useCreateWaiterCall;
