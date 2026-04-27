// Shared read hook
export { useOrderPayments } from '@gustri/queries';

// Local hook — uses apiRoutes for payment creation
import { QUERY_KEYS, validateOrThrow } from '@gustri/core';
import { type OrderPaymentCreateInput, OrderPaymentCreateInputSchema } from '@gustri/database';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: OrderPaymentCreateInput) => {
      const payment = validateOrThrow(
        OrderPaymentCreateInputSchema,
        input,
        'Invalid payment payload',
      );
      const { payment: created } = await apiRoutes.payments.create(payment.order_id, {
        amount: payment.amount,
        payment_method: payment.payment_method,
        received_by: payment.received_by ?? '',
        payment_type: payment.payment_type ?? 'full',
        tip_amount: payment.tip_amount ?? 0,
        order_item_ids: payment.order_item_ids ?? null,
        notes: payment.notes ?? null,
      });
      return created;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYMENTS, variables.order_id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, variables.order_id] });
    },
    onError: (error: Error) => {
      Sentry.captureException(error, { extra: { context: 'createPayment' } });
    },
  });
}
