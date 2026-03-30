/**
 * Type-Safe Payment Hooks
 * Uses the wrapped client for type safety without 'as any'
 */

import { QUERY_KEYS } from '@gustri/core';
import type { Database } from '@gustri/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';

type PaymentInsert = Database['public']['Tables']['order_payments']['Insert'];
type Payment = Database['public']['Tables']['order_payments']['Row'];

export function usePaymentsByStaff(staffId: string, limit = 5) {
  return useQuery({
    queryKey: [QUERY_KEYS.PAYMENTS_BY_STAFF, staffId, limit],
    queryFn: async (): Promise<Payment[]> => db.payments.findByReceivedBy(staffId, limit),
    enabled: !!staffId,
  });
}

export function useOrderPayments(orderId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.PAYMENTS, orderId],
    queryFn: async (): Promise<Payment[]> => db.payments.findByOrderId(orderId),
    enabled: !!orderId,
  });
}

export function useOrderRemainingBalance(orderId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.PAYMENTS, 'remaining_balance', orderId],
    queryFn: async (): Promise<number> => db.rpc.getRemainingBalance(orderId),
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
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYMENTS, variables.order_id] });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.PAYMENTS, 'remaining_balance', variables.order_id],
      });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYMENTS_BY_STAFF] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
    },
  });
}

// Payment summary helper
export function usePaymentSummary(orderId: string) {
  const paymentsQuery = useOrderPayments(orderId);
  const balanceQuery = useOrderRemainingBalance(orderId);

  const payments = paymentsQuery.data;
  const remainingBalance = balanceQuery.data;

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
      byMethod: {} as Record<string, number>,
    },
  );

  return {
    isLoading: paymentsQuery.isLoading || balanceQuery.isLoading,
    isError: paymentsQuery.isError || balanceQuery.isError,
    error: paymentsQuery.error || balanceQuery.error,
    data: {
      payments: payments || [],
      summary: summary || { total: 0, count: 0, byMethod: {} },
      remainingBalance: remainingBalance ?? 0,
    },
  };
}

// Helper for formatting payment methods
export function formatPaymentMethod(method: string): string {
  const methods: Record<string, string> = {
    cash: 'Cash',
    card: 'Credit/Debit Card',
    digital: 'Digital Payment',
  };
  return methods[method] || method;
}
