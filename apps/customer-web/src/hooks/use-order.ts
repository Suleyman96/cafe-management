import { QUERY_KEYS } from '@gustri/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
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
      return data as unknown as OrderWithItems;
    },
    enabled: !!tableId,
    staleTime: 10 * 1000, // 10s — realtime subscription handles freshness
  });

  const orderId = query.data?.id;

  // Real-time subscription (needs raw supabase client for channel API)
  useEffect(() => {
    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      const builder = supabase.channel(`orders:table_${tableId}`).on(
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
      );

      // Only subscribe to order_items when we have an active order to filter on
      if (orderId) {
        builder.on(
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
        );
      }

      channel = builder.subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [tableId, orderId, queryClient]);

  return query;
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tableId,
      notes,
      tenantId,
    }: {
      tableId: string;
      notes?: string;
      tenantId: string;
    }): Promise<Order> => {
      const { order } = await apiRoutes.customerOrders.create({
        table_id: tableId,
        tenant_id: tenantId,
        order_type: 'dine_in',
        customer_notes: notes,
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
    mutationFn: async ({ orderId, tableId }: { orderId: string; tableId?: string | null }) => {
      return db.orders.cancelOrder(orderId, 'Cancelled by customer', tableId);
    },
    onSuccess: (_, variables) => {
      if (variables.tableId) {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, variables.tableId] });
      } else {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER] });
      }
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
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER] });
    },
  });
}
