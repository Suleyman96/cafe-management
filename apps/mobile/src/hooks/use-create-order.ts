export { useAddOrderItems } from '@gustri/queries';

// useCreateOrder is not available in @gustri/queries — keep local implementation
import { QUERY_KEYS, validateOrThrow } from '@gustri/core';
import { OrderCreateInputSchema, type OrdersInsert } from '@gustri/database';
import { useDb } from '@gustri/queries';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useCreateOrder() {
  const db = useDb();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['create-order'],
    mutationFn: async (orderData: OrdersInsert) => {
      const validated = validateOrThrow(OrderCreateInputSchema, orderData, 'Invalid order');
      return await db.orders.create(validated as OrdersInsert);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDERS] });
    },
    onError: (error: Error) => {
      Sentry.captureException(error, { extra: { context: 'createOrder' } });
    },
  });
}
