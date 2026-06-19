/**
 * Type-Safe Payment Hooks
 * Re-exports from @gustri/queries, with local overrides for apiRoutes mutations
 */

import type { Database } from '@gustri/database/types';
import {
  getOrCreateClientRequestId,
  QUERY_KEYS,
  tenantKey,
  useOrderPayments as useOrderPaymentsShared,
  useOrderRemainingBalance as useOrderRemainingBalanceShared,
  useTenantId,
} from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';

type PaymentInsert = Database['public']['Tables']['order_payments']['Insert'] & {
  client_request_id?: string;
};
type Payment = Database['public']['Tables']['order_payments']['Row'];

// Re-export shared read hooks
export { useOrderPayments, useOrderRemainingBalance, usePaymentsByStaff } from '@gustri/queries';

// Local: uses apiRoutes for server-side balance validation
export function useCreatePayment() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    // Payments are the highest-risk replay path — `retry: 0` keeps an
    // automatic React Query retry from double-charging. A user-driven
    // retry reuses the same `client_request_id` (stamped onto variables
    // by `onMutate` below) so the server dedupes via the
    // `(tenant_id, client_request_id)` unique index.
    retry: 0,
    onMutate: (payment: PaymentInsert) => {
      payment.client_request_id = getOrCreateClientRequestId(payment.client_request_id);
    },
    mutationFn: (payment: PaymentInsert) => {
      const { order_id, client_request_id, ...rest } = payment;
      // Balance validation is enforced server-side in the API route.
      // `client_request_id` is required by the route schema (Blocker 1).
      return apiRoutes.payments.create(order_id, {
        ...rest,
        client_request_id: client_request_id as string,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.ORDERS, variables.order_id),
      });
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.ORDER, variables.order_id),
      });
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.PAYMENTS, variables.order_id),
      });
      // Remaining-balance key is [PAYMENTS, tenant, orderId, 'balance']; the old
      // [PAYMENTS, tenant, 'remaining_balance', orderId] matched nothing. (The
      // PAYMENTS-prefix invalidation above already covers it, but keep this
      // explicit + correct.)
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.PAYMENTS, variables.order_id, 'balance'),
      });
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.PAYMENTS_BY_STAFF),
      });
      // A full payment closes the order (and frees its table) via DB trigger,
      // so every order/table view must refetch — not just the ORDERS lists.
      // Without ACTIVE_ORDERS the kitchen kept showing a just-paid order until
      // realtime happened to fire (and never, when realtime is down). TABLES
      // for the freed-table status; DELIVERY/TAKEOUT for those dedicated views.
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDERS) });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ACTIVE_ORDERS) });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.TABLES) });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.DELIVERY_ORDERS) });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.TAKEOUT_ORDERS) });
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
