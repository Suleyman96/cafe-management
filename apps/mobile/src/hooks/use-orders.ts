import type { RealtimeChannel } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { notifyNewOrder } from '@/lib/notifications';
import { playNewOrderSound } from '@/lib/sound';
import { db, supabase } from '@/lib/supabase';
import type { OrderWithDetails } from '@/types';

export function useOrders(status?: string[]) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['orders', status],
    queryFn: async () => {
      const data = await db.orders.findAll(
        status && status.length > 0 ? { status: status[0] as any } : undefined,
      );
      return data as OrderWithDetails[];
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

            const { data: tableData } = await supabase
              .from('tables')
              .select('table_number')
              .eq('id', (payload.new as any).table_id)
              .single();

            if (tableData) {
              await notifyNewOrder((payload.new as any).order_number, tableData.table_number);
            }

            queryClient.invalidateQueries({ queryKey: ['orders'] });
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
            queryClient.invalidateQueries({ queryKey: ['orders'] });
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
    queryKey: ['order', orderId],
    queryFn: async () => {
      const data = await db.orders.findById(orderId);
      return data as OrderWithDetails;
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return await db.orders.updateStatus(orderId, status as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useUpdateOrderItemStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
      return await db.orderItems.updateStatus(itemId, status as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
