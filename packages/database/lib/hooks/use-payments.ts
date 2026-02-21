/**
 * Payment Management Hooks
 * Shared across staff-web and mobile-app
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OrderPaymentWithStaff } from '../../types';
import { getSupabaseClient } from '../supabase';

// ========================================
// Query: Get payments for an order
// ========================================

export function useOrderPayments(orderId: string) {
  return useQuery({
    queryKey: ['order_payments', orderId],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('order_payments')
        .select(`
          *,
          received_by_staff:staff!received_by(full_name, role)
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as OrderPaymentWithStaff[];
    },
    enabled: !!orderId,
  });
}

// ========================================
// Query: Get payment summary for an order
// ========================================

export function useOrderPaymentSummary(orderId: string) {
  return useQuery({
    queryKey: ['order_payment_summary', orderId],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('order_payment_summary')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });
}

// ========================================
// Query: Get remaining balance for an order
// ========================================

export function useOrderRemainingBalance(orderId: string) {
  return useQuery({
    queryKey: ['order_remaining_balance', orderId],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('get_order_remaining_balance', {
        order_uuid: orderId,
      });

      if (error) throw error;
      return data as number;
    },
    enabled: !!orderId,
  });
}

// ========================================
// Mutation: Create payment
// ========================================

interface CreatePaymentData {
  order_id: string;
  received_by: string;
  payment_type: 'full' | 'partial_amount' | 'specific_items';
  amount: number;
  payment_method: 'cash' | 'card' | 'digital';
  order_item_ids?: string[];
  notes?: string;
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payment: CreatePaymentData) => {
      const { data, error } = await getSupabaseClient()
        .from('order_payments')
        .insert(payment)
        .select(`
          *,
          received_by_staff:staff!received_by(full_name, role)
        `)
        .single();

      if (error) throw error;
      return data as OrderPaymentWithStaff;
    },
    onSuccess: (_, variables) => {
      // Invalidate order queries
      queryClient.invalidateQueries({
        queryKey: ['orders', variables.order_id],
      });
      queryClient.invalidateQueries({
        queryKey: ['order', variables.order_id],
      });

      // Invalidate payment queries
      queryClient.invalidateQueries({
        queryKey: ['order_payments', variables.order_id],
      });
      queryClient.invalidateQueries({
        queryKey: ['order_payment_summary', variables.order_id],
      });
      queryClient.invalidateQueries({
        queryKey: ['order_remaining_balance', variables.order_id],
      });

      // Invalidate order lists
      queryClient.invalidateQueries({
        queryKey: ['orders'],
      });
    },
  });
}

// ========================================
// Mutation: Delete payment (admin only)
// ========================================

export function useDeletePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ paymentId, orderId }: { paymentId: string; orderId: string }) => {
      const { error } = await getSupabaseClient()
        .from('order_payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;
      return { paymentId, orderId };
    },
    onSuccess: (data) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({
        queryKey: ['orders', data.orderId],
      });
      queryClient.invalidateQueries({
        queryKey: ['order_payments', data.orderId],
      });
      queryClient.invalidateQueries({
        queryKey: ['order_payment_summary', data.orderId],
      });
      queryClient.invalidateQueries({
        queryKey: ['order_remaining_balance', data.orderId],
      });
      queryClient.invalidateQueries({
        queryKey: ['orders'],
      });
    },
  });
}

// ========================================
// Helper: Calculate item-specific payment amount
// ========================================

export function calculateItemsTotal(
  orderItems: Array<{ id: string; item_price: number; quantity: number }>,
  selectedItemIds: string[],
): number {
  return orderItems
    .filter((item) => selectedItemIds.includes(item.id))
    .reduce((total, item) => total + item.item_price * item.quantity, 0);
}
