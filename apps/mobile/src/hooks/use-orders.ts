import { OrdersRealtimeInsertSchema, OrdersRealtimeUpdateSchema } from '@gustri/database';
import type { Order, OrderItem, Table } from '@gustri/database/types';
import { patchQueries, QUERY_KEYS, rollbackQueries, STALE_TIMES, useDb } from '@gustri/queries';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { markEvent, RECONNECT_REPLAY_WINDOW_MS, seenRecently } from '@/lib/event-dedup';
import { hapticEvent } from '@/lib/haptics';
import { MUTATION_KEYS } from '@/lib/mutation-keys';
import { notifyNewOrder } from '@/lib/notifications';
import { patchOrderItemUpdate } from '@/lib/realtime-patches';
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
    // Optimistic: flip the order status in the list + detail before the
    // round-trip. Especially valuable on mobile — while offline the mutation
    // is paused but onMutate still runs, so the change shows immediately and
    // persists until the queued replay reconciles. Rolls back on error.
    onMutate: async ({ orderId, status }) => {
      const listSnap = await patchQueries<OrderWithDetails[]>(
        queryClient,
        [QUERY_KEYS.ORDERS],
        (list) =>
          Array.isArray(list) ? list.map((o) => (o.id === orderId ? { ...o, status } : o)) : list,
      );
      const detailSnap = await patchQueries<Order>(queryClient, [QUERY_KEYS.ORDER, orderId], (o) =>
        o?.id === orderId ? { ...o, status } : o,
      );
      return { snapshot: [...listSnap, ...detailSnap] };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) rollbackQueries(queryClient, context.snapshot);
    },
    onSettled: () => {
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
    // Optimistic: patch the matching item's status inside every cached order.
    onMutate: async ({ itemId, status }) => {
      const snapshot = await patchQueries<OrderWithDetails[]>(
        queryClient,
        [QUERY_KEYS.ORDERS],
        (list) =>
          Array.isArray(list)
            ? list.map((o) => {
                if (!o.order_items?.some((it) => it.id === itemId)) return o;
                return {
                  ...o,
                  order_items: o.order_items.map((it) =>
                    it.id === itemId ? { ...it, status } : it,
                  ),
                };
              })
            : list,
      );
      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) rollbackQueries(queryClient, context.snapshot);
    },
    onSettled: () => {
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
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [QUERY_KEYS.ORDERS, filters],
    queryFn: async (): Promise<OrderWithDetails[]> => dbClient.orders.findAll(filters || undefined),
    staleTime: STALE_TIMES.REALTIME, // realtime subscription handles freshness
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
            const orderKey = `order:${parsed.data.id}`;
            // Audit #5 + C2 — Supabase Realtime can re-deliver an INSERT
            // after a brief disconnect (>5 s after the original). The
            // RECONNECT_REPLAY_WINDOW_MS lookup catches reconnect-replay
            // even when a backgrounded device misses traffic for several
            // minutes — the kitchen must not ring twice for the same order.
            // We still refresh the timestamp below so the realtime↔push
            // race dedup at the foreground notification handler keeps
            // working.
            const isReplay = seenRecently(orderKey, RECONNECT_REPLAY_WINDOW_MS);
            // Mark BEFORE playing so a near-simultaneous push (which checks
            // seenRecently in the foreground handler with a 500 ms window)
            // suppresses its sound for the original delivery.
            markEvent(orderKey);
            if (isReplay) {
              // Replay path skips side effects but still invalidates via the
              // realtime handler chain — `useRealtimeSync` runs the
              // `queryKeys` invalidation regardless of `onPayload`'s return.
              return;
            }
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
      // Audit C5 — order_items UPDATE patches the cache directly so the
      // kitchen list doesn't refetch on every status flip. Status
      // transitions on items (pending → preparing → ready → served) are
      // the highest-frequency realtime events during a busy service, and
      // the previous broad invalidation re-fetched the entire list per
      // event. Item status doesn't change order-level filter membership
      // (kitchen view filters by ORDER status, not item status), so the
      // patch is safe and complete. `queryKeys: []` suppresses the
      // post-handler invalidation; the orders INSERT/UPDATE handlers
      // above and the order_items INSERT/DELETE handlers below cover
      // degraded-recovery `invalidateAll`, so we don't lose that safety
      // net.
      {
        table: 'order_items' as const,
        event: 'UPDATE' as const,
        queryKeys: [],
        onPayload: (payload: Record<string, unknown>) => {
          patchOrderItemUpdate(queryClient, payload);
        },
      },
      // INSERT and DELETE still invalidate. INSERT lacks the `menu_item`
      // join the cache row needs; DELETE is rare enough that the single
      // refetch isn't a perf concern.
      {
        table: 'order_items' as const,
        event: 'INSERT' as const,
        queryKeys: [[QUERY_KEYS.ORDERS]],
      },
      {
        table: 'order_items' as const,
        event: 'DELETE' as const,
        queryKeys: [[QUERY_KEYS.ORDERS]],
      },
    ],
    [queryClient],
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

    // Widened gate so reconnecting state also alerts; dedup against the
    // realtime path so a brief recovery delivering the same INSERT doesn't double-play.
    const isUnhealthy = useRealtimeStatusStore.getState().isAnyUnhealthy();
    if (!isUnhealthy) return;

    const newOrders = query.data
      .filter((o) => !previous.has(o.id))
      .filter((o) => !seenRecently(`order:${o.id}`));
    if (newOrders.length === 0) return;

    for (const order of newOrders) {
      markEvent(`order:${order.id}`);
    }

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
 * Mobile-local single-order read. Most call sites navigate here with a
 * non-empty stack-param id, but the AddItems screen also opens for the
 * new-dine-in flow (tableId only, no orderId yet) and needs to skip the
 * fetch entirely — hence the optional `enabled` gate, mirroring the
 * shared `@gustri/queries.useOrder`. Without the gate, callers passing
 * an empty id fire `findById('')` and pollute Sentry with not-found
 * errors on every screen open.
 */
export function useOrder(orderId: string, options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.ORDER, orderId],
    queryFn: async (): Promise<Order> => {
      return await db.orders.findById(orderId);
    },
    enabled: !!orderId && (options?.enabled ?? true),
  });
}
