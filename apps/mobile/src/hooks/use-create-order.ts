export { useAddOrderItems } from '@gustri/queries';

// useCreateOrder is not available in @gustri/queries — keep local implementation
import { validateOrThrow } from '@gustri/core';
import { OrderCreateInputSchema, type OrdersInsert } from '@gustri/database';
import { QUERY_KEYS, useDb } from '@gustri/queries';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrCreateClientRequestId } from '@/lib/idempotency';
import { MUTATION_KEYS } from '@/lib/mutation-keys';

export function useCreateOrder() {
  const db = useDb();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: MUTATION_KEYS.CREATE_ORDER,
    // Stamp `client_request_id` onto the variables before the network call.
    // The persister serializes `variables`, so a paused-then-replayed
    // mutation rehydrates with the same id and the server dedupes it
    // against the (tenant_id, client_request_id) unique index.
    onMutate: (orderData: OrdersInsert) => {
      orderData.client_request_id = getOrCreateClientRequestId(orderData.client_request_id);
    },
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
