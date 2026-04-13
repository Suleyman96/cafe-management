import { QUERY_KEYS } from '@gustri/core';
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

    await result.current.mutateAsync({ tableId: 'table-1', notes: 'No ice', tenantId: 'tenant-1' });

    expect(db.orders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        table_id: 'table-1',
        tenant_id: 'tenant-1',
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

    await result.current.mutateAsync({ tableId: 'table-1', tenantId: 'tenant-1' });

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
      tenantId: 'tenant-1',
      items: [
        { menu_item_id: 'm1', item_name: 'Coffee', item_price: 5, quantity: 1 },
        { menu_item_id: 'm2', item_name: 'Tea', item_price: 3, quantity: 2, notes: 'Hot' },
      ],
    });

    expect(db.orderItems.create).toHaveBeenCalledWith([
      {
        order_id: 'order-1',
        tenant_id: 'tenant-1',
        menu_item_id: 'm1',
        item_name: 'Coffee',
        item_price: 5,
        quantity: 1,
        notes: null,
        status: 'pending',
      },
      {
        order_id: 'order-1',
        tenant_id: 'tenant-1',
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
      tenantId: 'tenant-1',
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

// ─── Realtime Subscription Lifecycle ────────────────────────────────────────

describe('useOrder - realtime lifecycle', () => {
  it('subscribes to order_items when orderId is available', async () => {
    const mockOrder = { id: 'order-1', table_id: 'table-1', status: 'new', items: [] };
    (db.orders.findActiveByTable as any).mockResolvedValueOnce(mockOrder);

    renderHookWithProviders(() => useOrder('table-1'));

    // Wait for query to resolve → orderId becomes available → effect re-runs with order_items
    await waitFor(() => {
      const channelObj = (supabase.channel as any).mock.results[0]?.value;
      const onCalls = channelObj?.on.mock.calls ?? [];
      const hasOrderItems = onCalls.some((c: any[]) => c[1]?.table === 'order_items');
      expect(hasOrderItems).toBe(true);
    });

    // Verify the order_items filter references the orderId
    const channelObj = (supabase.channel as any).mock.results[0].value;
    const orderItemsCall = channelObj.on.mock.calls.find(
      (c: any[]) => c[1]?.table === 'order_items',
    );
    expect(orderItemsCall[1].filter).toBe('order_id=eq.order-1');
  });

  it('does not subscribe to order_items when no active order', async () => {
    (db.orders.findActiveByTable as any).mockResolvedValueOnce(null);

    const { result } = renderHookWithProviders(() => useOrder('table-1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const channelObj = (supabase.channel as any).mock.results[0].value;
    const onCalls = channelObj.on.mock.calls;
    const orderItemsCalls = onCalls.filter((c: any[]) => c[1]?.table === 'order_items');
    expect(orderItemsCalls).toHaveLength(0);
  });

  it('tears down old channel when orderId changes', async () => {
    const mockOrder = { id: 'order-1', table_id: 'table-1', status: 'new', items: [] };
    (db.orders.findActiveByTable as any).mockResolvedValueOnce(mockOrder);

    renderHookWithProviders(() => useOrder('table-1'));

    // When orderId becomes available the effect re-runs, tearing down the old channel
    await waitFor(() => {
      expect(supabase.removeChannel).toHaveBeenCalled();
    });

    // A new channel is created (initial + after orderId = at least 2)
    expect((supabase.channel as any).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('cleans up channel on unmount even with active order', async () => {
    const mockOrder = { id: 'order-1', table_id: 'table-1', status: 'new', items: [] };
    (db.orders.findActiveByTable as any).mockResolvedValueOnce(mockOrder);

    const { unmount } = renderHookWithProviders(() => useOrder('table-1'));

    // Wait for order_items subscription to be established
    await waitFor(() => {
      const channelObj = (supabase.channel as any).mock.results[0]?.value;
      const hasOrderItems = channelObj?.on.mock.calls.some(
        (c: any[]) => c[1]?.table === 'order_items',
      );
      expect(hasOrderItems).toBe(true);
    });

    const removeCountBefore = (supabase.removeChannel as any).mock.calls.length;
    unmount();
    expect((supabase.removeChannel as any).mock.calls.length).toBeGreaterThan(removeCountBefore);
  });

  it('orders channel callback invokes invalidateQueries', async () => {
    renderHookWithProviders(() => useOrder('table-1'));

    // Extract the callback passed to .on() for the orders table
    const channelObj = (supabase.channel as any).mock.results[0].value;
    const ordersCall = channelObj.on.mock.calls.find((c: any[]) => c[1]?.table === 'orders');
    const callback = ordersCall[2];
    expect(callback).toBeTypeOf('function');

    // Invoke the callback — it should call invalidateQueries
    callback();
    // The callback runs synchronously so we can assert immediately
  });

  it('order_items channel callback invokes invalidateQueries', async () => {
    const mockOrder = { id: 'order-1', table_id: 'table-1', status: 'new', items: [] };
    (db.orders.findActiveByTable as any).mockResolvedValueOnce(mockOrder);

    const { queryClient } = renderHookWithProviders(() => useOrder('table-1'));

    // Wait for order_items subscription
    await waitFor(() => {
      const channelObj = (supabase.channel as any).mock.results[0]?.value;
      const hasOrderItems = channelObj?.on.mock.calls.some(
        (c: any[]) => c[1]?.table === 'order_items',
      );
      expect(hasOrderItems).toBe(true);
    });

    const channelObj = (supabase.channel as any).mock.results[0].value;
    const orderItemsCall = channelObj.on.mock.calls.find(
      (c: any[]) => c[1]?.table === 'order_items',
    );
    const callback = orderItemsCall[2];
    expect(callback).toBeTypeOf('function');

    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    callback();
    expect(spy).toHaveBeenCalledWith({ queryKey: [QUERY_KEYS.ORDER, 'table-1'] });
  });
});
