import { QUERY_KEYS } from '@gustri/core';
import type { Order, OrderItem } from '@gustri/database';
import { useDb } from '@gustri/queries';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { notifyNewOrder } from '@/lib/notifications';
import { playNewOrderSound } from '@/lib/sound';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import type { OrderWithDetails } from '@/types';

// Re-export read hooks and mutations with matching param shapes
export { useCleanupEmptyOrders } from '@gustri/queries';

// Local mutations — mobile consumers use { orderId } / { itemId } instead of { id }

export function useUpdateOrderStatus() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: Order['status'] }) =>
      db.orders.updateStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
    },
  });
}

export function useUpdateOrderItemStatus() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: OrderItem['status'] }) =>
      db.orderItems.updateStatus(itemId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
    },
  });
}

// Read hooks with realtime subscriptions — kept local

export function useOrders(filters?: {
  status?: Order['status'];
  statuses?: Order['status'][];
  assigned_waiter_id?: string;
  created_after?: string;
  created_before?: string;
  limit?: number;
}) {
  const queryClient = useQueryClient();
  const tenantId = useAuthStore((s) => s.staff?.tenant_id);
  const db = useDb();

  const query = useQuery({
    queryKey: [QUERY_KEYS.ORDERS, filters],
    queryFn: async (): Promise<OrderWithDetails[]> => db.orders.findAll(filters || undefined),
    staleTime: 0,
  });

  // Real-time subscription (needs raw supabase client for channel API)
  useEffect(() => {
    if (!tenantId) return;
    let channel: RealtimeChannel;

    const tenantFilter = `tenant_id=eq.${tenantId}`;

    const setupSubscription = async () => {
      channel = supabase
        .channel('orders:all')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
            filter: tenantFilter,
          },
          async (payload) => {
            await playNewOrderSound();

            const newRecord = payload.new as Record<string, unknown>;

            if (newRecord.table_id) {
              const { data } = await supabase
                .from('tables')
                .select('table_number')
                .eq('id', newRecord.table_id as string)
                .single();

              const tableData = data as { table_number: string } | null;

              if (tableData) {
                await notifyNewOrder(newRecord.order_number as string, tableData.table_number);
              }
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
            filter: tenantFilter,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'order_items',
            filter: tenantFilter,
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
  }, [queryClient, tenantId]);

  return query;
}

export function useOrder(orderId: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.ORDER, orderId],
    queryFn: async (): Promise<Order> => {
      return await db.orders.findById(orderId);
    },
  });
}
