/**
 * Type-Safe Refund Hooks
 */

import { getOrCreateClientRequestId, QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';
import { db } from '@/lib/supabase/wrapped-client';

export function useOrderRefunds(orderId: string) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.PAYMENTS, 'refunds', orderId),
    queryFn: () => db.refunds.findByOrderId(orderId),
    enabled: !!orderId,
  });
}

type CreateRefundInput = {
  order_id: string;
  processed_by: string;
  amount: number;
  reason: string;
  refund_method: 'cash' | 'card' | 'digital';
  order_item_ids?: string[] | null;
  notes?: string | null;
  client_request_id?: string;
};

export function useCreateRefund() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    // `retry: 0` — refunds must not auto-retry on a network blip; the
    // server dedupes a user-driven retry via the (tenant_id,
    // client_request_id) partial unique index.
    retry: 0,
    onMutate: (params: CreateRefundInput) => {
      params.client_request_id = getOrCreateClientRequestId(params.client_request_id);
    },
    mutationFn: (params: CreateRefundInput) =>
      apiRoutes.refunds.create(params.order_id, {
        amount: params.amount,
        reason: params.reason,
        refund_method: params.refund_method,
        processed_by: params.processed_by,
        order_item_ids: params.order_item_ids,
        notes: params.notes,
        client_request_id: params.client_request_id as string,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDERS) });
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.ORDER, variables.order_id),
      });
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.PAYMENTS, variables.order_id),
      });
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.PAYMENTS, 'refunds', variables.order_id),
      });
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.PAYMENTS, 'remaining_balance', variables.order_id),
      });
    },
  });
}
