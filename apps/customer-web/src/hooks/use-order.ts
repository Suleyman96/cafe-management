import { QUERY_KEYS } from '@cafe-idare/core';
import type { OrdersInsert } from '@cafe-idare/database';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { db, supabase } from '@/lib/supabase';
import type { Order, OrderItem, OrderWithItems } from '@/types';

export function useOrder(tableId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [QUERY_KEYS.ORDER, tableId],
    queryFn: async (): Promise<OrderWithItems | null> => db.orders.findActiveByTable(tableId),
    enabled: !!tableId,
    staleTime: 0,
  });

  // Real-time subscription (needs raw supabase client for channel API)
  useEffect(() => {
    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      channel = supabase
        .channel(`orders:table_${tableId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `table_id=eq.${tableId}`,
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
          },
          () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, tableId] });
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
  }, [tableId, queryClient]);

  return query;
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tableId, notes }: { tableId: string; notes?: string }): Promise<Order> =>
      db.orders.create({
        table_id: tableId,
        customer_notes: notes,
        status: 'pending_approval',
        source: 'customer',
        subtotal: 0,
        tax: 0,
        total: 0,
      } as Partial<OrdersInsert> as OrdersInsert),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, variables.tableId] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, tableId }: { orderId: string; tableId?: string | null }) => {
      return db.orders.cancelOrder(orderId, 'Cancelled by customer', tableId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER] });
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

export function useAddOrderItems() {
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
    }): Promise<OrderItem[]> =>
      db.orderItems.create(
        items.map((item) => ({
          order_id: orderId,
          ...item,
          notes: item.notes ?? null,
          status: 'pending' as const,
        })),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER] });
    },
  });
}
