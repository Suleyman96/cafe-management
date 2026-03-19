import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderData: {
      table_id?: string;
      order_type?: 'dine_in' | 'delivery' | 'takeaway';
      status?: string;
      assigned_waiter_id?: string;
      customer_notes?: string;
    }) => {
      return await db.orders.create(orderData as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });
}

export function useAddOrderItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      items: Array<{
        order_id: string;
        menu_item_id: string;
        quantity: number;
        unit_price?: number;
        total_price?: number;
        status?: string;
        notes?: string | null;
      }>,
    ) => {
      return await db.orderItems.create(items as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
