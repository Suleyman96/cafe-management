/**
 * Type-Safe Payment Hooks
 * Re-exports from @gustri/queries, with local overrides for apiRoutes mutations
 */

import { QUERY_KEYS } from '@gustri/core';
import type { Database } from '@gustri/database';
import {
  useOrderPayments as useOrderPaymentsShared,
  useOrderRemainingBalance as useOrderRemainingBalanceShared,
} from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';

type PaymentInsert = Database['public']['Tables']['order_payments']['Insert'];
type Payment = Database['public']['Tables']['order_payments']['Row'];

// Re-export shared read hooks
export { useOrderPayments, useOrderRemainingBalance, usePaymentsByStaff } from '@gustri/queries';

// Local: uses apiRoutes for server-side balance validation
export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payment: PaymentInsert) => {
      const { order_id, ...rest } = payment;
      // Balance validation is now enforced server-side in the API route
      return apiRoutes.payments.create(order_id, rest);
    },
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

// Composite hook: payment summary for an order (app-specific)
export function usePaymentSummary(orderId: string) {
  const paymentsQuery = useOrderPaymentsShared(orderId);
  const balanceQuery = useOrderRemainingBalanceShared(orderId);

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
