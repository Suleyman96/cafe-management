import { QUERY_KEYS } from '@gustri/queries';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  useCreatePayment,
  useOrderPayments,
  useOrderRemainingBalance,
  usePaymentsByStaff,
} from '@/hooks/use-payments-safe';
import { apiRoutes } from '@/lib/api-routes';
import { createWrapper, renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('usePaymentsByStaff', () => {
  it('calls findByReceivedBy with staffId and limit', () => {
    const { mockDb } = renderHookWithProviders(() => usePaymentsByStaff('s1', 10));
    expect(mockDb.payments.findByReceivedBy).toHaveBeenCalledWith('s1', 10);
  });

  it('is disabled when staffId is empty', () => {
    const { mockDb } = renderHookWithProviders(() => usePaymentsByStaff(''));
    expect(mockDb.payments.findByReceivedBy).not.toHaveBeenCalled();
  });
});

describe('useOrderPayments', () => {
  it('calls findByOrderId', () => {
    const { mockDb } = renderHookWithProviders(() => useOrderPayments('o1'));
    expect(mockDb.payments.findByOrderId).toHaveBeenCalledWith('o1');
  });

  it('is disabled when orderId is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useOrderPayments(''));
    expect(mockDb.payments.findByOrderId).not.toHaveBeenCalled();
  });

  it('returns fetched payments', async () => {
    const mockPayments = [{ id: 'p1', order_id: 'o1', amount: 50, payment_method: 'cash' }];
    const { wrapper, mockDb } = createWrapper();
    (mockDb.payments.findByOrderId as any).mockResolvedValueOnce(mockPayments);
    const { result } = renderHook(() => useOrderPayments('o1'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(mockPayments));
  });
});

describe('useOrderRemainingBalance', () => {
  it('calls getRemainingBalance', () => {
    const { mockDb } = renderHookWithProviders(() => useOrderRemainingBalance('o1'));
    expect(mockDb.rpc.getRemainingBalance).toHaveBeenCalledWith('o1');
  });

  it('is disabled when orderId is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useOrderRemainingBalance(''));
    expect(mockDb.rpc.getRemainingBalance).not.toHaveBeenCalled();
  });
});

describe('useCreatePayment', () => {
  it('invalidates correct query keys on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreatePayment());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ order_id: 'o1', amount: 50, payment_method: 'cash' } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDERS, 'o1']);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDER, 'o1']);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.PAYMENTS, 'o1']);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.PAYMENTS_BY_STAFF]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDERS]);
    // CRITICAL: Must invalidate remaining balance so payment modal shows updated amount
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.PAYMENTS, 'remaining_balance', 'o1']);
  });

  it('calls apiRoutes.payments.create with order id and payment data', async () => {
    const paymentData = { order_id: 'o1', amount: 50, payment_method: 'cash' } as any;
    const { result } = renderHookWithProviders(() => useCreatePayment());
    await result.current.mutateAsync(paymentData);
    // The hook destructures order_id and passes the rest to apiRoutes
    expect(apiRoutes.payments.create).toHaveBeenCalledWith('o1', {
      amount: 50,
      payment_method: 'cash',
    });
  });
});
