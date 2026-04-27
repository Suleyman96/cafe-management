import { QUERY_KEYS } from '@gustri/core';
import type { Order, OrderItem } from '@gustri/database';
import { useDb } from '@gustri/queries';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { notifyNewOrder } from '@/lib/notifications';
import { playNewOrderSound } from '@/lib/sound';
import { db } from '@/lib/supabase';
import type { OrderWithDetails } from '@/types';
import { useRealtimeSync } from './use-realtime-sync';

// Re-export read hooks and mutations with matching param shapes
export { useCleanupEmptyOrders } from '@gustri/queries';

// Local mutations — mobile consumers use { orderId } / { itemId } instead of { id }

export function useUpdateOrderStatus() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: Order['status'] }) =>
      db.orders.updateStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
    },
  });
}

export function useUpdateOrderItemStatus() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: OrderItem['status'] }) =>
      db.orderItems.updateStatus(itemId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
    },
  });
}

// Read hooks with realtime subscriptions — kept local

export function useOrders(filters?: {
  status?: Order['status'];
  statuses?: Order['status'][];
  assigned_waiter_id?: string;
  created_after?: string;
  created_before?: string;
  limit?: number;
}) {
  const dbClient = useDb();

  const query = useQuery({
    queryKey: [QUERY_KEYS.ORDERS, filters],
    queryFn: async (): Promise<OrderWithDetails[]> => dbClient.orders.findAll(filters || undefined),
    staleTime: 10 * 1000, // 10s — realtime subscription handles freshness
  });

  // Stable handler refs for realtime side effects
  const realtimeHandlers = useMemo(
    () => [
      {
        table: 'orders' as const,
        event: 'INSERT' as const,
        queryKeys: [[QUERY_KEYS.ORDERS]],
        onPayload: async (newRecord: Record<string, unknown>) => {
          await playNewOrderSound();

          if (newRecord.table_id) {
            try {
              const tableData = (await db.tables.findById(newRecord.table_id as string)) as {
                table_number: string;
              };
              await notifyNewOrder(
                newRecord.order_number as string,
                tableData.table_number,
                newRecord.id as string,
              );
            } catch {
              // Table lookup failed — notification skipped, invalidation still happens
            }
          }
        },
      },
      {
        table: 'orders' as const,
        event: 'UPDATE' as const,
        queryKeys: [[QUERY_KEYS.ORDERS]],
      },
      {
        table: 'order_items' as const,
        event: '*' as const,
        queryKeys: [[QUERY_KEYS.ORDERS]],
      },
    ],
    [],
  );

  useRealtimeSync('orders:all', realtimeHandlers);

  return query;
}

export function useOrder(orderId: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.ORDER, orderId],
    queryFn: async (): Promise<Order> => {
      return await db.orders.findById(orderId);
    },
  });
}
