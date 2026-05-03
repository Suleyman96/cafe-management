/**
 * Type-Safe Orders Hooks
 * Re-exports from @gustri/queries, with local overrides for optimistic updates
 * and app-specific mutations (apiRoutes).
 */

import { ORDER_STATUS } from '@gustri/core';
import type { Database } from '@gustri/database';
import {
  getOrCreateClientRequestId,
  QUERY_KEYS,
  useOrders as useOrdersShared,
} from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';
import { invalidateOrders, invalidateOrdersAndTables } from '@/lib/query-helpers';
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
      // Item-level cancel — order may flip to empty/cancelled but TABLES/DELIVERY/TAKEOUT
      // shape doesn't shift on item changes. Refetch only ORDERS.
      invalidateOrders(queryClient);
    },
  });
}

// Local override: optimistic updates for order status changes
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: keyof typeof ORDER_STATUS }) => {
      const statusValue = ORDER_STATUS[status] as OrderStatus;
      // Mint a fresh idempotency key per attempt. The wrapper is idempotent
      // via a conditional UPDATE, so this key is currently unused server-side
      // but reserved for a future status-update audit log.
      const clientRequestId = getOrCreateClientRequestId();
      return db.orders.updateStatus(orderId, statusValue, { clientRequestId });
    },
    onMutate: async ({ orderId, status }) => {
      const statusValue = ORDER_STATUS[status] as OrderStatus;
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.ACTIVE_ORDERS] });

      // Capture pre-mutation order so we can pass {oldStatus, oldType} to
      // invalidateOrdersAndTables in onSettled. Without this the helper
      // can't tell whether the transition crossed a terminal state and
      // would invalidate TABLES on every kitchen toggle.
      const previousOrder = queryClient.getQueryData<OrderWithDetails>([QUERY_KEYS.ORDER, orderId]);

      // Optimistic patch on the affected row only. We deliberately do NOT
      // snapshot the full list for rollback — restoring a pre-mutation list
      // on error would clobber any realtime updates (delivery_fee,
      // customer_notes, item-level changes) that landed between onMutate and
      // onError. On error we leave the optimistic patch in place; onSettled's
      // invalidate refetches truth from the server. (Audit plan Option A.)
      const updateList = (old: OrderWithDetails[] | undefined) =>
        old?.map((o) => (o.id === orderId ? { ...o, status: statusValue } : o));

      queryClient.setQueryData([QUERY_KEYS.ORDERS], updateList);
      queryClient.setQueryData([QUERY_KEYS.ACTIVE_ORDERS], updateList);

      return { previousOrder };
    },
    onSettled: (_data, _err, { orderId, status }, context) => {
      const statusValue = ORDER_STATUS[status] as OrderStatus;
      invalidateOrdersAndTables(queryClient, {
        orderId,
        oldStatus: context?.previousOrder?.status,
        newStatus: statusValue,
        oldType: context?.previousOrder?.order_type,
      });
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

      // Optimistic patch only — see useUpdateOrderStatus for the rationale.
      // No full-list snapshot: a rollback would lose any realtime changes
      // that arrive mid-flight. onSettled's invalidate converges on truth.
      const updateList = (old: OrderWithDetails[] | undefined) =>
        old?.map((order) => ({
          ...order,
          order_items: order.order_items?.map((item) =>
            item.id === itemId ? { ...item, status } : item,
          ),
        }));

      queryClient.setQueryData([QUERY_KEYS.ORDERS], updateList);
      queryClient.setQueryData([QUERY_KEYS.ACTIVE_ORDERS], updateList);
    },
    onSettled: () => {
      // Item status changes don't move the order between terminal states —
      // tables, delivery and takeout shapes are unaffected. Refetch only ORDERS.
      invalidateOrders(queryClient);
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
    onSuccess: (createdOrder) => {
      invalidateOrdersAndTables(queryClient, {
        isCreation: true,
        newType: createdOrder.order_type,
        newStatus: createdOrder.status,
      });
      // Plan-cap widget — kept unconditional; gating on near-cap requires
      // plan-aware logic that doesn't belong in a write hook.
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
