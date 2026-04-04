/**
 * Type-Safe Discount Hooks
 */

import { QUERY_KEYS } from '@gustri/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';

export function useApplyDiscount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      orderId: string;
      discount_type: 'none' | 'percentage' | 'fixed';
      discount_value: number;
      discount_reason?: string | null;
      discount_applied_by: string;
    }) =>
      db.orders.applyDiscount(params.orderId, {
        discount_type: params.discount_type,
        discount_value: params.discount_value,
        discount_reason: params.discount_reason,
        discount_applied_by: params.discount_applied_by,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, variables.orderId] });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.PAYMENTS, 'remaining_balance', variables.orderId],
      });
    },
  });
}
