// Shared read hook
export { useOrderPayments } from '@gustri/queries';

// Local hook — uses apiRoutes for payment creation
import { QUERY_KEYS } from '@gustri/core';
import type { OrderPayment } from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';

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
      console.error('Failed to create payment:', error.message);
    },
  });
}
