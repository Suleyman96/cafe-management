import { QUERY_KEYS } from '@gustri/core';
import type { OrdersInsert } from '@gustri/database';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { db, supabase } from '@/lib/supabase';
import type { DeliveryOrderWithDetails, Order, OrderItem } from '@/types';

export function useDeliveryOrder(orderId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [QUERY_KEYS.DELIVERY_ORDER, orderId],
    queryFn: async (): Promise<DeliveryOrderWithDetails | null> =>
      db.orders.findDeliveryById(orderId) as Promise<DeliveryOrderWithDetails | null>,
    enabled: !!orderId,
    staleTime: 0,
  });

  // Real-time subscription by order ID
  useEffect(() => {
    if (!orderId) return;

    let channel: RealtimeChannel;

    const setupSubscription = () => {
      channel = supabase
        .channel(`delivery_order:${orderId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
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
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [orderId, queryClient]);

  return query;
}

export function useCreateDeliveryOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      customerName: string;
      customerPhone: string;
      deliveryAddress: string;
      deliveryNotes: string;
      deliveryFee: number;
      orderNotes?: string;
      tenantId: string;
    }): Promise<Order> =>
      db.orders.create({
        table_id: null,
        tenant_id: data.tenantId,
        order_type: 'delivery',
        source: 'customer',
        status: 'pending_approval',
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        delivery_address: data.deliveryAddress,
        delivery_notes: data.deliveryNotes || null,
        delivery_fee: data.deliveryFee,
        customer_notes: data.orderNotes || null,
        subtotal: 0,
        tax: 0,
        total: 0,
      } as Partial<OrdersInsert> as OrdersInsert),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDER] });
    },
  });
}

export function useAddDeliveryOrderItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      items,
      tenantId,
    }: {
      orderId: string;
      items: Array<{
        menu_item_id: string;
        item_name: string;
        item_price: number;
        quantity: number;
        notes?: string;
      }>;
      tenantId: string;
    }): Promise<OrderItem[]> =>
      db.orderItems.create(
        items.map((item) => ({
          order_id: orderId,
          tenant_id: tenantId,
          ...item,
          notes: item.notes ?? null,
          status: 'pending' as const,
        })),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDER] });
    },
  });
}
