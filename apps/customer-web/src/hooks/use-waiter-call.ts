import { QUERY_KEYS } from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import type { WaiterCall } from '@/types';

type CallType = 'assistance' | 'bill' | 'question' | 'complaint' | 'emergency';
type CallPriority = 'low' | 'normal' | 'high' | 'urgent';

interface CreateWaiterCallData {
  tableId: string;
  callType: CallType;
  reason: string;
  priority: CallPriority;
  notes?: string;
  tenantId: string;
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
      tenantId,
    }: CreateWaiterCallData): Promise<WaiterCall> =>
      db.waiterCalls.create({
        table_id: tableId,
        tenant_id: tenantId,
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
