export { useAddOrderItems } from '@gustri/queries';

// useCreateOrder is not available in @gustri/queries — keep local implementation
import { QUERY_KEYS } from '@gustri/core';
import type { OrdersInsert } from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['create-order'],
    mutationFn: async (orderData: OrdersInsert) => {
      return await db.orders.create(orderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDERS] });
    },
    onError: (error: Error) => {
      console.error('Failed to create order:', error.message);
    },
  });
}
