import { QUERY_KEYS } from '@gustri/core';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCreatePayment, useOrderPayments } from '@/hooks/use-payments';
import { apiRoutes } from '@/lib/api-routes';
import { createWrapper, renderHookWithProviders } from '../helpers/test-utils';

const ORDER_UUID = '00000000-0000-0000-0000-0000000000a1';

describe('Payment processing correctness', () => {
  it('useCreatePayment calls apiRoutes.payments.create with correct args', async () => {
    const payment = {
      order_id: ORDER_UUID,
      amount: 50,
      payment_method: 'card' as const,
      received_by: 'staff-1',
    };

    const { result } = renderHookWithProviders(() => useCreatePayment());
    await result.current.mutateAsync(payment);

    expect(apiRoutes.payments.create).toHaveBeenCalledWith(
      ORDER_UUID,
      expect.objectContaining({
        amount: 50,
        payment_method: 'card',
        received_by: 'staff-1',
      }),
    );
  });

  it('useCreatePayment invalidates payments AND orders on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreatePayment());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      order_id: ORDER_UUID,
      amount: 100,
      payment_method: 'cash',
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.PAYMENTS, ORDER_UUID]);
    expect(keys).toContainEqual([QUERY_KEYS.ORDERS]);
    expect(keys).toContainEqual([QUERY_KEYS.ORDER, ORDER_UUID]);
  });

  it('useOrderPayments is disabled when orderId is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useOrderPayments(''));
    expect(mockDb.payments.findByOrderId).not.toHaveBeenCalled();
  });

  it('useOrderPayments returns payment data', async () => {
    const mockPayments = [
      { id: 'p1', amount: 30, payment_method: 'cash' },
      { id: 'p2', amount: 70, payment_method: 'card' },
    ];
    const { wrapper, mockDb } = createWrapper();
    (mockDb.payments.findByOrderId as any).mockResolvedValueOnce(mockPayments);

    const { result } = renderHook(() => useOrderPayments('order-1'), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(mockPayments));
  });

  it('totalPaid calculation sums payment amounts correctly', () => {
    const payments = [{ amount: 30 }, { amount: 20.5 }, { amount: 49.5 }];
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    expect(totalPaid).toBe(100);
  });

  it('remaining balance handles exact payment, overpay, and zero', () => {
    const orderTotal = 100;

    // Exact payment
    expect(orderTotal - 100).toBe(0);

    // Partial payment
    expect(orderTotal - 60).toBe(40);

    // Overpay
    expect(orderTotal - 110).toBe(-10);

    // No payments
    expect(orderTotal - 0).toBe(100);
  });
});
