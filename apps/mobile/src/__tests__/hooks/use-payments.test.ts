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
