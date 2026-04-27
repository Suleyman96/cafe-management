import { QUERY_KEYS } from '@gustri/core';
import type { Order, OrderItem } from '@gustri/database';
import { useDb } from '@gustri/queries';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { MUTATION_KEYS } from '@/lib/mutation-keys';
import { notifyNewOrder } from '@/lib/notifications';
import { playNewOrderSound } from '@/lib/sound';
import { db } from '@/lib/supabase';
import { useRealtimeStatusStore } from '@/store/realtime-status-store';
import type { OrderWithDetails } from '@/types';
import { useRealtimeSync } from './use-realtime-sync';

// Re-export read hooks and mutations with matching param shapes
export { useCleanupEmptyOrders } from '@gustri/queries';

// Local mutations — mobile consumers use { orderId } / { itemId } instead of { id }

export function useUpdateOrderStatus() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: MUTATION_KEYS.UPDATE_ORDER_STATUS,
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
    mutationKey: MUTATION_KEYS.UPDATE_ORDER_ITEM_STATUS,
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

  // Fallback alert path: when realtime is degraded, the 2-min poll keeps the
  // list fresh but the INSERT-triggered sound never fires. Diff the previous
  // and current ID sets and play a sound for any newly-arrived orders.
  // First render seeds the set without playing — we only want sound for
  // genuinely new arrivals.
  const knownOrderIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!query.data) return;
    const fresh = new Set(query.data.map((o) => o.id));
    if (knownOrderIdsRef.current === null) {
      knownOrderIdsRef.current = fresh;
      return;
    }
    const previous = knownOrderIdsRef.current;
    knownOrderIdsRef.current = fresh;

    const isDegraded = useRealtimeStatusStore.getState().isAnyDegraded();
    if (!isDegraded) return;

    const newOrders = query.data.filter((o) => !previous.has(o.id));
    if (newOrders.length === 0) return;

    void playNewOrderSound();
    for (const order of newOrders) {
      if (!order.table_id) continue;
      void db.tables
        .findById(order.table_id)
        .then((table) =>
          notifyNewOrder(
            order.order_number ?? '—',
            (table as { table_number: string }).table_number,
            order.id,
          ),
        )
        .catch(() => {
          // Table lookup failed — sound already played, banner still visible
        });
    }
  }, [query.data]);

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
