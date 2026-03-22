import { QUERY_KEYS } from '@cafe-idare/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import type { Order } from '@/types';

export function useDeliveryOrders() {
  return useQuery({
    queryKey: [QUERY_KEYS.DELIVERY_ORDERS],
    queryFn: async (): Promise<Order[]> => db.orders.findDeliveryOrders(),
    staleTime: 0,
  });
}

export function useMarkOutForDelivery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, deliveryPersonId }: { orderId: string; deliveryPersonId: string }) =>
      db.orders.markOutForDelivery(orderId, deliveryPersonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
    },
    onError: (error: Error) => {
      console.error('Failed to mark order out for delivery:', error.message);
    },
  });
}

export function useMarkDelivered() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => db.orders.markDelivered(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
    },
    onError: (error: Error) => {
      console.error('Failed to mark delivery as delivered:', error.message);
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      reason,
      tableId,
    }: {
      orderId: string;
      reason: string;
      tableId?: string;
    }) => db.orders.cancelOrder(orderId, reason, tableId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
    },
    onError: (error: Error) => {
      console.error('Failed to cancel order:', error.message);
    },
  });
}
