import { QUERY_KEYS } from '@gustri/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { notifyNewOrder } from '@/lib/notifications';
import { playNewOrderSound } from '@/lib/sound';
import { db, supabase } from '@/lib/supabase';
import type { Order, OrderItem } from '@/types';

export function useOrders(status?: Order['status'][]) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [QUERY_KEYS.ORDERS, status],
    queryFn: async (): Promise<Order[]> => {
      return await db.orders.findAll(
        status && status.length > 0 ? { status: status[0] } : undefined,
      );
    },
    staleTime: 0,
  });

  // Real-time subscription (needs raw supabase client for channel API)
  useEffect(() => {
    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      channel = supabase
        .channel('orders:all')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
          },
          async (payload) => {
            await playNewOrderSound();

            const newRecord = payload.new as Record<string, unknown>;
            const { data } = await supabase
              .from('tables')
              .select('table_number')
              .eq('id', newRecord.table_id as string)
              .single();

            const tableData = data as { table_number: string } | null;

            if (tableData) {
              await notifyNewOrder(newRecord.order_number as string, tableData.table_number);
            }

            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
          },
          () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
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
  }, [queryClient]);

  return query;
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.ORDER, orderId],
    queryFn: async (): Promise<Order> => {
      return await db.orders.findById(orderId);
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: Order['status'] }) => {
      return await db.orders.updateStatus(orderId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
    },
    onError: (error: Error) => {
      console.error('Failed to update order status:', error.message);
    },
  });
}

export function useUpdateOrderItemStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: OrderItem['status'] }) => {
      return await db.orderItems.updateStatus(itemId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
    },
    onError: (error: Error) => {
      console.error('Failed to update order item status:', error.message);
    },
  });
}

export function useCleanupEmptyOrders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (olderThanMinutes?: number) => db.orders.cleanupEmptyOrders(olderThanMinutes),
    onSuccess: (cancelledIds) => {
      if (cancelledIds.length > 0) {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
      }
    },
  });
}
