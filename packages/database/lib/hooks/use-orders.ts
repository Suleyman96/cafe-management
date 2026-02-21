import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Order, OrderStatus, OrderWithItems } from '../../types';
import { getSupabaseClient } from '../supabase';

export function useOrders() {
  return useQuery<OrderWithItems[], Error>({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('orders')
        .select(`
          *,
          table:tables(*),
          staff(*),
          order_items(
            *,
            menu_item:menu_items(*)
          ),
          order_payments(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}

export function useOrder(orderId: string) {
  return useQuery<OrderWithItems, Error>({
    queryKey: ['orders', orderId],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('orders')
        .select(`
          *,
          table:tables(*),
          staff(*),
          order_items(
            *,
            menu_item:menu_items(*)
          ),
          order_payments(*),
          table_transfers(
            *,
            from_table:tables!table_transfers_from_table_id_fkey(*),
            to_table:tables!table_transfers_to_table_id_fkey(*)
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      const { data, error } = await getSupabaseClient()
        .from('orders')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders', data.id] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderData: Partial<Order>) => {
      const { data, error } = await getSupabaseClient()
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });
}
