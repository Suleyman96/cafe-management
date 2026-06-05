export { useAddOrderItems } from '@gustri/queries';

// useCreateOrder is not available in @gustri/queries — keep local implementation
import { validateOrThrow } from '@gustri/core';
import { OrderCreateInputSchema } from '@gustri/database/schemas/inputs';
import type { OrdersInsert } from '@gustri/database/types';
import { QUERY_KEYS, tenantKey, useDb, useTenantId } from '@gustri/queries';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrCreateClientRequestId } from '@/lib/idempotency';
import { MUTATION_KEYS } from '@/lib/mutation-keys';

/**
 * Idempotency contract for order creation (M5 — documented gate).
 *
 * Order creation is a money-adjacent path that MUST dedupe on retry.
 * Two retried POSTs from the same logical user intent — including
 * cross-cold-start replays after the persister rehydrates a paused
 * mutation — must hit the server exactly once. The contract has four
 * layers, each enforcing the same invariant from a different angle:
 *
 * 1. **Hook `onMutate`** — stamps `client_request_id` onto `variables`
 *    via `getOrCreateClientRequestId`. The id is stable for the
 *    lifetime of the mutation and survives persister round-trips
 *    (variables are serialized; meta-side fields are NOT — see B1
 *    audit). Idempotent: a replay sees the existing id and reuses it.
 *
 * 2. **Hook `mutationFn`** — runtime invariant `if (!client_request_id) throw`.
 *    Catches the case where `onMutate` was bypassed (a future regression
 *    that calls `mutationFn` directly, or a serialization quirk that
 *    drops the field). Failing loudly here is preferable to silently
 *    minting a fresh id that bypasses server dedupe (would risk a
 *    duplicate ticket).
 *
 * 3. **Persister-replay path in `register-mutation-defaults.ts`** —
 *    same runtime invariant on the registered `CREATE_ORDER` default.
 *    Covers the cold-start replay path where no React component is
 *    mounted yet.
 *
 * 4. **Schema** — `OrderCreateInputSchema` requires
 *    `client_request_id: z.string().uuid()`. `validateOrThrow` below
 *    throws ValidationError if the field is missing or malformed.
 *    Acts as the type-level gate (`OrderCreateInput['client_request_id']`
 *    is required-string, pinned by the M5 type-level test in
 *    `packages/database/src/__tests__/idempotency-contract.test.ts`).
 *
 * The server's `(tenant_id, client_request_id)` unique index is the
 * actual dedupe enforcer. These four layers are the client-side
 * contract that ensures the index is exercised.
 *
 * If you add another "create" mutation in `@gustri/queries` that maps
 * to a server endpoint with a similar dedupe path (e.g. `useCreateRefund`),
 * mirror this contract: schema requires `client_request_id`, hook stamps
 * via `onMutate`, runtime invariant in `mutationFn`. The type-level
 * test in `idempotency-contract.test.ts` is the place to add a
 * compile-time gate for the new variables type.
 */
export function useCreateOrder() {
  const db = useDb();
  const tenantId = useTenantId();
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
      // Invariant: `onMutate` above stamps `client_request_id` before the
      // network call. If it's missing here, `onMutate` was bypassed (e.g.
      // a future regression that calls `mutationFn` directly) — silently
      // continuing would route the request past the server's dedupe path.
      if (!orderData.client_request_id) {
        throw new Error('createOrder: client_request_id missing — onMutate must run first');
      }
      const validated = validateOrThrow(OrderCreateInputSchema, orderData, 'Invalid order');
      return await db.orders.create(validated as OrdersInsert);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDERS) });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.TABLES) });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.DELIVERY_ORDERS) });
    },
    onError: (error: Error) => {
      Sentry.captureException(error, { extra: { context: 'createOrder' } });
    },
  });
}
