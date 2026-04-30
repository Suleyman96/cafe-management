import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/notifications', () => ({
  notifyNewOrder: vi.fn(),
  notifyWaiterCall: vi.fn(),
  notifyOrderReady: vi.fn(),
}));

vi.mock('@/lib/sound', () => ({
  playNewOrderSound: vi.fn(),
  playWaiterCallSound: vi.fn(),
}));

import { QUERY_KEYS } from '@gustri/queries';
import {
  useOrder,
  useOrders,
  useUpdateOrderItemStatus,
  useUpdateOrderStatus,
} from '@/hooks/use-orders';
import { createWrapper, renderHookWithProviders } from '../helpers/test-utils';

describe('useOrders', () => {
  it('calls db.orders.findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useOrders());
    expect(mockDb.orders.findAll).toHaveBeenCalled();
  });
});

describe('useOrder', () => {
  it('calls db.orders.findById', () => {
    const { mockDb } = renderHookWithProviders(() => useOrder('o1'));
    expect(mockDb.orders.findById).toHaveBeenCalledWith('o1');
  });
});

describe('useUpdateOrderStatus', () => {
  it('invalidates orders on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateOrderStatus());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'o1', status: 'preparing' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['orders']);
  });
});

describe('useUpdateOrderItemStatus', () => {
  it('invalidates orders on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateOrderItemStatus());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ itemId: 'i1', status: 'preparing' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['orders']);
  });
});

// --- New tests using QUERY_KEYS constants, data flow, argument verification, and error handling ---

describe('useOrders - data flow', () => {
  it('returns fetched orders data', async () => {
    const mockOrders = [{ id: 'o1', status: 'new' }];
    const { wrapper, mockDb } = createWrapper();
    (mockDb.orders.findAll as any).mockResolvedValueOnce(mockOrders);
    const { result } = renderHook(() => useOrders(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(mockOrders));
  });

  it('reports error when findAll rejects', async () => {
    const { wrapper, mockDb } = createWrapper();
    (mockDb.orders.findAll as any).mockRejectedValueOnce(new Error('DB error'));
    const { result } = renderHook(() => useOrders(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateOrderStatus - argument verification', () => {
  it('calls updateStatus with correct args', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateOrderStatus());
    await result.current.mutateAsync({ orderId: 'o1', status: 'preparing' });
    expect(mockDb.orders.updateStatus).toHaveBeenCalledWith('o1', 'preparing');
  });
});

describe('useUpdateOrderStatus - QUERY_KEYS', () => {
  it('invalidates using QUERY_KEYS.ORDERS constant', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateOrderStatus());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'o1', status: 'preparing' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.ORDERS]);
  });
});

describe('useUpdateOrderItemStatus - QUERY_KEYS', () => {
  it('invalidates using QUERY_KEYS.ORDERS constant', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateOrderItemStatus());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ itemId: 'i1', status: 'preparing' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.ORDERS]);
  });
});
