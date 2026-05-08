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

  it('passes a stamped client_request_id straight through (no re-mint on replay)', async () => {
    // The persister-rehydrated path: `useCreateOrder.onMutate` ran on the
    // first attempt before the crash, so the variables object already
    // carries `client_request_id`. The registered default must thread that
    // exact id through to `db.orders.create` so the server's
    // `(tenant_id, client_request_id)` unique index dedupes the replay.
    const ordersCreate = vi.mocked(db.orders.create).mockResolvedValue({ id: 'order-1' } as never);

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    registerMutationDefaults(queryClient);

    const defaults = queryClient.getMutationDefaults(MUTATION_KEYS.CREATE_ORDER);
    expect(defaults?.mutationFn).toBeDefined();

    const stamped = '11111111-2222-4333-8444-555555555555';
    const variables = { ...makeOrderData(), client_request_id: stamped };

    await defaults!.mutationFn?.(variables as never);
    await defaults!.mutationFn?.(variables as never);

    expect(ordersCreate.mock.calls).toHaveLength(2);
    expect((ordersCreate.mock.calls[0]![0] as OrdersInsert).client_request_id).toBe(stamped);
    expect((ordersCreate.mock.calls[1]![0] as OrdersInsert).client_request_id).toBe(stamped);
  });

  it('throws when variables are missing client_request_id', async () => {
    // Hooks stamp the id in `onMutate` before the network call. If the
    // registered default ever sees an unstamped variables object, hooks
    // have regressed — silently minting a fresh id here would route the
    // request past server-side dedupe on a network-retry and risk a
    // duplicate ticket. We fail loudly instead.
    vi.mocked(db.orders.create).mockResolvedValue({ id: 'order-2' } as never);

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    registerMutationDefaults(queryClient);
    const defaults = queryClient.getMutationDefaults(MUTATION_KEYS.CREATE_ORDER);

    const variables = makeOrderData(); // no client_request_id

    expect(() => defaults!.mutationFn?.(variables as never)).toThrow(/client_request_id/i);
    expect(db.orders.create).not.toHaveBeenCalled();
  });
});
