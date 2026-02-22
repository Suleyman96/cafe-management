/**
 * Type-Safe Orders Hooks
 * Uses the wrapped client for type safety without 'as any'
 */

import { ORDER_STATUS, QUERY_KEYS } from '@cafe-idare/core';
import type { Database } from '@cafe-idare/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';

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

export function useAddOrderItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: Database['public']['Tables']['order_items']['Insert'][]) =>
      db.orderItems.create(items),
    onSuccess: (_, variables) => {
      // Get the order_id from the first item to invalidate that specific order
      const orderId = variables[0]?.order_id;
      if (orderId) {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, orderId] });
      }
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ACTIVE_ORDERS] });
    },
  });
}

export function useAssignWaiter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, waiterId }: { orderId: string; waiterId: string | null }) =>
      db.orders.assignWaiter(orderId, waiterId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, variables.orderId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ACTIVE_ORDERS] });
    },
  });
}

type OrderItemStatus = Database['public']['Tables']['order_items']['Row']['status'];

export function useUpdateOrderItemStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: OrderItemStatus }) =>
      db.orderItems.updateStatus(itemId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ACTIVE_ORDERS] });
    },
  });
}

export function useDeleteOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => db.orderItems.delete(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ACTIVE_ORDERS] });
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
      tableId?: string | null;
    }) => db.orders.cancelOrder(orderId, reason, tableId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ACTIVE_ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
    },
  });
}

export function useUpdateOrderNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      notes,
    }: {
      orderId: string;
      notes: { customer_notes?: string | null; internal_notes?: string | null };
    }) => db.orders.updateNotes(orderId, notes),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, variables.orderId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ACTIVE_ORDERS] });
    },
  });
}

// Note: Payment-related hooks are in use-payments-safe.ts
// Note: Transfer-related hooks are in use-table-transfers-safe.ts
