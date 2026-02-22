import type { RealtimeChannel } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { db, supabase } from '@/lib/supabase';
import type { Order, OrderItem, OrderWithItems } from '@/types';

export function useOrder(tableId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['order', tableId],
    queryFn: async () => {
      const data = await db.orders.findActiveByTable(tableId);
      return data as OrderWithItems | null;
    },
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
            queryClient.invalidateQueries({ queryKey: ['order', tableId] });
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
            queryClient.invalidateQueries({ queryKey: ['order', tableId] });
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
    mutationFn: async ({ tableId, notes }: { tableId: string; notes?: string }) => {
      const data = await db.orders.create({
        table_id: tableId,
        customer_notes: notes,
        status: 'pending_approval',
        source: 'customer',
        subtotal: 0,
        tax: 0,
        total: 0,
      });
      return data as Order;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['order', variables.tableId] });
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
      queryClient.invalidateQueries({ queryKey: ['order'] });
    },
  });
}
