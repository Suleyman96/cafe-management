import { getOrCreateClientRequestId, QUERY_KEYS } from '@gustri/queries';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { apiRoutes } from '@/lib/api-routes';
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
    staleTime: 10 * 1000, // 10s — realtime subscription handles freshness
  });

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
        () => {
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDER, orderId] });
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
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDER, orderId] });
        },
      )
      .subscribe();

    channelRef.current = { orderId, channel };

    return () => {
      teardownTimerRef.current = setTimeout(() => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current.channel);
          channelRef.current = null;
        }
        teardownTimerRef.current = null;
      }, 0);
    };
  }, [orderId, queryClient]);

  return query;
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
    onSuccess: () => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDER] });
    },
  });
}
