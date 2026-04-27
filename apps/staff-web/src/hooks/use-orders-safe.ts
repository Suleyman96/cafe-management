/**
 * Type-Safe Orders Hooks
 * Re-exports from @gustri/queries, with local overrides for optimistic updates
 * and app-specific mutations (apiRoutes).
 */

import { ORDER_STATUS, QUERY_KEYS } from '@gustri/core';
import type { Database } from '@gustri/database';
import { useOrders as useOrdersShared } from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';
import { invalidateOrdersAndTables } from '@/lib/query-helpers';
import { db } from '@/lib/supabase/wrapped-client';
import type { OrderWithDetails } from '@/types';

type OrderStatus = Database['public']['Tables']['orders']['Row']['status'];
type OrderInsert = Database['public']['Tables']['orders']['Insert'];

// Re-export shared read hooks
// Re-export shared simple mutations
export {
  useActiveOrders,
  useAddOrderItems,
  useAssignWaiter,
  useCancelOrder,
  useCleanupEmptyOrders,
  useDeleteOrderItem,
  useOrder,
  useOrders,
  useUpdateOrderNotes,
} from '@gustri/queries';

// Local override: different param shape ({ itemId } vs shared { id })
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

// Local override: optimistic updates for order status changes
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

// Local override: optimistic updates for order item status changes
export function useUpdateOrderItemStatus() {
  const queryClient = useQueryClient();

  type OrderItemStatus = Database['public']['Tables']['order_items']['Row']['status'];

  return useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: OrderItemStatus }) => {
      return db.orderItems.updateStatus(itemId, status);
    },
    onMutate: async ({ itemId, status }) => {
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.ACTIVE_ORDERS] });

      const previousOrders = queryClient.getQueryData([QUERY_KEYS.ORDERS]);
      const previousActive = queryClient.getQueryData([QUERY_KEYS.ACTIVE_ORDERS]);

      const updateList = (old: OrderWithDetails[] | undefined) =>
        old?.map((order) => ({
          ...order,
          order_items: order.order_items?.map((item) =>
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

// Local: uses apiRoutes for server-side plan limit enforcement
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

// Composite hook: derives pending approval count from orders. The limit caps
// the worst case — pending-approval orders should clear within seconds, so
// 100 is plenty even for a busy floor and stays bounded if the queue stalls.
export function usePendingApprovalCount() {
  const { data: orders } = useOrdersShared({
    status: 'pending_approval' as OrderStatus,
    limit: 100,
  });
  return (orders || []).length;
}

// Note: Payment-related hooks are in use-payments-safe.ts
// Note: Transfer-related hooks are in use-table-transfers-safe.ts
