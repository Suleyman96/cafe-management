import { getOrCreateClientRequestId, QUERY_KEYS } from '@gustri/queries';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeStatus } from '@/hooks/use-order';
import { apiRoutes } from '@/lib/api-routes';
import { isRecentClientRequestId, recordRecentClientRequestId } from '@/lib/realtime-dedup';
import { STALE_TIMES } from '@/lib/stale-times';
import { supabase } from '@/lib/supabase';
import type { DeliveryOrderWithDetails, Order, OrderItem } from '@/types';

export function useDeliveryOrder(orderId: string, accessToken?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [QUERY_KEYS.DELIVERY_ORDER, orderId],
    queryFn: async (): Promise<DeliveryOrderWithDetails | null> => {
      const { data, error } = await (supabase.rpc as Function)('get_delivery_order', {
        p_order_id: orderId,
        p_access_token: accessToken ?? null,
      });
      if (error) throw error;
      if (!data) return null;
      return data as DeliveryOrderWithDetails;
    },
    enabled: !!orderId && !!accessToken,
    // RT4 — mirror dine-in. Realtime + visibility-restore +
    // `refetchOnReconnect: 'always'` (Phase 2 H2) already keep this
    // fresh; the staleTime is just the safety net for when ALL of
    // those fail. 60s matches the global default.
    staleTime: STALE_TIMES.SHORT,
  });

  // H1 / H2 — mirror the dine-in pattern in `useOrder`. Same trade-offs,
  // same banner contract; the delivery surface has identical failure
  // modes (phone sleeps mid-tracking, websocket dies, no UI signal).
  const [rtStatus, setRtStatus] = useState<RealtimeStatus>('CONNECTING');
  const [resubscribeNonce, setResubscribeNonce] = useState(0);
  const orderIdRef = useRef<string>(orderId);
  orderIdRef.current = orderId;
  // RT2 — leading-edge throttle for the visibility-restore handler.
  // Mirrors the dine-in fix in `useOrder`; same iOS App Switcher /
  // rapid background-foreground flip failure mode.
  const lastResubscribeTsRef = useRef<number>(0);

  // Realtime subscription — mirrors the M5 pattern in `use-order.ts` (PR
  // #101): a `useRef` holds the live channel keyed on orderId so dep-
  // array churn or React strict-mode double-invoke in dev doesn't tear
  // down + recreate the channel on every cycle, and the cleanup defers
  // one macrotask so a synchronous remount can cancel the unsubscribe
  // before it fires. Pre-PR this hook had the bare-effect version that
  // PR #101 fixed for dine-in; the audit fresh-pass found the same
  // churn issue lingering on the delivery surface.
  //
  // `event: 'UPDATE'` on the orders subscription (not `'*'`) — the
  // customer's own delivery order INSERT happens via their cart submit,
  // which already invalidates locally; orders are never DELETE-d.
  // Status changes (UPDATE) are the only realtime traffic the customer
  // cares about. `order_items` stays at `'*'` because staff can add
  // items server-side after delivery dispatch (rare but real), and
  // those INSERTs do need to surface to the customer.
  const channelRef = useRef<{ orderId: string; channel: RealtimeChannel } | null>(null);
  const teardownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // P1 — shared debounce timer for both subscriptions; mirrors the
  // dine-in fix in `useOrder`. Same 150ms trailing-edge collapses
  // staff-side bulk-edits to a single refetch.
  const invalidateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!orderId) return;

    if (teardownTimerRef.current !== null) {
      clearTimeout(teardownTimerRef.current);
      teardownTimerRef.current = null;
    }

    if (channelRef.current?.orderId === orderId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current.channel);
      channelRef.current = null;
    }

    setRtStatus('CONNECTING');

    const scheduleInvalidate = () => {
      // RT1 — mirror dine-in. If the local delivery order isn't in
      // cache, skip — there's nothing to refresh, and the populating
      // refetch from the create's `onSuccess` is already queued. See
      // useOrder for the full rationale.
      if (!queryClient.getQueryData([QUERY_KEYS.DELIVERY_ORDER, orderId])) return;
      if (invalidateDebounceRef.current) clearTimeout(invalidateDebounceRef.current);
      invalidateDebounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDER, orderId] });
        invalidateDebounceRef.current = null;
      }, 150);
    };

    const channel: RealtimeChannel = supabase
      .channel(`delivery_order:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          // M5 — mirror the dine-in dedup; same trade-off. Guard
          // `payload?.new` for callback-with-no-args test harnesses.
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
          const crid = (payload?.new as { client_request_id?: string | null } | null | undefined)
            ?.client_request_id;
          if (crid && isRecentClientRequestId(orderId, crid)) return;
          scheduleInvalidate();
        },
      )
      .subscribe((status) => {
        setRtStatus(status as RealtimeStatus);
      });

    channelRef.current = { orderId, channel };
    void resubscribeNonce; // explicit re-run trigger; see useOrder

    return () => {
      teardownTimerRef.current = setTimeout(() => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current.channel);
          channelRef.current = null;
        }
        teardownTimerRef.current = null;
      }, 0);
      if (invalidateDebounceRef.current) {
        clearTimeout(invalidateDebounceRef.current);
        invalidateDebounceRef.current = null;
      }
    };
  }, [orderId, queryClient, resubscribeNonce]);

  // H2 — visibility-restore re-subscribe, same trade-off as useOrder.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (!orderIdRef.current) return;
      // RT2 — leading-edge throttle. See ref decl above.
      const now = Date.now();
      if (now - lastResubscribeTsRef.current < 250) return;
      lastResubscribeTsRef.current = now;
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.DELIVERY_ORDER, orderIdRef.current],
      });
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current.channel);
        channelRef.current = null;
        setRtStatus('CONNECTING');
      }
      setResubscribeNonce((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [queryClient]);

  const refresh = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current.channel);
      channelRef.current = null;
      setRtStatus('CONNECTING');
    }
    setResubscribeNonce((n) => n + 1);
    return query.refetch();
  }, [query.refetch]);

  // Always-on 30 s polling — mirrors the rationale in `useOrder`.
  // Migration 20260517000003 dropped the leaky anon SELECT policy on
  // `orders`, which also stops Supabase Realtime `postgres_changes`
  // events from firing for anon. The realtime channel above still
  // subscribes (so the Reconnecting banner has a status signal), but
  // events no longer reliably deliver. Polling is the primary
  // freshness mechanism. Delivery realtime was *already* silently
  // broken before this migration (delivery orders have `table_id IS
  // NULL` so they failed the prior `USING (table_id IS NOT NULL)`
  // policy), so this is no functional regression — it's just made
  // explicit.
  // Stop polling once the delivery order is terminal (delivered / cancelled /
  // closed) — it can't change again, so a long-lived tracking tab doesn't keep
  // hitting the network every 30 s. Re-runs when the status flips terminal.
  const orderStatus = query.data?.status;
  const isTerminal =
    orderStatus === 'delivered' || orderStatus === 'cancelled' || orderStatus === 'closed';
  useEffect(() => {
    if (!orderId || isTerminal) return;
    const intervalId = setInterval(() => {
      query.refetch();
    }, 30_000);
    return () => clearInterval(intervalId);
  }, [orderId, isTerminal, query.refetch]);

  return { ...query, rtStatus, refresh };
}

type CreateDeliveryOrderVariables = {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNotes: string;
  deliveryFee: number;
  orderNotes?: string;
  qrToken: string;
  client_request_id?: string;
};

export function useCreateDeliveryOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    // `retry: 0` so a network blip doesn't post a duplicate delivery order.
    retry: 0,
    onMutate: (variables: CreateDeliveryOrderVariables) => {
      variables.client_request_id = getOrCreateClientRequestId(variables.client_request_id);
    },
    mutationFn: async (data: CreateDeliveryOrderVariables): Promise<Order> => {
      // Tenant is derived server-side from `qr_token` (C1) — no
      // `tenant_id` in the body. `client_request_id` is required by the
      // server schema (Blocker 1).
      const { order } = await apiRoutes.customerOrders.create({
        order_type: 'delivery',
        qr_token: data.qrToken,
        source: 'customer',
        customer_notes: data.orderNotes,
        delivery_address: data.deliveryAddress,
        delivery_phone: data.customerPhone,
        delivery_customer_name: data.customerName,
        delivery_fee: data.deliveryFee,
        client_request_id: getOrCreateClientRequestId(data.client_request_id),
      });
      return order as Order;
    },
    onSuccess: (order, variables) => {
      // M5 — register so the INSERT echo for this new order dedups.
      if (variables.client_request_id) {
        recordRecentClientRequestId(order.id, variables.client_request_id);
        recordRecentClientRequestId(null, variables.client_request_id);
      }
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDER] });
    },
  });
}

type AddDeliveryOrderItemsVariables = {
  orderId: string;
  items: Array<{
    menu_item_id: string;
    item_name: string;
    item_price: number;
    quantity: number;
    notes?: string;
    client_request_id?: string;
  }>;
  tenantId: string;
};

export function useAddDeliveryOrderItems() {
  const queryClient = useQueryClient();

  return useMutation({
    retry: 0,
    onMutate: (variables: AddDeliveryOrderItemsVariables) => {
      for (const item of variables.items) {
        item.client_request_id = getOrCreateClientRequestId(item.client_request_id);
      }
    },
    mutationFn: async ({
      orderId,
      items,
      tenantId,
    }: AddDeliveryOrderItemsVariables): Promise<OrderItem[]> => {
      const { items: createdItems } = await apiRoutes.customerOrders.addItems(
        orderId,
        items.map((item) => ({
          ...item,
          notes: item.notes ?? null,
          tenant_id: tenantId,
          client_request_id: getOrCreateClientRequestId(item.client_request_id),
        })),
      );
      return createdItems as OrderItem[];
    },
    onSuccess: (_, variables) => {
      // M5 — per-item dedup so the INSERT echo doesn't double-invalidate.
      for (const item of variables.items) {
        if (item.client_request_id) {
          recordRecentClientRequestId(variables.orderId, item.client_request_id);
        }
      }
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDER] });
    },
  });
}
