import { describe, expect, it, vi } from 'vitest';
import {
  useCancelOrder,
  useDeliveryOrders,
  useMarkDelivered,
  useMarkOutForDelivery,
} from '@/hooks/use-delivery';
import { db } from '@/lib/supabase';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useDeliveryOrders', () => {
  it('calls db.orders.findDeliveryOrders', () => {
    renderHookWithProviders(() => useDeliveryOrders());
    expect(db.orders.findDeliveryOrders).toHaveBeenCalled();
  });
});

describe('useMarkOutForDelivery', () => {
  it('invalidates delivery-orders and orders on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMarkOutForDelivery());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'o1', deliveryPersonId: 'dp1' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['delivery_orders']);
    expect(keys).toContainEqual(['orders']);
  });
});

describe('useMarkDelivered', () => {
  it('invalidates delivery-orders and orders on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMarkDelivered());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('o1');

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['delivery_orders']);
    expect(keys).toContainEqual(['orders']);
  });
});

describe('useCancelOrder', () => {
  it('invalidates delivery-orders and orders on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCancelOrder());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'o1', reason: 'test' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['delivery_orders']);
    expect(keys).toContainEqual(['orders']);
  });
});
