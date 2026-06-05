// Shared read hook
export { useOrderPayments } from '@gustri/queries';

// Local hook — uses apiRoutes for payment creation
import { validateOrThrow } from '@gustri/core';
import {
  type OrderPaymentCreateInput,
  OrderPaymentCreateInputSchema,
} from '@gustri/database/schemas/inputs';
import { QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';
import { hapticSuccess } from '@/lib/haptics';
import { getOrCreateClientRequestId } from '@/lib/idempotency';

// Callers don't need to pre-stamp `client_request_id` — the hook does it
// in `onMutate` so React Query retries reuse the same id. The schema
// (and server route) require the field, but accepting it as optional at
// the hook boundary keeps screens free of idempotency boilerplate.
type CreatePaymentInput = Omit<OrderPaymentCreateInput, 'client_request_id'> & {
  client_request_id?: string;
};

export function useCreatePayment() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    // M6: stable mutationKey so consumers can scope `useIsMutating(...)` to
    // payments — e.g. a screen-level disable on the "Charge" button while a
    // payment for the *same order* is in flight (predicate filters
    // `mutation.state.variables.order_id`, same shape H2 uses for per-item
    // kitchen rows).
    //
    // INTENTIONALLY NOT registered in `@gustri/queries/MUTATION_KEYS` and
    // INTENTIONALLY NOT given a default `mutationFn` in
    // `register-mutation-defaults.ts`. Those two registries are the
    // *replayable persisted-mutation* set — joining them would imply this
    // mutation can resume after rehydrate, which contradicts the
    // `networkMode: 'always', retry: 0` contract below. The key is for
    // observability (useIsMutating) and dedup, NOT replay.
    mutationKey: ['create-payment'],
    // Payments must NEVER queue offline — a payment recorded "now" but
    // executed 20 minutes later when connectivity returns can collide with
    // another card or diverge from the customer-facing receipt. UI guards
    // (OfflineGuardButton) prevent the action while offline; if the user
    // bypasses that, fail loudly here rather than silently queueing.
    //
    // We still stamp a `client_request_id` so an in-flight retry (request
    // sent, response dropped) reaches the server's dedupe path instead of
    // double-charging.
    networkMode: 'always',
    retry: 0,
    onMutate: (input: CreatePaymentInput) => {
      input.client_request_id = getOrCreateClientRequestId(input.client_request_id);
    },
    mutationFn: async (input: CreatePaymentInput) => {
      // Invariant: `onMutate` above stamps `client_request_id`. If it's
      // missing here, `onMutate` was bypassed and re-minting silently would
      // duplicate-charge on a network retry that lost only the response.
      if (!input.client_request_id) {
        throw new Error('createPayment: client_request_id missing — onMutate must run first');
      }
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
        client_request_id: payment.client_request_id,
      });
      return created;
    },
    onSuccess: (_data, variables) => {
      hapticSuccess();
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.PAYMENTS, variables.order_id),
      });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDERS) });
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.ORDER, variables.order_id),
      });
    },
    onError: (error: Error) => {
      Sentry.captureException(error, { extra: { context: 'createPayment' } });
    },
  });
}
