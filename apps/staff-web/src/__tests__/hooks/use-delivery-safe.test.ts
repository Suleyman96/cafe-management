import { QUERY_KEYS } from '@cafe-idare/core';
import {
  useAssignDeliveryPerson,
  useDeliveryOrders,
  useMarkDelivered,
  useMarkOutForDelivery,
  useUpdateDeliveryFee,
} from '@/hooks/use-delivery-safe';
import { db } from '@/lib/supabase/wrapped-client';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useDeliveryOrders', () => {
  it('calls db.orders.findDeliveryOrders', () => {
    renderHookWithProviders(() => useDeliveryOrders());
    expect(db.orders.findDeliveryOrders).toHaveBeenCalled();
  });
});

describe('useAssignDeliveryPerson', () => {
  it('calls db.orders.assignDeliveryPerson with orderId and staffId', async () => {
    const { result } = renderHookWithProviders(() => useAssignDeliveryPerson());
    await result.current.mutateAsync({ orderId: 'o1', staffId: 's1' });
    expect(db.orders.assignDeliveryPerson).toHaveBeenCalledWith('o1', 's1');
  });

  it('invalidates delivery and order keys on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useAssignDeliveryPerson());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'o1', staffId: 's1' });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.DELIVERY_ORDERS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDERS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDER]);
  });
});

describe('useUpdateDeliveryFee', () => {
  it('calls db.orders.updateDeliveryFee with orderId and fee', async () => {
    const { result } = renderHookWithProviders(() => useUpdateDeliveryFee());
    await result.current.mutateAsync({ orderId: 'o1', fee: 5.5 });
    expect(db.orders.updateDeliveryFee).toHaveBeenCalledWith('o1', 5.5);
  });

  it('invalidates delivery and order keys on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateDeliveryFee());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'o1', fee: 5.5 });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.DELIVERY_ORDERS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDERS]);
  });
});

describe('useMarkOutForDelivery', () => {
  it('calls db.orders.markOutForDelivery with orderId and deliveryPersonId', async () => {
    const { result } = renderHookWithProviders(() => useMarkOutForDelivery());
    await result.current.mutateAsync({ orderId: 'o1', deliveryPersonId: 's1' });
    expect(db.orders.markOutForDelivery).toHaveBeenCalledWith('o1', 's1');
  });

  it('invalidates delivery and order keys on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMarkOutForDelivery());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'o1', deliveryPersonId: 's1' });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.DELIVERY_ORDERS]);
  });
});

describe('useMarkDelivered', () => {
  it('calls db.orders.markDelivered with orderId', async () => {
    const { result } = renderHookWithProviders(() => useMarkDelivered());
    await result.current.mutateAsync('o1');
    expect(db.orders.markDelivered).toHaveBeenCalledWith('o1');
  });

  it('invalidates delivery and order keys on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMarkDelivered());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('o1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.DELIVERY_ORDERS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDERS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDER]);
  });
});
