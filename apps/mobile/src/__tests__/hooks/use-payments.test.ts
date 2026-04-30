import { QUERY_KEYS } from '@gustri/queries';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCreatePayment, useOrderPayments } from '@/hooks/use-payments';
import { apiRoutes } from '@/lib/api-routes';
import { createWrapper, renderHookWithProviders } from '../helpers/test-utils';

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
    expect(keys).toContainEqual(['payments', orderId]);
    expect(keys).toContainEqual(['orders']);
    expect(keys).toContainEqual(['order', orderId]);
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
    expect(keys).toContainEqual([QUERY_KEYS.PAYMENTS, orderId]);
    expect(keys).toContainEqual([QUERY_KEYS.ORDERS]);
    expect(keys).toContainEqual([QUERY_KEYS.ORDER, orderId]);
  });
});
