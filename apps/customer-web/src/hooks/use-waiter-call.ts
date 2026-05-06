import { getOrCreateClientRequestId, QUERY_KEYS } from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';
import type { WaiterCall } from '@/types';

type CallType = 'assistance' | 'bill' | 'question' | 'complaint' | 'emergency';
type CallPriority = 'low' | 'normal' | 'high' | 'urgent';

interface CreateWaiterCallData {
  tableId: string;
  callType: CallType;
  reason: string;
  priority: CallPriority;
  notes?: string;
  // Stamped by `onMutate` so React Query retries reuse it; the server
  // dedupes on the `(tenant_id, client_request_id)` partial unique
  // index from migration 20260428000002. The `tenantId` field that
  // used to live here was redundant — the route resolves it from
  // `table_id` server-side now.
  client_request_id?: string;
}

export function useCreateWaiterCall() {
  const queryClient = useQueryClient();

  return useMutation({
    // `retry: 0` keeps a network blip from posting two pending calls.
    // The server still dedupes via `client_request_id` if a user-driven
    // retry happens.
    retry: 0,
    onMutate: (vars: CreateWaiterCallData) => {
      vars.client_request_id = getOrCreateClientRequestId(vars.client_request_id);
    },
    mutationFn: async ({
      tableId,
      callType,
      reason,
      priority,
      notes,
      client_request_id,
    }: CreateWaiterCallData): Promise<WaiterCall> => {
      const { waiter_call } = await apiRoutes.customerWaiterCalls.create({
        table_id: tableId,
        call_type: callType,
        reason: reason,
        priority: priority,
        notes: notes ?? null,
        client_request_id: getOrCreateClientRequestId(client_request_id),
      });
      return waiter_call as WaiterCall;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.WAITER_CALLS, variables.tableId],
      });
    },
  });
}
