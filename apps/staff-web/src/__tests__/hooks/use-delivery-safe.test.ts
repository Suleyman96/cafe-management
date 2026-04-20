import { QUERY_KEYS } from '@gustri/core';
import { renderHook } from '@testing-library/react';
import {
  useAssignDeliveryPerson,
  useDeliveryOrders,
  useMarkDelivered,
  useMarkOutForDelivery,
  useUpdateDeliveryFee,
} from '@/hooks/use-delivery-safe';
import { createWrapper, renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('useDeliveryOrders', () => {
  it('calls db.orders.findDeliveryOrders', () => {
    const { mockDb } = renderHookWithProviders(() => useDeliveryOrders());
    expect(mockDb.orders.findDeliveryOrders).toHaveBeenCalled();
  });

  it('returns fetched delivery orders', async () => {
    const mockOrders = [{ id: 'o1', source: 'delivery', status: 'new' }];
    const { wrapper, mockDb } = createWrapper();
    (mockDb.orders.findDeliveryOrders as any).mockResolvedValueOnce(mockOrders);

    const { result } = renderHook(() => useDeliveryOrders(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockOrders);
  });

  it('reports error when fetch fails', async () => {
    const { wrapper, mockDb } = createWrapper();
    (mockDb.orders.findDeliveryOrders as any).mockRejectedValueOnce(new Error('DB error'));

    const { result } = renderHook(() => useDeliveryOrders(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useAssignDeliveryPerson', () => {
  it('calls db.orders.assignDeliveryPerson with orderId and staffId', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useAssignDeliveryPerson());
    await result.current.mutateAsync({ orderId: 'o1', staffId: 's1' });
    expect(mockDb.orders.assignDeliveryPerson).toHaveBeenCalledWith('o1', 's1');
  });

  it('invalidates delivery and order keys on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useAssignDeliveryPerson());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'o1', staffId: 's1' });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDERS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ACTIVE_ORDERS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.DELIVERY_ORDERS]);
  });
});

describe('useUpdateDeliveryFee', () => {
  it('calls db.orders.updateDeliveryFee with orderId and fee', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateDeliveryFee());
    await result.current.mutateAsync({ orderId: 'o1', fee: 5.5 });
    expect(mockDb.orders.updateDeliveryFee).toHaveBeenCalledWith('o1', 5.5);
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
    const { result, mockDb } = renderHookWithProviders(() => useMarkOutForDelivery());
    await result.current.mutateAsync({ orderId: 'o1', deliveryPersonId: 's1' });
    expect(mockDb.orders.markOutForDelivery).toHaveBeenCalledWith('o1', 's1');
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
    const { result, mockDb } = renderHookWithProviders(() => useMarkDelivered());
    await result.current.mutateAsync('o1');
    expect(mockDb.orders.markDelivered).toHaveBeenCalledWith('o1');
  });

  it('invalidates delivery and order keys on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMarkDelivered());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('o1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.DELIVERY_ORDERS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDERS]);
  });
});
