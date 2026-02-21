import type { RealtimeChannel } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { notifyNewOrder } from '@/lib/notifications';
import { playNewOrderSound } from '@/lib/sound';
import { supabase } from '@/lib/supabase';
import type { OrderWithDetails } from '@/types';

export function useOrders(status?: string[]) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['orders', status],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          table:tables(table_number, location),
          order_items(*, menu_item:menu_items(*)),
          assigned_waiter:staff(full_name)
        `)
        .order('created_at', { ascending: false });

      if (status && status.length > 0) {
        query = query.in('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as OrderWithDetails[];
    },
    staleTime: 0,
  });

  // Real-time subscription for kitchen/waiter
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
            // Play sound and show notification for new orders
            await playNewOrderSound();

            // Fetch table info for notification
            const { data: tableData } = await supabase
              .from('tables')
              .select('table_number')
              .eq('id', (payload.new as any).table_id)
              .single();

            if (tableData) {
              await notifyNewOrder((payload.new as any).order_number, tableData.table_number);
            }

            // Refetch orders
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
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          table:tables(table_number, location),
          order_items(*, menu_item:menu_items(*)),
          assigned_waiter:staff(full_name)
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data as OrderWithDetails;
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const timestampField = `${status}_at`;
      const updateData: any = { status };

      if (['preparing', 'ready', 'served', 'closed'].includes(status)) {
        updateData[timestampField] = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
      return data;
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
      const { data, error } = await supabase
        .from('order_items')
        .update({ status })
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
