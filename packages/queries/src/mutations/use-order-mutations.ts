import type { Order, OrderItem, OrderItemsInsert } from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateOrders, invalidateOrdersAndTables } from '../invalidation';
import { useDb } from '../provider';

export function useUpdateOrderStatus() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Order['status'] }) =>
      db.orders.updateStatus(id, status),
    onSuccess: () => {
      invalidateOrdersAndTables(queryClient);
    },
  });
}

export function useAssignWaiter() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, waiterId }: { orderId: string; waiterId: string | null }) =>
      db.orders.assignWaiter(orderId, waiterId),
    onSuccess: () => {
      invalidateOrders(queryClient);
    },
  });
}

export function useCancelOrder() {
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
  });
}

export function useUpdateOrderNotes() {
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
  });
}

export function useCleanupEmptyOrders() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (olderThanMinutes?: number) => db.orders.cleanupEmptyOrders(olderThanMinutes),
    onSuccess: () => {
      invalidateOrdersAndTables(queryClient);
    },
  });
}

export function useAddOrderItems() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: OrderItemsInsert[]) => db.orderItems.create(items),
    onSuccess: () => {
      invalidateOrders(queryClient);
    },
  });
}

export function useUpdateOrderItemStatus() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderItem['status'] }) =>
      db.orderItems.updateStatus(id, status),
    onSuccess: () => {
      invalidateOrders(queryClient);
    },
  });
}

export function useDeleteOrderItem() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.orderItems.delete(id),
    onSuccess: () => {
      invalidateOrders(queryClient);
    },
  });
}

export function useCancelOrderItem() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cancelQty }: { id: string; cancelQty?: number }) =>
      db.orderItems.cancel(id, cancelQty),
    onSuccess: () => {
      invalidateOrders(queryClient);
    },
  });
}

// ─── Delivery ───────────────────────────────────────────────────────────────

export function useAssignDeliveryPerson() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, staffId }: { orderId: string; staffId: string }) =>
      db.orders.assignDeliveryPerson(orderId, staffId),
    onSuccess: () => {
      invalidateOrders(queryClient);
    },
  });
}

export function useUpdateDeliveryFee() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, fee }: { orderId: string; fee: number }) =>
      db.orders.updateDeliveryFee(orderId, fee),
    onSuccess: () => {
      invalidateOrders(queryClient);
    },
  });
}

export function useMarkOutForDelivery() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, deliveryPersonId }: { orderId: string; deliveryPersonId: string }) =>
      db.orders.markOutForDelivery(orderId, deliveryPersonId),
    onSuccess: () => {
      invalidateOrdersAndTables(queryClient);
    },
  });
}

export function useMarkDelivered() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => db.orders.markDelivered(orderId),
    onSuccess: () => {
      invalidateOrdersAndTables(queryClient);
    },
  });
}
