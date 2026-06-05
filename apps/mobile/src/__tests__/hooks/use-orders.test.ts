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

describe('mobile order optimistic updates (ADD-5)', () => {
  const seed = (queryClient: any) =>
    queryClient.setQueryData(
      [QUERY_KEYS.ORDERS],
      [
        { id: 'o1', status: 'new', order_items: [{ id: 'i1', status: 'pending' }] },
        { id: 'o2', status: 'new', order_items: [] },
      ],
    );

  it('useUpdateOrderStatus flips status in the cache before the network resolves', async () => {
    const { wrapper, queryClient, mockDb } = createWrapper();
    seed(queryClient);
    let cached: any[] | undefined;
    (mockDb.orders.updateStatus as any).mockImplementationOnce(async () => {
      cached = queryClient.getQueryData([QUERY_KEYS.ORDERS]);
      return { id: 'o1' };
    });

    const { result } = renderHook(() => useUpdateOrderStatus(), { wrapper });
    await result.current.mutateAsync({ orderId: 'o1', status: 'preparing' });

    expect(cached?.find((o) => o.id === 'o1')?.status).toBe('preparing');
    expect(cached?.find((o) => o.id === 'o2')?.status).toBe('new');
  });

  it('useUpdateOrderStatus rolls back on error', async () => {
    const { wrapper, queryClient, mockDb } = createWrapper();
    seed(queryClient);
    (mockDb.orders.updateStatus as any).mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useUpdateOrderStatus(), { wrapper });
    await expect(
      result.current.mutateAsync({ orderId: 'o1', status: 'preparing' }),
    ).rejects.toThrow('boom');

    expect(
      (queryClient.getQueryData([QUERY_KEYS.ORDERS]) as any[]).find((o) => o.id === 'o1').status,
    ).toBe('new');
  });

  it('useUpdateOrderItemStatus patches the item then rolls back on error', async () => {
    const { wrapper, queryClient, mockDb } = createWrapper();
    seed(queryClient);
    let cached: any[] | undefined;
    (mockDb.orderItems.updateStatus as any).mockImplementationOnce(async () => {
      cached = queryClient.getQueryData([QUERY_KEYS.ORDERS]);
      return { id: 'i1' };
    });

    const { result } = renderHook(() => useUpdateOrderItemStatus(), { wrapper });
    await result.current.mutateAsync({ itemId: 'i1', status: 'ready' });
    expect(cached?.find((o) => o.id === 'o1')?.order_items[0].status).toBe('ready');

    (mockDb.orderItems.updateStatus as any).mockRejectedValueOnce(new Error('x'));
    const { result: r2 } = renderHook(() => useUpdateOrderItemStatus(), { wrapper });
    await expect(r2.current.mutateAsync({ itemId: 'i1', status: 'served' })).rejects.toThrow('x');
    expect(
      (queryClient.getQueryData([QUERY_KEYS.ORDERS]) as any[]).find((o) => o.id === 'o1')
        .order_items[0].status,
    ).toBe('ready');
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
