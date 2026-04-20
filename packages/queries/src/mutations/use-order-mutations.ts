import type { Order, OrderItem, OrderItemsInsert } from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateOrders, invalidateOrdersAndTables } from '../invalidation';
import { useDb } from '../provider';
import type { MutationCallbacks } from './types';

export function useUpdateOrderStatus(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Order['status'] }) =>
      db.orders.updateStatus(id, status),
    onSuccess: () => {
      invalidateOrdersAndTables(queryClient);
    },
    onError: options?.onError,
  });
}

export function useAssignWaiter(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, waiterId }: { orderId: string; waiterId: string | null }) =>
      db.orders.assignWaiter(orderId, waiterId),
    onSuccess: () => {
      invalidateOrders(queryClient);
    },
    onError: options?.onError,
  });
}

export function useCancelOrder(options?: MutationCallbacks) {
  const db = useDb();
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
    onError: options?.onError,
  });
}

export function useUpdateOrderNotes(options?: MutationCallbacks) {
  const db = useDb();
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
      invalidateOrders(queryClient, orderId);
    },
    onError: options?.onError,
  });
}

export function useCleanupEmptyOrders(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (olderThanMinutes?: number) => db.orders.cleanupEmptyOrders(olderThanMinutes),
    onSuccess: () => {
      invalidateOrdersAndTables(queryClient);
    },
    onError: options?.onError,
  });
}

export function useAddOrderItems(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: OrderItemsInsert[]) => db.orderItems.create(items),
    onSuccess: () => {
      invalidateOrders(queryClient);
    },
    onError: options?.onError,
  });
}

export function useUpdateOrderItemStatus(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderItem['status'] }) =>
      db.orderItems.updateStatus(id, status),
    onSuccess: () => {
      invalidateOrders(queryClient);
    },
    onError: options?.onError,
  });
}

export function useDeleteOrderItem(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.orderItems.delete(id),
    onSuccess: () => {
      invalidateOrders(queryClient);
    },
    onError: options?.onError,
  });
}

export function useCancelOrderItem(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cancelQty }: { id: string; cancelQty?: number }) =>
      db.orderItems.cancel(id, cancelQty),
    onSuccess: () => {
      invalidateOrders(queryClient);
    },
    onError: options?.onError,
  });
}

// ─── Delivery ───────────────────────────────────────────────────────────────

export function useAssignDeliveryPerson(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, staffId }: { orderId: string; staffId: string }) =>
      db.orders.assignDeliveryPerson(orderId, staffId),
    onSuccess: () => {
      invalidateOrders(queryClient);
    },
    onError: options?.onError,
  });
}

export function useUpdateDeliveryFee(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, fee }: { orderId: string; fee: number }) =>
      db.orders.updateDeliveryFee(orderId, fee),
    onSuccess: () => {
      invalidateOrders(queryClient);
    },
    onError: options?.onError,
  });
}

export function useMarkOutForDelivery(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, deliveryPersonId }: { orderId: string; deliveryPersonId: string }) =>
      db.orders.markOutForDelivery(orderId, deliveryPersonId),
    onSuccess: () => {
      invalidateOrdersAndTables(queryClient);
    },
    onError: options?.onError,
  });
}

export function useMarkDelivered(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => db.orders.markDelivered(orderId),
    onSuccess: () => {
      invalidateOrdersAndTables(queryClient);
    },
    onError: options?.onError,
  });
}
