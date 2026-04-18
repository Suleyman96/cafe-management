import { QUERY_KEYS } from '@gustri/core';
import { describe, expect, it, vi } from 'vitest';
import {
  useCreatePayment,
  useOrderPayments,
  useOrderRemainingBalance,
  usePaymentsByStaff,
} from '@/hooks/use-payments-safe';
import { apiRoutes } from '@/lib/api-routes';
import { db } from '@/lib/supabase/wrapped-client';
import { renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('usePaymentsByStaff', () => {
  it('calls findByReceivedBy with staffId and limit', () => {
    renderHookWithProviders(() => usePaymentsByStaff('s1', 10));
    expect(db.payments.findByReceivedBy).toHaveBeenCalledWith('s1', 10);
  });

  it('is disabled when staffId is empty', () => {
    renderHookWithProviders(() => usePaymentsByStaff(''));
    expect(db.payments.findByReceivedBy).not.toHaveBeenCalled();
  });
});

describe('useOrderPayments', () => {
  it('calls findByOrderId', () => {
    renderHookWithProviders(() => useOrderPayments('o1'));
    expect(db.payments.findByOrderId).toHaveBeenCalledWith('o1');
  });

  it('is disabled when orderId is empty', () => {
    renderHookWithProviders(() => useOrderPayments(''));
    expect(db.payments.findByOrderId).not.toHaveBeenCalled();
  });

  it('returns fetched payments', async () => {
    const mockPayments = [{ id: 'p1', order_id: 'o1', amount: 50, payment_method: 'cash' }];
    (db.payments.findByOrderId as any).mockResolvedValueOnce(mockPayments);
    const { result } = renderHookWithProviders(() => useOrderPayments('o1'));
    await waitFor(() => expect(result.current.data).toEqual(mockPayments));
  });
});

describe('useOrderRemainingBalance', () => {
  it('calls getRemainingBalance', () => {
    renderHookWithProviders(() => useOrderRemainingBalance('o1'));
    expect(db.rpc.getRemainingBalance).toHaveBeenCalledWith('o1');
  });

  it('is disabled when orderId is empty', () => {
    renderHookWithProviders(() => useOrderRemainingBalance(''));
    expect(db.rpc.getRemainingBalance).not.toHaveBeenCalled();
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
