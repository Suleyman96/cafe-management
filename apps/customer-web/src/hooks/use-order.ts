import { getOrCreateClientRequestId, QUERY_KEYS } from '@gustri/queries';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRoutes } from '@/lib/api-routes';
import { isRecentClientRequestId, recordRecentClientRequestId } from '@/lib/realtime-dedup';
import { STALE_TIMES } from '@/lib/stale-times';
import { supabase } from '@/lib/supabase';
import type { Order, OrderItem, OrderWithItems } from '@/types';

// H1 — realtime channel status surfaced to the UI. `CONNECTING` is the
// startup state before `.subscribe()` reports back; we don't show a
// banner during that window because every fresh mount would flash one.
// The banner is only meaningful when paired with stale `query.data`
// (see consumers).
export type RealtimeStatus = 'CONNECTING' | 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';

export function useOrder(tableId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [QUERY_KEYS.ORDER, tableId],
    queryFn: async (): Promise<OrderWithItems | null> => {
      const { data, error } = await (supabase.rpc as Function)('get_active_order_for_table', {
        p_table_id: tableId,
      });
      if (error) throw error;
      if (!data) return null;
      // RPC returns JSONB matching OrderWithItems shape
      return data as OrderWithItems;
    },
    enabled: !!tableId,
    // RT4 — realtime + visibility-restore + `refetchOnReconnect: 'always'`
    // already keep the cache fresh; the staleTime is only the safety net
    // for when ALL of those fail. 60s matches the global default and
    // cuts ~3× refetches/min on flaky phone networks without any
    // user-visible regression.
    staleTime: STALE_TIMES.SHORT,
  });

  const orderId = query.data?.id;
  const [rtStatus, setRtStatus] = useState<RealtimeStatus>('CONNECTING');
  // H2 — incrementing this bumps the subscribe effect to re-run *without*
  // changing the channel's identity key (orderId). Used by the visibility
  // listener to force a fresh SUBSCRIBE after a phone sleep without
  // doing so on every keystroke.
  const [resubscribeNonce, setResubscribeNonce] = useState(0);

  // Real-time subscription (needs raw supabase client for channel API).
  //
  // Filtered by `id=eq.${orderId}`, NOT `table_id=eq.${tableId}`. A broader
  // table-keyed filter would also broadcast events for *other* customers
  // who shared this physical table earlier or later in the day — at a busy
  // bar table that's 5+ short sessions per hour, each one's totals,
  // statuses and customer_notes leak into every other tab still open on
  // that tableId. Customer-initiated mutations already call
  // `queryClient.invalidateQueries` on success, so the realtime path is
  // only here to surface staff-side updates to *this* order; we don't need
  // to listen for anyone else's. No channel is opened until the active
  // order id resolves — there is nothing useful to subscribe to before
  // that.
  //
  // M5 — useRef dedupe + deferred teardown so rapid mount/unmount cycles
  // (React strict-mode double-invoke in dev, fast back/forward navigation,
  // or any spurious dep-array re-evaluation) don't churn channels. Without
  // this, every cycle does a SUBSCRIBE/UNSUBSCRIBE round-trip to the
  // realtime server and momentarily drops live updates. The dedupe makes
  // the effect a no-op when re-run with an unchanged orderId; the deferred
  // teardown lets a synchronous remount cancel a pending unsubscribe before
  // it fires.
  const channelRef = useRef<{ orderId: string; channel: RealtimeChannel } | null>(null);
  const teardownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // P1 — single shared debounce timer for both the orders + order_items
  // subscriptions. Staff bulk-edits (10 status changes in ~1s) fanned
  // out into 10 invalidations + 10 refetches pre-fix; 150ms trailing
  // edge collapses the storm to one refetch ~150ms after the last
  // event. Imperceptible to the user, kind to a phone on weak signal.
  const invalidateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // H2 — invalidation also runs on visibility-restore and reconnect. Hold
  // a ref to the latest `orderId` so the visibility listener (registered
  // once per tableId) can recreate the channel without resubscribing the
  // listener on every orderId change.
  const orderIdRef = useRef<string | undefined>(orderId);
  orderIdRef.current = orderId;
  // RT2 — leading-edge throttle for the visibility-restore handler. iOS
  // App Switcher and rapid Android task-list flips can fire three
  // `visibilitychange` events in <500 ms; without this, each one
  // synchronously tears down + reopens the channel, the cleanup timers
  // stack, and the `channelRef.current?.orderId === orderId` early-return
  // inside the subscribe effect can skip a reopen that should have
  // happened. 250 ms is long enough to collapse a flip storm but short
  // enough that a deliberate background → foreground transition still
  // refreshes.
  const lastResubscribeTsRef = useRef<number>(0);

  useEffect(() => {
    if (!orderId) return;

    // Cancel any pending teardown — strict-mode remount or fast-nav back.
    if (teardownTimerRef.current !== null) {
      clearTimeout(teardownTimerRef.current);
      teardownTimerRef.current = null;
    }

    // Live channel already covers this orderId? Reuse it.
    if (channelRef.current?.orderId === orderId) return;

    // Different orderId — synchronous teardown of the stale channel before
    // opening a new one. (If the prior cleanup already deferred a teardown,
    // we just cancelled its timer above; doing the teardown here keeps the
    // ordering deterministic.)
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current.channel);
      channelRef.current = null;
    }

    // Reset transient status while a new channel is coming up so the UI
    // banner has the right signal during the gap.
    setRtStatus('CONNECTING');

    const scheduleInvalidate = () => {
      // RT1 — if the local order isn't in cache, there's nothing to
      // refresh. This guards a real race: the customer's create
      // mutation resolves → channel opens for `order:${orderId}` → a
      // staff-side `order_items` echo fires BEFORE the order-level
      // refetch lands the order row. Invalidating against an empty
      // cache would just kick off another refetch into the same race;
      // skipping is correct because the create's own `onSuccess`
      // invalidate already queued the populating fetch.
      if (!queryClient.getQueryData([QUERY_KEYS.ORDER, tableId])) return;
      if (invalidateDebounceRef.current) clearTimeout(invalidateDebounceRef.current);
      invalidateDebounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, tableId] });
        invalidateDebounceRef.current = null;
      }, 150);
    };

    // `event: 'UPDATE'` on the orders subscription, `'*'` on order_items.
    // The customer's own order INSERT is a single event they themselves
    // triggered (already invalidated locally); orders are never DELETE-d.
    // Only status UPDATEs (pending_approval → new → preparing → … →
    // closed) are realtime traffic the customer cares about. order_items
    // stays at `'*'` because waiter-added items (staff-side INSERT) are
    // a real flow that the customer should see.
    const channel: RealtimeChannel = supabase
      .channel(`order:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          // M5 — skip the echo of the customer's own write. The mutation
          // hook already invalidated in `onSuccess`; this event arrives
          // ~200ms later and would trigger a redundant refetch + UI
          // flicker. Staff-driven updates (status changes) carry no
          // matching `client_request_id`, so they fall through. Guard
          // `payload?.new` because test harnesses invoke the callback
          // with no args.
          const crid = (payload?.new as { client_request_id?: string | null } | null | undefined)
            ?.client_request_id;
          if (crid && isRecentClientRequestId(orderId, crid)) return;
          scheduleInvalidate();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          // Same dedup for per-item INSERT/UPDATE. Waiter-side adds
          // (no `client_request_id`) still surface to the customer.
          const crid = (payload?.new as { client_request_id?: string | null } | null | undefined)
            ?.client_request_id;
          if (crid && isRecentClientRequestId(orderId, crid)) return;
          scheduleInvalidate();
        },
      )
      .subscribe((status) => {
        // H1 — surface subscription transitions so the consumer can show
        // a "Reconnecting…" banner when paired with stale data. Supabase
        // realtime emits these strings verbatim; we trust them rather
        // than re-mapping per-state.
        setRtStatus(status as RealtimeStatus);
      });

    channelRef.current = { orderId, channel };
    // `resubscribeNonce` is the explicit re-run trigger — read it once so
    // the linter sees it consumed inside the effect, since Supabase's
    // `.subscribe()` is fire-and-forget and the value would otherwise
    // appear unused.
    void resubscribeNonce;

    return () => {
      // Defer teardown one macrotask so a synchronous remount (strict-mode
      // double-invoke in dev, or a Suspense bail-out re-mount) can cancel
      // it via the timer-clear at the top of this effect. On a real
      // unmount the timer fires uncontested and the channel is removed.
      teardownTimerRef.current = setTimeout(() => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current.channel);
          channelRef.current = null;
        }
        teardownTimerRef.current = null;
      }, 0);
      // Cancel any pending debounced invalidate — its query key references
      // `tableId`, which won't change here, but a fresh effect-run will
      // schedule its own.
      if (invalidateDebounceRef.current) {
        clearTimeout(invalidateDebounceRef.current);
        invalidateDebounceRef.current = null;
      }
    };
    // `resubscribeNonce` is in the deps so a visibility-restore forced
    // bump re-runs this effect even when orderId/tableId are unchanged.
  }, [orderId, tableId, queryClient, resubscribeNonce]);

  // H2 — when the tab becomes visible after a sleep/lock the one-shot
  // `refetchOnWindowFocus` covers the data, but the realtime channel
  // can be in a stale `TIMED_OUT`/`CLOSED` state with no auto-recovery.
  // Tear the channel down synchronously and force the subscribe effect
  // to re-run by clearing the ref — every visibility-restore costs one
  // RPC + one SUBSCRIBE round-trip, which is the right trade-off vs
  // staring at a frozen status screen for arbitrary minutes.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (!orderIdRef.current) return;
      // RT2 — collapse rapid visibility flips. See ref decl above.
      const now = Date.now();
      if (now - lastResubscribeTsRef.current < 250) return;
      lastResubscribeTsRef.current = now;
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, tableId] });
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current.channel);
        channelRef.current = null;
        setRtStatus('CONNECTING');
      }
      // Bumping the nonce re-fires the subscribe effect even when
      // orderId/tableId are unchanged, recreating the channel against
      // a fresh websocket. Intentionally synchronous teardown above —
      // a deferred unsubscribe would race with the new subscribe.
      setResubscribeNonce((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [tableId, queryClient]);

  // Manual refresh handle for the "Reconnecting" banner CTA.
  const refresh = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current.channel);
      channelRef.current = null;
      setRtStatus('CONNECTING');
    }
    setResubscribeNonce((n) => n + 1);
    return query.refetch();
  }, [query.refetch]);

  // Polling is the primary freshness mechanism for the customer-web
  // (anon) order surface. Migration 20260517000003 closed the
  // cross-tenant enumeration leak on `orders` by removing the anon
  // SELECT policy entirely — anon HTTP reads now go through the
  // `get_active_order_for_table` SECURITY DEFINER RPC. As a side effect,
  // Supabase Realtime `postgres_changes` events for anon also stop
  // firing (they evaluate the SELECT policy per-row). The realtime
  // channel above still subscribes (cheap, instrumentation surface for
  // the Reconnecting banner), but events no longer reliably deliver.
  //
  // So the original H1 60 s-gated fallback becomes always-on: refetch
  // every 30 s for the lifetime of the order subscription. Acceptable
  // staffing freshness for kitchen status changes, and the customer's
  // own mutations still invalidate the cache instantly via the mutation
  // hook's `onSuccess`. If the realtime path is ever restored (e.g. via
  // per-customer JWT auth), this can revert to a gated fallback.
  useEffect(() => {
    if (!orderId) return;
    const intervalId = setInterval(() => {
      query.refetch();
    }, 30_000);
    return () => clearInterval(intervalId);
  }, [orderId, query.refetch]);

  return { ...query, rtStatus, refresh };
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    // `retry: 0` so a network blip doesn't post a second kitchen ticket.
    // The server still dedupes via `client_request_id` if a user-driven
    // retry happens.
    retry: 0,
    onMutate: (variables: { tableId: string; notes?: string; client_request_id?: string }) => {
      // Safety net: mint an id if the caller didn't pass one. The
      // dedupe contract is *the caller* holding a stable id across
      // user-driven retries (see `useStableClientRequestId`); `retry: 0`
      // disables auto-retry, so this fallback only fires when the
      // caller forgot to stamp.
      variables.client_request_id = getOrCreateClientRequestId(variables.client_request_id);
    },
    mutationFn: async ({
      tableId,
      notes,
      client_request_id,
    }: {
      tableId: string;
      notes?: string;
      client_request_id?: string;
    }): Promise<Order> => {
      // Tenant is derived server-side from `table_id` (C1) — no
      // `tenant_id` in the body. `client_request_id` is required by the
      // server schema (Blocker 1).
      const { order } = await apiRoutes.customerOrders.create({
        order_type: 'dine_in',
        table_id: tableId,
        customer_notes: notes,
        client_request_id: getOrCreateClientRequestId(client_request_id),
      });
      return order as Order;
    },
    onSuccess: (order, variables) => {
      // M5 — register the freshly-persisted `client_request_id` so the
      // realtime echo for *this* INSERT doesn't re-trigger an
      // invalidate after we already did it locally. The id is recorded
      // against both the new orderId AND the global bucket — the
      // INSERT echo's payload key matches the new order's id, but the
      // dedup lookup happens inside `useOrder`'s subscription which
      // was opened for the same orderId.
      const crid = (variables as { client_request_id?: string }).client_request_id;
      if (crid) {
        recordRecentClientRequestId(order.id, crid);
        recordRecentClientRequestId(null, crid);
      }
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, variables.tableId] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    // M6: cancellation now goes through `/api/v1/customer/orders/[id]/cancel`
    // so the staff-web edge limiter and the table-id-match check apply.
    // `tableId` is required (not optional like the wrapper version), so the
    // server can verify the cancel is happening from the same table the
    // order was placed at.
    mutationFn: async ({ orderId, tableId }: { orderId: string; tableId: string }) => {
      const { order } = await apiRoutes.customerOrders.cancel(orderId, {
        table_id: tableId,
        reason: 'Cancelled by customer',
      });
      return order;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, variables.tableId] });
    },
  });
}

export function useCancelOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    // C3 — route through `/api/v1/customer/orders/[id]/items/[itemId]/cancel`
    // instead of `db.orderItems.cancel()`. The wrapper version is
    // staff-only on the partial path (the `cancel_order_item_qty`
    // RPC gates on `auth.uid()` → active staff), so the customer-side
    // partial cancel never worked through it; the new route uses the
    // service-role admin client to do the atomic update. Routing
    // through the API also brings the Upstash edge limiter and the
    // M6 `table_id`-match check to parity with the order-level cancel.
    mutationFn: async ({
      orderId,
      itemId,
      tableId,
      cancelQty,
    }: {
      orderId: string;
      itemId: string;
      tableId: string;
      cancelQty?: number;
    }) => {
      const { item } = await apiRoutes.customerOrders.cancelItem(orderId, itemId, {
        table_id: tableId,
        cancel_qty: cancelQty ?? null,
      });
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER] });
    },
  });
}

type AddOrderItemsVariables = {
  orderId: string;
  items: Array<{
    menu_item_id: string;
    item_name: string;
    item_price: number;
    quantity: number;
    notes?: string;
    client_request_id?: string;
    selected_options?: Array<{ option_id: string; value_id: string }>;
  }>;
  tenantId: string;
  /** Dine-in table id — sent so the server can assert it matches the order's
   *  table (M6/IDOR). Dine-in callers always pass it. */
  tableId: string;
};

export function useAddOrderItems() {
  const queryClient = useQueryClient();

  return useMutation({
    // `retry: 0` — items are inserted with a per-row unique index on
    // `(tenant_id, client_request_id)`. The hook stamps each item's id
    // exactly once so a user-driven retry dedupes server-side.
    retry: 0,
    onMutate: (variables: AddOrderItemsVariables) => {
      for (const item of variables.items) {
        item.client_request_id = getOrCreateClientRequestId(item.client_request_id);
      }
    },
    mutationFn: async ({
      orderId,
      items,
      tenantId,
      tableId,
    }: AddOrderItemsVariables): Promise<OrderItem[]> => {
      const { items: createdItems } = await apiRoutes.customerOrders.addItems(
        orderId,
        items.map((item) => ({
          ...item,
          notes: item.notes ?? null,
          tenant_id: tenantId,
          client_request_id: getOrCreateClientRequestId(item.client_request_id),
        })),
        tableId,
      );
      return createdItems as OrderItem[];
    },
    onSuccess: (_, variables) => {
      // M5 — register each per-item `client_request_id` so the order_items
      // INSERT echoes dedup. Each item is its own realtime event.
      for (const item of variables.items) {
        if (item.client_request_id) {
          recordRecentClientRequestId(variables.orderId, item.client_request_id);
        }
      }
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER] });
    },
  });
}
