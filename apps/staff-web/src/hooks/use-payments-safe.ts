/**
 * Type-Safe Payment Hooks
 * Uses the wrapped client for type safety without 'as any'
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';
import { QUERY_KEYS } from '@cafe-idare/core';
import type { Database } from '@cafe-idare/database';

type PaymentInsert = Database['public']['Tables']['order_payments']['Insert'];
type Payment = Database['public']['Tables']['order_payments']['Row'];

export function useOrderPayments(orderId: string) {
  return useQuery({
    queryKey: ['order_payments', orderId],
    queryFn: () => db.payments.findByOrderId(orderId),
    enabled: !!orderId,
  });
}

export function useOrderRemainingBalance(orderId: string) {
  return useQuery({
    queryKey: ['order_remaining_balance', orderId],
    queryFn: () => db.rpc.getRemainingBalance(orderId),
    enabled: !!orderId,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payment: PaymentInsert) => db.payments.create(payment),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS, variables.order_id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, variables.order_id] });
      queryClient.invalidateQueries({ queryKey: ['order_payments', variables.order_id] });
      queryClient.invalidateQueries({ queryKey: ['order_payment_summary', variables.order_id] });
      queryClient.invalidateQueries({ queryKey: ['order_remaining_balance', variables.order_id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
    },
  });
}

// Payment summary helper
export function usePaymentSummary(orderId: string) {
  const { data: payments, ...rest } = useOrderPayments(orderId);
  const { data: remainingBalance } = useOrderRemainingBalance(orderId);

  const summary = payments?.reduce(
    (acc: { total: number; count: number; byMethod: Record<string, number> }, payment: Payment) => {
      acc.total += payment.amount;
      acc.count += 1;
      if (payment.payment_method) {
        acc.byMethod[payment.payment_method] = 
          (acc.byMethod[payment.payment_method] || 0) + payment.amount;
      }
      return acc;
    },
    { 
      total: 0, 
      count: 0, 
      byMethod: {} as Record<string, number> 
    }
  );

  return {
    ...rest,
    data: {
      payments: payments || [],
      summary: summary || { total: 0, count: 0, byMethod: {} },
      remainingBalance: remainingBalance || 0
    }
  };
}

// Helper for formatting payment methods
export function formatPaymentMethod(method: string): string {
  const methods: Record<string, string> = {
    cash: 'Cash',
    card: 'Credit/Debit Card',
    digital: 'Digital Payment'
  };
  return methods[method] || method;
}