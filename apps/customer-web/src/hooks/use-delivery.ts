import { QUERY_KEYS } from '@gustri/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiRoutes } from '@/lib/api-routes';
import { supabase } from '@/lib/supabase';
import type { DeliveryOrderWithDetails, Order, OrderItem } from '@/types';

export function useDeliveryOrder(orderId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [QUERY_KEYS.DELIVERY_ORDER, orderId],
    queryFn: async (): Promise<DeliveryOrderWithDetails | null> => {
      const { data, error } = await (supabase.rpc as Function)('get_delivery_order', {
        p_order_id: orderId,
      });
      if (error) throw error;
      if (!data) return null;
      return data as unknown as DeliveryOrderWithDetails;
    },
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
    }): Promise<Order> => {
      const { order } = await apiRoutes.customerOrders.create({
        table_id: null,
        tenant_id: data.tenantId,
        order_type: 'delivery',
        source: 'customer',
        customer_notes: data.orderNotes,
        delivery_address: data.deliveryAddress,
        delivery_phone: data.customerPhone,
        delivery_customer_name: data.customerName,
        delivery_fee: data.deliveryFee,
      });
      return order as Order;
    },
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
    }): Promise<OrderItem[]> => {
      const { items: createdItems } = await apiRoutes.customerOrders.addItems(
        orderId,
        items.map((item) => ({
          ...item,
          notes: item.notes ?? null,
          tenant_id: tenantId,
        })),
      );
      return createdItems as OrderItem[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDER] });
    },
  });
}
