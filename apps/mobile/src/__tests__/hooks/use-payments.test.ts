import { QUERY_KEYS } from '@cafe-idare/core';
import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCreatePayment, useOrderPayments } from '@/hooks/use-payments';
import { db } from '@/lib/supabase';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useOrderPayments', () => {
  it('calls db.payments.findByOrderId', () => {
    renderHookWithProviders(() => useOrderPayments('o1'));
    expect(db.payments.findByOrderId).toHaveBeenCalledWith('o1');
  });
});

describe('useCreatePayment', () => {
  it('invalidates payments, orders, and order on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreatePayment());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      order_id: 'o1',
      amount: 100,
      payment_method: 'cash',
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['payments', 'o1']);
    expect(keys).toContainEqual(['orders']);
    expect(keys).toContainEqual(['order', 'o1']);
  });
});

// --- New tests using QUERY_KEYS constants, data flow, and argument verification ---

describe('useOrderPayments - data flow', () => {
  it('returns fetched payments', async () => {
    const mockPayments = [{ id: 'p1', order_id: 'o1', amount: 50 }];
    (db.payments.findByOrderId as any).mockResolvedValueOnce(mockPayments);
    const { result } = renderHookWithProviders(() => useOrderPayments('o1'));
    await waitFor(() => expect(result.current.data).toEqual(mockPayments));
  });
});

describe('useCreatePayment - argument verification', () => {
  it('calls db.payments.create with payment data', async () => {
    const paymentData = { order_id: 'o1', amount: 50, payment_method: 'cash' as const };
    const { result } = renderHookWithProviders(() => useCreatePayment());
    await result.current.mutateAsync(paymentData);
    expect(db.payments.create).toHaveBeenCalledWith({
      ...paymentData,
      received_by: '',
      payment_type: 'full',
      tip_amount: 0,
      order_item_ids: null,
      notes: null,
    });
  });
});

describe('useCreatePayment - QUERY_KEYS', () => {
  it('invalidates using QUERY_KEYS constants', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreatePayment());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      order_id: 'o1',
      amount: 100,
      payment_method: 'cash',
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.PAYMENTS, 'o1']);
    expect(keys).toContainEqual([QUERY_KEYS.ORDERS]);
    expect(keys).toContainEqual([QUERY_KEYS.ORDER, 'o1']);
  });
});
