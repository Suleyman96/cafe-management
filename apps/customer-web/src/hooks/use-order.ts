import { getOrCreateClientRequestId, QUERY_KEYS } from '@gustri/queries';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { apiRoutes } from '@/lib/api-routes';
import { db, supabase } from '@/lib/supabase';
import type { Order, OrderItem, OrderWithItems } from '@/types';

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
    staleTime: 10 * 1000, // 10s — realtime subscription handles freshness
  });

  const orderId = query.data?.id;

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
        () => {
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, tableId] });
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
        () => {
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, tableId] });
        },
      )
      .subscribe();

    channelRef.current = { orderId, channel };

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
    };
  }, [orderId, tableId, queryClient]);

  return query;
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    // `retry: 0` so a network blip doesn't post a second kitchen ticket.
    // The server still dedupes via `client_request_id` if a user-driven
    // retry happens.
    retry: 0,
    onMutate: (variables: { tableId: string; notes?: string; client_request_id?: string }) => {
      // Stamp once per logical user action; React Query reuses the same
      // variables object across retries, so the id stays stable.
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
    onSuccess: (_, variables) => {
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
    mutationFn: async ({ itemId, cancelQty }: { itemId: string; cancelQty?: number }) => {
      return db.orderItems.cancel(itemId, cancelQty);
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
  }>;
  tenantId: string;
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
    }: AddOrderItemsVariables): Promise<OrderItem[]> => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER] });
    },
  });
}
