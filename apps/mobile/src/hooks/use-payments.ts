// Shared read hook
export { useOrderPayments } from '@gustri/queries';

// Local hook — uses apiRoutes for payment creation
import { validateOrThrow } from '@gustri/core';
import { type OrderPaymentCreateInput, OrderPaymentCreateInputSchema } from '@gustri/database';
import { QUERY_KEYS } from '@gustri/queries';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';
import { hapticSuccess } from '@/lib/haptics';

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    // Payments must NEVER queue offline — a payment recorded "now" but
    // executed 20 minutes later when connectivity returns can collide with
    // another card or diverge from the customer-facing receipt. UI guards
    // (OfflineGuardButton) prevent the action while offline; if the user
    // bypasses that, fail loudly here rather than silently queueing.
    networkMode: 'always',
    retry: 0,
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
      hapticSuccess();
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYMENTS, variables.order_id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, variables.order_id] });
    },
    onError: (error: Error) => {
      Sentry.captureException(error, { extra: { context: 'createPayment' } });
    },
  });
}
