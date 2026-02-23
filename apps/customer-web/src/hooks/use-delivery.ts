import type { RealtimeChannel } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { db, supabase } from '@/lib/supabase';
import type { Order, OrderItem, OrderWithItems } from '@/types';

export function useDeliveryOrder(orderId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['delivery_order', orderId],
    queryFn: async () => {
      const data = await db.orders.findDeliveryById(orderId);
      return data as (OrderWithItems & { delivery_person?: { full_name: string } }) | null;
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
            queryClient.invalidateQueries({ queryKey: ['delivery_order', orderId] });
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
            queryClient.invalidateQueries({ queryKey: ['delivery_order', orderId] });
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
    }) => {
      const order = await db.orders.create({
        table_id: null,
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
      });
      return order as Order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery_order'] });
    },
  });
}

export function useAddDeliveryOrderItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      items,
    }: {
      orderId: string;
      items: Array<{
        menu_item_id: string;
        item_name: string;
        item_price: number;
        quantity: number;
        notes?: string;
      }>;
    }) => {
      const data = await db.orderItems.create(
        items.map((item) => ({
          order_id: orderId,
          ...item,
          status: 'pending',
        })),
      );
      return data as OrderItem[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery_order'] });
    },
  });
}
