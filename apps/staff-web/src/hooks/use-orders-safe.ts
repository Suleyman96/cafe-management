/**
 * Type-Safe Orders Hooks
 * Uses the wrapped client for type safety without 'as any'
 */

import { ORDER_STATUS, QUERY_KEYS } from '@gustri/core';
import type { Database } from '@gustri/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';
import { invalidateOrders, invalidateOrdersAndTables } from '@/lib/query-helpers';
import { db } from '@/lib/supabase/wrapped-client';
import type { OrderWithDetails } from '@/types';

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
    queryFn: async (): Promise<OrderWithDetails[]> => db.orders.findAll(filters),
  });
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.ORDER, orderId],
    queryFn: async (): Promise<OrderWithDetails> =>
      db.orders.findById(orderId) as Promise<OrderWithDetails>,
    enabled: !!orderId,
  });
}

export function useActiveOrders() {
  return useQuery({
    queryKey: [QUERY_KEYS.ACTIVE_ORDERS],
    queryFn: async (): Promise<OrderWithDetails[]> => db.orders.getActiveOrders(),
    // Polling removed: useRealtimeSync on the orders page handles freshness.
    // A 120s fallback poll is built into useRealtimeSync for silent WS drops.
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: keyof typeof ORDER_STATUS }) => {
      const statusValue = ORDER_STATUS[status] as OrderStatus;
      return db.orders.updateStatus(orderId, statusValue);
    },
    onMutate: async ({ orderId, status }) => {
      const statusValue = ORDER_STATUS[status] as OrderStatus;
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.ACTIVE_ORDERS] });

      const previousOrders = queryClient.getQueryData([QUERY_KEYS.ORDERS]);
      const previousActive = queryClient.getQueryData([QUERY_KEYS.ACTIVE_ORDERS]);

      const updateList = (old: OrderWithDetails[] | undefined) =>
        old?.map((o) => (o.id === orderId ? { ...o, status: statusValue } : o));

      queryClient.setQueryData([QUERY_KEYS.ORDERS], updateList);
      queryClient.setQueryData([QUERY_KEYS.ACTIVE_ORDERS], updateList);

      return { previousOrders, previousActive };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData([QUERY_KEYS.ORDERS], context.previousOrders);
      }
      if (context?.previousActive) {
        queryClient.setQueryData([QUERY_KEYS.ACTIVE_ORDERS], context.previousActive);
      }
    },
    onSettled: () => {
      invalidateOrdersAndTables(queryClient);
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderData: OrderInsert) => {
      // Plan limit is now enforced server-side in the API route
      const { order } = await apiRoutes.orders.create(orderData);
      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ACTIVE_ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MONTHLY_ORDER_COUNT] });
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
      invalidateOrders(queryClient, orderId || undefined);
    },
  });
}

export function useAssignWaiter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, waiterId }: { orderId: string; waiterId: string | null }) =>
      db.orders.assignWaiter(orderId, waiterId),
    onSuccess: (_, variables) => {
      invalidateOrders(queryClient, variables.orderId);
    },
  });
}

type OrderItemStatus = Database['public']['Tables']['order_items']['Row']['status'];

export function useUpdateOrderItemStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: OrderItemStatus }) =>
      db.orderItems.updateStatus(itemId, status),
    onMutate: async ({ itemId, status }) => {
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.ACTIVE_ORDERS] });

      const previousOrders = queryClient.getQueryData([QUERY_KEYS.ORDERS]);
      const previousActive = queryClient.getQueryData([QUERY_KEYS.ACTIVE_ORDERS]);

      const updateList = (old: OrderWithDetails[] | undefined) =>
        old?.map((order) => ({
          ...order,
          order_items: order.order_items?.map((item: any) =>
            item.id === itemId ? { ...item, status } : item,
          ),
        }));

      queryClient.setQueryData([QUERY_KEYS.ORDERS], updateList);
      queryClient.setQueryData([QUERY_KEYS.ACTIVE_ORDERS], updateList);

      return { previousOrders, previousActive };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData([QUERY_KEYS.ORDERS], context.previousOrders);
      }
      if (context?.previousActive) {
        queryClient.setQueryData([QUERY_KEYS.ACTIVE_ORDERS], context.previousActive);
      }
    },
    onSettled: () => {
      invalidateOrdersAndTables(queryClient);
    },
  });
}

export function useDeleteOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => db.orderItems.delete(itemId),
    onSuccess: () => {
      invalidateOrdersAndTables(queryClient);
    },
  });
}

export function useCancelOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, cancelQty }: { itemId: string; cancelQty?: number }) =>
      db.orderItems.cancel(itemId, cancelQty),
    onSuccess: () => {
      invalidateOrdersAndTables(queryClient);
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
      invalidateOrdersAndTables(queryClient);
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
      invalidateOrders(queryClient, variables.orderId);
    },
  });
}

export function useCleanupEmptyOrders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (olderThanMinutes?: number) => db.orders.cleanupEmptyOrders(olderThanMinutes),
    onSuccess: (cancelledIds) => {
      if (cancelledIds.length > 0) {
        invalidateOrdersAndTables(queryClient);
      }
    },
  });
}

export function usePendingApprovalCount() {
  const { data: orders } = useOrders({ status: 'pending_approval' as OrderStatus });
  return (orders || []).length;
}

// Note: Payment-related hooks are in use-payments-safe.ts
// Note: Transfer-related hooks are in use-table-transfers-safe.ts
