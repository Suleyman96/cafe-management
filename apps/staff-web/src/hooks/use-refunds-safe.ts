/**
 * Type-Safe Refund Hooks
 */

import { QUERY_KEYS } from '@gustri/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';
import { db } from '@/lib/supabase/wrapped-client';

export function useOrderRefunds(orderId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.PAYMENTS, 'refunds', orderId],
    queryFn: () => db.refunds.findByOrderId(orderId),
    enabled: !!orderId,
  });
}

export function useCreateRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      order_id: string;
      processed_by: string;
      amount: number;
      reason: string;
      refund_method: 'cash' | 'card' | 'digital';
      order_item_ids?: string[] | null;
      notes?: string | null;
    }) =>
      apiRoutes.refunds.create(params.order_id, {
        amount: params.amount,
        reason: params.reason,
        refund_method: params.refund_method,
        processed_by: params.processed_by,
        order_item_ids: params.order_item_ids,
        notes: params.notes,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, variables.order_id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYMENTS, variables.order_id] });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.PAYMENTS, 'refunds', variables.order_id],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.PAYMENTS, 'remaining_balance', variables.order_id],
      });
    },
  });
}
