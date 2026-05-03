import type { Order, OrderItem, OrderItemsInsert } from '@gustri/database';
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrCreateClientRequestId } from '../idempotency';
import { invalidateOrders, invalidateOrdersAndTables } from '../invalidation';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';
import type { MutationCallbacks } from './types';

/**
 * Read the cached order shape so we can pass {oldStatus, oldType} into the
 * scoped invalidator. When the order isn't cached (e.g. cache cold) we
 * return undefineds and the helper invalidates conservatively.
 */
function peekOrder(
  qc: QueryClient,
  tenantId: string | null,
  orderId: string,
): Pick<Order, 'status' | 'order_type'> | null {
  const cached = qc.getQueryData<Pick<Order, 'status' | 'order_type'>>(
    tenantKey(tenantId, QUERY_KEYS.ORDER, orderId),
  );
  return cached ?? null;
}

export function useUpdateOrderStatus(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Order['status'] }) =>
      db.orders.updateStatus(id, status),
    onSuccess: (_data, { id, status }) => {
      const prev = peekOrder(queryClient, tenantId, id);
      invalidateOrdersAndTables(queryClient, tenantId, {
        orderId: id,
        oldStatus: prev?.status,
        newStatus: status,
        oldType: prev?.order_type,
      });
    },
    onError: options?.onError,
  });
}

export function useCancelOrder(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
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
    onSuccess: (_data, { orderId }) => {
      const prev = peekOrder(queryClient, tenantId, orderId);
      invalidateOrdersAndTables(queryClient, tenantId, {
        orderId,
        oldStatus: prev?.status,
        newStatus: 'cancelled',
        oldType: prev?.order_type,
      });
    },
    onError: options?.onError,
  });
}

export function useUpdateOrderNotes(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      notes,
    }: {
      orderId: string;
      notes: { customer_notes?: string | null; internal_notes?: string | null };
    }) => db.orders.updateNotes(orderId, notes),
    onSuccess: (_, { orderId }) => {
      invalidateOrders(queryClient, tenantId, orderId);
    },
    onError: options?.onError,
  });
}

export function useCleanupEmptyOrders(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (olderThanMinutes?: number) => db.orders.cleanupEmptyOrders(olderThanMinutes),
    onSuccess: () => {
      // Bulk cleanup — no per-order transition info available. Pass {} so
      // the helper falls through to its conservative pre-M6 superset.
      invalidateOrdersAndTables(queryClient, tenantId, {});
    },
    onError: options?.onError,
  });
}

export function useAddOrderItems(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    // Stamp a distinct `client_request_id` per item — the unique index is
    // per row, so a batch with shared ids would self-conflict. On replay
    // every item carries the id minted on the first attempt, the entire
    // batch trips the index, and `dedupeInsertMany` refetches the
    // original rows instead of inserting duplicates.
    onMutate: (items: OrderItemsInsert[]) => {
      for (const item of items) {
        item.client_request_id = getOrCreateClientRequestId(item.client_request_id);
      }
    },
    mutationFn: (items: OrderItemsInsert[]) => db.orderItems.create(items),
    onSuccess: () => {
      invalidateOrders(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

export function useUpdateOrderItemStatus(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderItem['status'] }) =>
      db.orderItems.updateStatus(id, status),
    onSuccess: () => {
      invalidateOrders(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

export function useDeleteOrderItem(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.orderItems.delete(id),
    onSuccess: () => {
      invalidateOrders(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

export function useCancelOrderItem(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cancelQty }: { id: string; cancelQty?: number }) =>
      db.orderItems.cancel(id, cancelQty),
    onSuccess: () => {
      invalidateOrders(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

// ─── Delivery ───────────────────────────────────────────────────────────────

export function useAssignDeliveryPerson(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, staffId }: { orderId: string; staffId: string }) =>
      db.orders.assignDeliveryPerson(orderId, staffId),
    onSuccess: () => {
      invalidateOrders(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

export function useUpdateDeliveryFee(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, fee }: { orderId: string; fee: number }) =>
      db.orders.updateDeliveryFee(orderId, fee),
    onSuccess: () => {
      invalidateOrders(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

export function useMarkOutForDelivery(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, deliveryPersonId }: { orderId: string; deliveryPersonId: string }) =>
      db.orders.markOutForDelivery(orderId, deliveryPersonId),
    onSuccess: (_data, { orderId }) => {
      const prev = peekOrder(queryClient, tenantId, orderId);
      invalidateOrdersAndTables(queryClient, tenantId, {
        orderId,
        oldStatus: prev?.status,
        newStatus: 'out_for_delivery',
        oldType: prev?.order_type ?? 'delivery',
        newType: 'delivery',
      });
    },
    onError: options?.onError,
  });
}

export function useMarkDelivered(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => db.orders.markDelivered(orderId),
    onSuccess: (_data, orderId) => {
      const prev = peekOrder(queryClient, tenantId, orderId);
      invalidateOrdersAndTables(queryClient, tenantId, {
        orderId,
        oldStatus: prev?.status,
        newStatus: 'delivered',
        oldType: prev?.order_type ?? 'delivery',
        newType: 'delivery',
      });
    },
    onError: options?.onError,
  });
}
