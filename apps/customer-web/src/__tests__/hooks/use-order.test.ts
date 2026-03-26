import { QUERY_KEYS } from '@cafe-idare/core';
import {
  useAddOrderItems,
  useCancelOrder,
  useCancelOrderItem,
  useCreateOrder,
  useOrder,
} from '@/hooks/use-order';
import { db, supabase } from '@/lib/supabase';
import { renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('useOrder', () => {
  it('calls db.orders.findActiveByTable with tableId', () => {
    renderHookWithProviders(() => useOrder('table-1'));
    expect(db.orders.findActiveByTable).toHaveBeenCalledWith('table-1');
  });

  it('is disabled when tableId is empty', () => {
    renderHookWithProviders(() => useOrder(''));
    expect(db.orders.findActiveByTable).not.toHaveBeenCalled();
  });

  it('sets up a realtime channel', () => {
    renderHookWithProviders(() => useOrder('table-1'));
    expect(supabase.channel).toHaveBeenCalledWith('orders:table_table-1');
  });

  it('cleans up realtime channel on unmount', () => {
    const { unmount } = renderHookWithProviders(() => useOrder('table-1'));
    unmount();
    expect(supabase.removeChannel).toHaveBeenCalled();
  });
});

describe('useCreateOrder', () => {
  it('calls db.orders.create with correct shape', async () => {
    const { result } = renderHookWithProviders(() => useCreateOrder());

    await result.current.mutateAsync({ tableId: 'table-1', notes: 'No ice' });

    expect(db.orders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        table_id: 'table-1',
        customer_notes: 'No ice',
        status: 'pending_approval',
        source: 'customer',
        subtotal: 0,
        tax: 0,
        total: 0,
      }),
    );
  });

  it('invalidates ORDER query key scoped to tableId', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateOrder());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ tableId: 'table-1' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.ORDER, 'table-1']);
  });
});

describe('useCancelOrder', () => {
  it('calls db.orders.cancelOrder with customer reason', async () => {
    const { result } = renderHookWithProviders(() => useCancelOrder());

    await result.current.mutateAsync({ orderId: 'order-1', tableId: 'table-1' });

    expect(db.orders.cancelOrder).toHaveBeenCalledWith(
      'order-1',
      'Cancelled by customer',
      'table-1',
    );
  });

  it('invalidates all ORDER queries', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCancelOrder());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'order-1' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.ORDER]);
  });
});

describe('useCancelOrderItem', () => {
  it('calls db.orderItems.cancel with itemId and quantity', async () => {
    const { result } = renderHookWithProviders(() => useCancelOrderItem());

    await result.current.mutateAsync({ itemId: 'item-1', cancelQty: 2 });

    expect(db.orderItems.cancel).toHaveBeenCalledWith('item-1', 2);
  });

  it('invalidates all ORDER queries', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCancelOrderItem());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ itemId: 'item-1' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.ORDER]);
  });
});

describe('useAddOrderItems', () => {
  it('maps notes undefined to null and sets status to pending', async () => {
    const { result } = renderHookWithProviders(() => useAddOrderItems());

    await result.current.mutateAsync({
      orderId: 'order-1',
      items: [
        { menu_item_id: 'm1', item_name: 'Coffee', item_price: 5, quantity: 1 },
        { menu_item_id: 'm2', item_name: 'Tea', item_price: 3, quantity: 2, notes: 'Hot' },
      ],
    });

    expect(db.orderItems.create).toHaveBeenCalledWith([
      {
        order_id: 'order-1',
        menu_item_id: 'm1',
        item_name: 'Coffee',
        item_price: 5,
        quantity: 1,
        notes: null,
        status: 'pending',
      },
      {
        order_id: 'order-1',
        menu_item_id: 'm2',
        item_name: 'Tea',
        item_price: 3,
        quantity: 2,
        notes: 'Hot',
        status: 'pending',
      },
    ]);
  });

  it('invalidates all ORDER queries', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useAddOrderItems());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      orderId: 'order-1',
      items: [{ menu_item_id: 'm1', item_name: 'Coffee', item_price: 5, quantity: 1 }],
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.ORDER]);
  });
});

// --- Bug fix regression tests ---

describe('useOrder - realtime filter', () => {
  it('subscribes to orders channel filtered by tableId', () => {
    renderHookWithProviders(() => useOrder('table-1'));

    // Verify the .on() call for orders table includes the filter
    const onCalls = (supabase as any).channelObj?.on.mock?.calls;
    if (onCalls) {
      const ordersCall = onCalls.find((c: any[]) => c[1]?.table === 'orders');
      expect(ordersCall?.[1]?.filter).toBe('table_id=eq.table-1');
    }
  });
});

describe('useCancelOrder - scoped invalidation', () => {
  it('invalidates only the specific table query when tableId is provided', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCancelOrder());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'order-1', tableId: 'table-1' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.ORDER, 'table-1']);
    // Should NOT contain the broad [QUERY_KEYS.ORDER] (without tableId)
    const broadKeys = keys.filter((k: any[]) => k.length === 1 && k[0] === QUERY_KEYS.ORDER);
    expect(broadKeys).toHaveLength(0);
  });

  it('falls back to broad invalidation when tableId is not provided', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCancelOrder());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'order-1' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.ORDER]);
  });
});

describe('useOrder - data flow', () => {
  it('returns fetched order data', async () => {
    const mockOrder = { id: 'o1', table_id: 't1', status: 'new', items: [] };
    (db.orders.findActiveByTable as any).mockResolvedValueOnce(mockOrder);
    const { result } = renderHookWithProviders(() => useOrder('t1'));
    await waitFor(() => expect(result.current.data).toEqual(mockOrder));
  });

  it('reports error when findActiveByTable rejects', async () => {
    (db.orders.findActiveByTable as any).mockRejectedValueOnce(new Error('DB error'));
    const { result } = renderHookWithProviders(() => useOrder('t1'));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
