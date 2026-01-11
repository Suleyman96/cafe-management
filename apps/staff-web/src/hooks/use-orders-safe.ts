/**
 * Type-Safe Orders Hooks
 * Uses the wrapped client for type safety without 'as any'
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';
import { QUERY_KEYS, ORDER_STATUS } from '@cafe-idare/core';
import type { Database } from '@cafe-idare/database';

type OrderStatus = Database['public']['Tables']['orders']['Row']['status'];
type OrderInsert = Database['public']['Tables']['orders']['Insert'];
type OrderFilters = {
  status?: OrderStatus;
  table_id?: string;
  order_type?: Database['public']['Tables']['orders']['Row']['order_type'];
};

export function useOrders(filters?: OrderFilters) {
  return useQuery({
    queryKey: [QUERY_KEYS.ORDERS, filters],
    queryFn: () => db.orders.findAll(filters),
  });
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.ORDER, orderId],
    queryFn: () => db.orders.findById(orderId),
    enabled: !!orderId,
  });
}

export function useActiveOrders() {
  return useQuery({
    queryKey: [QUERY_KEYS.ACTIVE_ORDERS],
    queryFn: () => db.orders.getActiveOrders(),
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: keyof typeof ORDER_STATUS }) => {
      const statusValue = ORDER_STATUS[status] as OrderStatus;
      return db.orders.updateStatus(orderId, statusValue);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ACTIVE_ORDERS] });
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (orderData: OrderInsert) => db.orders.create(orderData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
    },
  });
}

// Note: Payment-related hooks are in use-payments-safe.ts
// Note: Transfer-related hooks are in use-table-transfers-safe.ts