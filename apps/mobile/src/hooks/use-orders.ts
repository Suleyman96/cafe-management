import type { Order, OrderItem, Table } from '@gustri/database';
import { OrdersRealtimeInsertSchema, OrdersRealtimeUpdateSchema } from '@gustri/database';
import { QUERY_KEYS, useDb } from '@gustri/queries';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { markEvent } from '@/lib/event-dedup';
import { hapticEvent } from '@/lib/haptics';
import { MUTATION_KEYS } from '@/lib/mutation-keys';
import { notifyNewOrder } from '@/lib/notifications';
import { validateRealtimePayload } from '@/lib/realtime-validation';
import { playNewOrderSound } from '@/lib/sound';
import { db } from '@/lib/supabase';
import { type RealtimeChannelStatus, useRealtimeStatusStore } from '@/store/realtime-status-store';
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

/**
 * Wraps `@gustri/queries.useOrders` semantics with mobile-specific behavior:
 * a Supabase realtime subscription on the `orders` table that plays a sound
 * and posts a local push notification on INSERT, plus a fallback poll diff
 * that fires the same side effects when realtime is degraded.
 */
export function useOrders(filters?: {
  status?: Order['status'];
  statuses?: Order['status'][];
  table_id?: string;
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
          const parsed = OrdersRealtimeInsertSchema.safeParse(newRecord);
          if (parsed.success) {
            // Mark BEFORE playing so a near-simultaneous push (which checks
            // seenRecently in the foreground handler) suppresses its sound.
            markEvent(`order:${parsed.data.id}`);
          }

          hapticEvent();
          await playNewOrderSound();

          if (!parsed.success) {
            Sentry.captureException(parsed.error, {
              tags: { area: 'realtime.orders.insert' },
            });
            return;
          }
          const order = parsed.data;
          if (!order.table_id) return;

          try {
            const tableData = (await db.tables.findById(order.table_id)) as Table | null;
            if (!tableData?.table_number) return;
            await notifyNewOrder(order.order_number ?? '—', tableData.table_number, order.id);
          } catch (err: unknown) {
            Sentry.captureException(err, { tags: { area: 'realtime.orders.notify' } });
          }
        },
      },
      {
        table: 'orders' as const,
        event: 'UPDATE' as const,
        queryKeys: [[QUERY_KEYS.ORDERS]],
        onPayload: (newRecord: Record<string, unknown>) => {
          // Validate to surface schema drift via Sentry. Invalidation runs
          // unconditionally — even if validation fails we still want the cache
          // to refetch from the source of truth.
          validateRealtimePayload(OrdersRealtimeUpdateSchema, newRecord, {
            table: 'orders',
            event: 'UPDATE',
          });
        },
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

  const runDegradedCatchup = useCallback(() => {
    if (!query.data) return;
    const fresh = new Set(query.data.map((o) => o.id));
    if (knownOrderIdsRef.current === null) {
      // First time we have data — seed without firing. We only care about
      // *new* arrivals from this point forward.
      knownOrderIdsRef.current = fresh;
      return;
    }
    const previous = knownOrderIdsRef.current;
    knownOrderIdsRef.current = fresh;

    const isDegraded = useRealtimeStatusStore.getState().isAnyDegraded();
    if (!isDegraded) return;

    const newOrders = query.data.filter((o) => !previous.has(o.id));
    if (newOrders.length === 0) return;

    hapticEvent();
    void playNewOrderSound();
    for (const order of newOrders) {
      if (!order.table_id) continue;
      void db.tables
        .findById(order.table_id)
        .then((table) => {
          const t = table as Table | null;
          if (!t?.table_number) return;
          return notifyNewOrder(order.order_number ?? '—', t.table_number, order.id);
        })
        .catch(() => {
          // Table lookup failed — sound already played, banner still visible
        });
    }
  }, [query.data]);

  useEffect(() => {
    runDegradedCatchup();
  }, [runDegradedCatchup]);

  // Mobile audit #3 — fire catchup on the *moment* realtime flips to degraded,
  // not just when the post-transition refetch eventually lands. The
  // invalidateAll() inside use-realtime-sync triggers a React-Query refetch,
  // which in turn updates `query.data`, which fires `runDegradedCatchup` via
  // the effect above — but that depends on the refetch completing
  // synchronously after the transition. If the refetch is delayed (slow
  // network, briefly suspended observer), kitchen staff get a silent window
  // until the next refetch lands. This second trigger forces an explicit
  // `query.refetch()` at the transition edge so the catchup is bounded by
  // network latency, not by React-Query scheduling.
  const channelStatus = useRealtimeStatusStore((s) => s.channels['orders:all'] ?? null);
  const previousChannelStatusRef = useRef<RealtimeChannelStatus | null>(null);
  useEffect(() => {
    const previous = previousChannelStatusRef.current;
    previousChannelStatusRef.current = channelStatus;
    if (previous === 'degraded' || channelStatus !== 'degraded') return;
    // Best-effort refetch; the [runDegradedCatchup] effect above handles the
    // diff once `query.data` updates. If the refetch already completed via
    // `invalidateAll`, this is a no-op (React Query dedupes in-flight reads).
    void query.refetch();
  }, [channelStatus, query]);

  return query;
}

/**
 * Mobile-local single-order read. Unlike `@gustri/queries.useOrder`, this
 * variant doesn't gate on `enabled: !!orderId` because every call site
 * routes via a stack-navigation param that's guaranteed non-empty.
 */
export function useOrder(orderId: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.ORDER, orderId],
    queryFn: async (): Promise<Order> => {
      return await db.orders.findById(orderId);
    },
  });
}
