import { MUTATION_KEYS, QUERY_KEYS, tenantKey } from '@gustri/queries';
import { useIsMutating } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCreatePayment, useOrderPayments } from '@/hooks/use-payments';
import { apiRoutes } from '@/lib/api-routes';
import { createWrapper, renderHookWithProviders, TEST_TENANT_ID } from '../helpers/test-utils';

describe('useOrderPayments', () => {
  it('calls db.payments.findByOrderId', () => {
    const { mockDb } = renderHookWithProviders(() => useOrderPayments('o1'));
    expect(mockDb.payments.findByOrderId).toHaveBeenCalledWith('o1');
  });
});

describe('useCreatePayment', () => {
  it('invalidates payments, orders, and order on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreatePayment());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    const orderId = '00000000-0000-0000-0000-0000000000a1';
    await result.current.mutateAsync({
      order_id: orderId,
      amount: 100,
      payment_method: 'cash',
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, 'payments', orderId));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, 'orders'));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, 'order', orderId));
  });
});

// --- New tests using QUERY_KEYS constants, data flow, and argument verification ---

describe('useOrderPayments - data flow', () => {
  it('returns fetched payments', async () => {
    const mockPayments = [{ id: 'p1', order_id: 'o1', amount: 50 }];
    const { wrapper, mockDb } = createWrapper();
    (mockDb.payments.findByOrderId as any).mockResolvedValueOnce(mockPayments);
    const { result } = renderHook(() => useOrderPayments('o1'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(mockPayments));
  });
});

describe('useCreatePayment - argument verification', () => {
  it('calls apiRoutes.payments.create with payment data and a generated client_request_id', async () => {
    const orderId = '00000000-0000-0000-0000-0000000000a1';
    const paymentData = { order_id: orderId, amount: 50, payment_method: 'cash' as const };
    const { result } = renderHookWithProviders(() => useCreatePayment());
    await result.current.mutateAsync(paymentData);
    expect(apiRoutes.payments.create).toHaveBeenCalledWith(
      orderId,
      expect.objectContaining({
        amount: 50,
        payment_method: 'cash',
        received_by: '',
        payment_type: 'full',
        tip_amount: 0,
        order_item_ids: null,
        notes: null,
        // onMutate stamps a UUID v4 — assert shape, not exact value.
        client_request_id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        ),
      }),
    );
  });
});

describe('useCreatePayment - QUERY_KEYS', () => {
  it('invalidates using QUERY_KEYS constants', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreatePayment());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    const orderId = '00000000-0000-0000-0000-0000000000a1';
    await result.current.mutateAsync({
      order_id: orderId,
      amount: 100,
      payment_method: 'cash',
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.PAYMENTS, orderId));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDER, orderId));
  });
});

// M6: stable mutationKey for observability + dedup. The key is intentionally
// NOT registered in @gustri/queries/MUTATION_KEYS or
// register-mutation-defaults.ts because payments are non-replayable
// (`networkMode: 'always', retry: 0`). The two regression guards below pin
// both halves of that contract — the key is present, AND the persisted-set
// stays absent.
describe('useCreatePayment - mutationKey (M6)', () => {
  it('exposes the in-flight payment mutation via useIsMutating', async () => {
    // Inject a slow apiRoute so the mutation stays in flight long enough to
    // be observed by useIsMutating during the call.
    let resolveCreate: (value: { payment: unknown }) => void = () => {};
    const pending = new Promise<{ payment: unknown }>((resolve) => {
      resolveCreate = resolve;
    });
    (apiRoutes.payments.create as any).mockImplementationOnce(() => pending);

    const { result, queryClient } = renderHookWithProviders(() => ({
      mutation: useCreatePayment(),
      isMutating: useIsMutating({ mutationKey: ['create-payment'] }),
    }));

    expect(result.current.isMutating).toBe(0);

    const orderId = '00000000-0000-0000-0000-0000000000a1';
    const promise = result.current.mutation.mutateAsync({
      order_id: orderId,
      amount: 25,
      payment_method: 'cash',
    });

    // The mutation is now in flight against `mutationKey: ['create-payment']`.
    await waitFor(() =>
      expect(queryClient.isMutating({ mutationKey: ['create-payment'] })).toBe(1),
    );

    resolveCreate({ payment: { id: 'p1' } });
    await promise;

    await waitFor(() =>
      expect(queryClient.isMutating({ mutationKey: ['create-payment'] })).toBe(0),
    );
  });

  it('is NOT registered in @gustri/queries MUTATION_KEYS (non-replayable)', () => {
    // Persisted-mutation regression guard: payments must never queue
    // offline; including them in MUTATION_KEYS would imply replay-on-rehydrate
    // semantics, which directly contradicts `networkMode: 'always', retry: 0`.
    const persistedKeys = Object.values(MUTATION_KEYS).map((k) => k.join(':'));
    expect(persistedKeys).not.toContain('create-payment');
  });
});
