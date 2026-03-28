import { QUERY_KEYS } from '@gustri/core';
import type { OrderPayment } from '@gustri/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';

export function useOrderPayments(orderId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.PAYMENTS, orderId],
    queryFn: async (): Promise<OrderPayment[]> => {
      return await db.payments.findByOrderId(orderId);
    },
    enabled: !!orderId,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payment: {
      order_id: string;
      amount: number;
      payment_method: OrderPayment['payment_method'];
      received_by?: string;
      payment_type?: OrderPayment['payment_type'];
      tip_amount?: number;
      order_item_ids?: string[] | null;
      notes?: string | null;
    }) => {
      return await db.payments.create({
        ...payment,
        received_by: payment.received_by ?? '',
        payment_type: payment.payment_type ?? 'full',
        tip_amount: payment.tip_amount ?? 0,
        order_item_ids: payment.order_item_ids ?? null,
        notes: payment.notes ?? null,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYMENTS, variables.order_id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, variables.order_id] });
    },
    onError: (error: Error) => {
      console.error('Failed to create payment:', error.message);
    },
  });
}
