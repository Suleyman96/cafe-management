import { QUERY_KEYS } from '@gustri/core';
import { describe, expect, it, vi } from 'vitest';
import {
  useActiveOrders,
  useAddOrderItems,
  useAssignWaiter,
  useCancelOrder,
  useCreateOrder,
  useDeleteOrderItem,
  useOrder,
  useOrders,
  useUpdateOrderItemStatus,
  useUpdateOrderNotes,
  useUpdateOrderStatus,
} from '@/hooks/use-orders-safe';
import { apiRoutes } from '@/lib/api-routes';
import { db } from '@/lib/supabase/wrapped-client';
import { renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('useOrders', () => {
  it('uses ORDERS query key', () => {
    const { result } = renderHookWithProviders(() => useOrders());
    expect(result.current.isLoading).toBe(true);
    expect(db.orders.findAll).toHaveBeenCalled();
  });

  it('passes filters to findAll', () => {
    const filters = { status: 'new' as const, table_id: 't1' };
    renderHookWithProviders(() => useOrders(filters));
    expect(db.orders.findAll).toHaveBeenCalledWith(filters);
  });

  it('returns fetched orders data', async () => {
    const mockOrders = [{ id: 'o1', status: 'new', table_id: 't1' }];
    (db.orders.findAll as any).mockResolvedValueOnce(mockOrders);
    const { result } = renderHookWithProviders(() => useOrders());
    await waitFor(() => expect(result.current.data).toEqual(mockOrders));
  });

  it('reports error when findAll rejects', async () => {
    (db.orders.findAll as any).mockRejectedValueOnce(new Error('DB error'));
    const { result } = renderHookWithProviders(() => useOrders());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useOrder', () => {
  it('calls findById with given id', () => {
    renderHookWithProviders(() => useOrder('order-1'));
    expect(db.orders.findById).toHaveBeenCalledWith('order-1');
  });

  it('is disabled when id is empty', () => {
    renderHookWithProviders(() => useOrder(''));
    expect(db.orders.findById).not.toHaveBeenCalled();
  });
});

describe('useActiveOrders', () => {
  it('calls getActiveOrders', () => {
    renderHookWithProviders(() => useActiveOrders());
    expect(db.orders.getActiveOrders).toHaveBeenCalled();
  });
});

describe('useUpdateOrderStatus', () => {
  it('invalidates ORDERS, TABLES, and ACTIVE_ORDERS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateOrderStatus());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'o1', status: 'PREPARING' });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDERS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TABLES]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ACTIVE_ORDERS]);
  });

  it('calls updateStatus with correct status value', async () => {
    const { result } = renderHookWithProviders(() => useUpdateOrderStatus());
    await result.current.mutateAsync({ orderId: 'o1', status: 'PREPARING' });
    expect(db.orders.updateStatus).toHaveBeenCalledWith('o1', 'preparing');
  });
});

describe('useCreateOrder', () => {
  it('invalidates ORDERS and TABLES on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateOrder());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({} as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDERS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TABLES]);
  });

  it('calls apiRoutes.orders.create with order data', async () => {
    const orderData = { table_id: 't1', status: 'new' } as any;
    const { result } = renderHookWithProviders(() => useCreateOrder());
    await result.current.mutateAsync(orderData);
    expect(apiRoutes.orders.create).toHaveBeenCalledWith(orderData);
  });

  it('invalidates ACTIVE_ORDERS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateOrder());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({} as any);
    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ACTIVE_ORDERS]);
  });
});

describe('useAddOrderItems', () => {
  it('invalidates specific ORDER, ORDERS, and ACTIVE_ORDERS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useAddOrderItems());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync([{ order_id: 'o1', menu_item_id: 'm1', quantity: 1 }] as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDER, 'o1']);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDERS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ACTIVE_ORDERS]);
  });
});

describe('useAssignWaiter', () => {
  it('invalidates ORDER, ORDERS, and ACTIVE_ORDERS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useAssignWaiter());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'o1', waiterId: 'w1' });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDER, 'o1']);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDERS]);
  });
});

describe('useCancelOrder', () => {
  it('invalidates ORDERS, ORDER, ACTIVE_ORDERS, and TABLES on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCancelOrder());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'o1', reason: 'test' });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDERS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDER]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ACTIVE_ORDERS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TABLES]);
  });

  it('calls cancelOrder with correct args', async () => {
    const { result } = renderHookWithProviders(() => useCancelOrder());
    await result.current.mutateAsync({ orderId: 'o1', reason: 'test reason', tableId: 't1' });
    expect(db.orders.cancelOrder).toHaveBeenCalledWith('o1', 'test reason', 't1');
  });
});

describe('useUpdateOrderItemStatus', () => {
  it('invalidates ORDERS, ORDER, and ACTIVE_ORDERS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateOrderItemStatus());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ itemId: 'i1', status: 'preparing' as any });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDERS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDER]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ACTIVE_ORDERS]);
  });
});

describe('useDeleteOrderItem', () => {
  it('invalidates ORDERS, ORDER, and ACTIVE_ORDERS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteOrderItem());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('item-1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDERS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDER]);
  });
});

describe('useUpdateOrderNotes', () => {
  it('invalidates specific ORDER, ORDERS, and ACTIVE_ORDERS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateOrderNotes());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'o1', notes: { customer_notes: 'test' } });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDER, 'o1']);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDERS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ACTIVE_ORDERS]);
  });
});
