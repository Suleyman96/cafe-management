import type { OrdersInsert } from '@gustri/database';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { MUTATION_KEYS } from '@/lib/mutation-keys';
import { registerMutationDefaults } from '@/lib/register-mutation-defaults';
import { db } from '@/lib/supabase';

describe('registerMutationDefaults — CREATE_ORDER idempotency', () => {
  function makeOrderData(): OrdersInsert {
    return {
      tenant_id: '00000000-0000-0000-0000-0000000000aa',
      table_id: '00000000-0000-0000-0000-0000000000bb',
      order_type: 'dine_in',
      source: 'waiter',
    };
  }

  it('mints a stable client_request_id on first call and reuses it on replay', async () => {
    const ordersCreate = vi.mocked(db.orders.create).mockResolvedValue({ id: 'order-1' } as never);

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    registerMutationDefaults(queryClient);

    const defaults = queryClient.getMutationDefaults(MUTATION_KEYS.CREATE_ORDER);
    expect(defaults?.mutationFn).toBeDefined();

    // First attempt: helper mints a UUID and threads it through.
    const variables = makeOrderData();
    await defaults!.mutationFn?.(variables as never);
    const firstCallArg = ordersCreate.mock.calls[0]![0] as OrdersInsert;
    const firstId = firstCallArg.client_request_id;
    expect(firstId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    // Replay: persister rehydrates the same variables object — id must
    // round-trip so the server dedupes against the unique index.
    variables.client_request_id = firstId;
    await defaults!.mutationFn?.(variables as never);
    const secondCallArg = ordersCreate.mock.calls[1]![0] as OrdersInsert;
    expect(secondCallArg.client_request_id).toBe(firstId);
  });

  it('preserves a caller-supplied client_request_id', async () => {
    const ordersCreate = vi.mocked(db.orders.create).mockResolvedValue({ id: 'order-2' } as never);

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    registerMutationDefaults(queryClient);
    const defaults = queryClient.getMutationDefaults(MUTATION_KEYS.CREATE_ORDER);

    const supplied = '11111111-2222-4333-8444-555555555555';
    const variables = { ...makeOrderData(), client_request_id: supplied };
    await defaults!.mutationFn?.(variables as never);

    const callArg = ordersCreate.mock.calls[0]![0] as OrdersInsert;
    expect(callArg.client_request_id).toBe(supplied);
  });
});
