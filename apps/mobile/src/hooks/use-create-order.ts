import { QUERY_KEYS } from '@cafe-idare/core';
import type { OrderItemsInsert, OrdersInsert } from '@cafe-idare/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderData: OrdersInsert) => {
      return await db.orders.create(orderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
    },
    onError: (error: Error) => {
      console.error('Failed to create order:', error.message);
    },
  });
}

export function useAddOrderItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: OrderItemsInsert[]) => {
      return await db.orderItems.create(items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
    },
    onError: (error: Error) => {
      console.error('Failed to add order items:', error.message);
    },
  });
}
