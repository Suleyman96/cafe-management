/**
 * Type-Safe Delivery Orders Hooks
 * Uses the wrapped client for type safety
 */

import { QUERY_KEYS } from '@cafe-idare/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';

export function useDeliveryOrders() {
  return useQuery({
    queryKey: [QUERY_KEYS.DELIVERY_ORDERS],
    queryFn: () => db.orders.findDeliveryOrders(),
  });
}

export function useAssignDeliveryPerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, staffId }: { orderId: string; staffId: string }) =>
      db.orders.assignDeliveryPerson(orderId, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER] });
    },
  });
}

export function useUpdateDeliveryFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, fee }: { orderId: string; fee: number }) =>
      db.orders.updateDeliveryFee(orderId, fee),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER] });
    },
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
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER] });
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
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER] });
    },
  });
}
