import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';

export function useDeliveryOrders() {
  return useQuery({
    queryKey: ['delivery-orders'],
    queryFn: () => db.orders.findDeliveryOrders(),
    staleTime: 0,
  });
}

export function useMarkOutForDelivery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, deliveryPersonId }: { orderId: string; deliveryPersonId: string }) =>
      db.orders.markOutForDelivery(orderId, deliveryPersonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useMarkDelivered() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => db.orders.markDelivered(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
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
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
