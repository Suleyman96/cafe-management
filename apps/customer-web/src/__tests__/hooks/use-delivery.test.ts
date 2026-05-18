import { QUERY_KEYS } from '@gustri/queries';
import {
  useAddDeliveryOrderItems,
  useCreateDeliveryOrder,
  useDeliveryOrder,
} from '@/hooks/use-delivery';
import { apiRoutes } from '@/lib/api-routes';
import { supabase } from '@/lib/supabase';
import { renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('useDeliveryOrder', () => {
  it('calls supabase.rpc with get_delivery_order', () => {
    renderHookWithProviders(() => useDeliveryOrder('order-1', 'test-token'));
    expect(supabase.rpc).toHaveBeenCalledWith('get_delivery_order', {
      p_order_id: 'order-1',
      p_access_token: 'test-token',
    });
  });

  it('is disabled when orderId is empty', () => {
    renderHookWithProviders(() => useDeliveryOrder('', 'test-token'));
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('is disabled when accessToken is missing', () => {
    renderHookWithProviders(() => useDeliveryOrder('order-1'));
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('sets up a realtime channel', () => {
    renderHookWithProviders(() => useDeliveryOrder('order-1', 'test-token'));
    expect(supabase.channel).toHaveBeenCalledWith('delivery_order:order-1');
  });

  it('does not set up channel when orderId is empty', () => {
    renderHookWithProviders(() => useDeliveryOrder(''));
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('cleans up realtime channel on unmount', async () => {
    const { unmount } = renderHookWithProviders(() => useDeliveryOrder('order-1'));
    unmount();
    // Audit fix — teardown is now deferred one macrotask (mirrors PR
    // #101's M5 pattern) so a synchronous remount can cancel it. On a
    // real unmount the timer fires uncontested.
    await waitFor(() => {
      expect(supabase.removeChannel).toHaveBeenCalled();
    });
  });

  // ─── M5-style dedupe + UPDATE narrowing (audit fresh-pass) ─────────────────

  it('subscribes to orders with event: "UPDATE" (not "*") so customer-own INSERTs and impossible DELETEs are not echoed', async () => {
    const mockOrder = { id: 'order-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockOrder, error: null });

    renderHookWithProviders(() => useDeliveryOrder('order-1', 'test-token'));

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledWith('delivery_order:order-1');
    });

    const channelObj = (supabase.channel as any).mock.results[0].value;
    const ordersCall = channelObj.on.mock.calls.find((c: any[]) => c[1]?.table === 'orders');
    expect(ordersCall?.[1]?.event).toBe('UPDATE');
  });

  it('keeps order_items at event: "*" so waiter-side INSERTs surface to the customer', async () => {
    const mockOrder = { id: 'order-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockOrder, error: null });

    renderHookWithProviders(() => useDeliveryOrder('order-1', 'test-token'));

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledWith('delivery_order:order-1');
    });

    const channelObj = (supabase.channel as any).mock.results[0].value;
    const itemsCall = channelObj.on.mock.calls.find((c: any[]) => c[1]?.table === 'order_items');
    expect(itemsCall?.[1]?.event).toBe('*');
  });

  it('defers channel teardown one macrotask so a synchronous remount can cancel it (M5 mirror)', async () => {
    const mockOrder = { id: 'order-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockOrder, error: null });

    const { unmount } = renderHookWithProviders(() => useDeliveryOrder('order-1', 'test-token'));

    await waitFor(() => {
      expect((supabase.channel as any).mock.calls.length).toBe(1);
    });

    const removeCountBefore = (supabase.removeChannel as any).mock.calls.length;
    unmount();
    // Synchronously after unmount the channel must NOT yet be torn down
    // — the cleanup queues a setTimeout(0) so a synchronous remount can
    // cancel it. This is the same contract as the dine-in M5 fix in PR
    // #101.
    expect((supabase.removeChannel as any).mock.calls.length).toBe(removeCountBefore);

    await waitFor(() => {
      expect((supabase.removeChannel as any).mock.calls.length).toBeGreaterThan(removeCountBefore);
    });
  });
});

describe('useCreateDeliveryOrder', () => {
  it('calls apiRoutes.customerOrders.create with delivery-specific fields and qr_token (C1)', async () => {
    const { result } = renderHookWithProviders(() => useCreateDeliveryOrder());

    await result.current.mutateAsync({
      customerName: 'John',
      customerPhone: '+994551234567',
      deliveryAddress: '123 Main St',
      deliveryNotes: 'Ring the bell',
      deliveryFee: 5,
      orderNotes: 'Extra napkins',
      qrToken: 'tkn_legit',
    });

    expect(apiRoutes.customerOrders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        qr_token: 'tkn_legit',
        order_type: 'delivery',
        source: 'customer',
        delivery_address: '123 Main St',
        delivery_phone: '+994551234567',
        delivery_customer_name: 'John',
        delivery_fee: 5,
        customer_notes: 'Extra napkins',
      }),
    );
    // C1: tenant_id must NOT be sent in the body — staff-web derives it
    // from the qr_token row.
    const payload = (apiRoutes.customerOrders.create as any).mock.calls[0][0];
    expect(payload).not.toHaveProperty('tenant_id');
  });

  it('passes undefined orderNotes as undefined', async () => {
    const { result } = renderHookWithProviders(() => useCreateDeliveryOrder());

    await result.current.mutateAsync({
      customerName: 'John',
      customerPhone: '+994551234567',
      deliveryAddress: '123 Main St',
      deliveryNotes: '',
      deliveryFee: 0,
      qrToken: 'tkn_legit',
    });

    expect(apiRoutes.customerOrders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        qr_token: 'tkn_legit',
        order_type: 'delivery',
      }),
    );
  });

  it('invalidates DELIVERY_ORDER queries', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateDeliveryOrder());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      customerName: 'John',
      customerPhone: '+994551234567',
      deliveryAddress: '123 Main St',
      deliveryNotes: '',
      deliveryFee: 0,
      qrToken: 'tkn_legit',
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.DELIVERY_ORDER]);
  });
});

// ─── Realtime Callback Invocation ───────────────────────────────────────────

describe('useDeliveryOrder - realtime callback', () => {
  it('orders channel callback invalidates DELIVERY_ORDER query (debounced — P1)', async () => {
    const mockOrder = { id: 'order-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockOrder, error: null });

    // RT1 — provide accessToken so the query actually fetches and the
    // cache holds the order. The realtime invalidate guard (added in
    // RT1) returns early when the cache is empty, so the previous
    // shape of this test — without the token — would no-op.
    const { queryClient } = renderHookWithProviders(() =>
      useDeliveryOrder('order-1', 'test-token'),
    );

    await waitFor(() => {
      expect(queryClient.getQueryData([QUERY_KEYS.DELIVERY_ORDER, 'order-1'])).toEqual(mockOrder);
    });

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledWith('delivery_order:order-1');
    });

    const channelObj = (supabase.channel as any).mock.results[0].value;
    const ordersCall = channelObj.on.mock.calls.find((c: any[]) => c[1]?.table === 'orders');
    const callback = ordersCall[2];
    expect(callback).toBeTypeOf('function');

    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    callback();
    // P1 — 150ms trailing-edge debounce; await rather than expect sync.
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ queryKey: [QUERY_KEYS.DELIVERY_ORDER, 'order-1'] });
    });
  });
});

describe('useAddDeliveryOrderItems', () => {
  it('calls apiRoutes.customerOrders.addItems with mapped items', async () => {
    const { result } = renderHookWithProviders(() => useAddDeliveryOrderItems());

    await result.current.mutateAsync({
      orderId: 'order-1',
      tenantId: 'tenant-1',
      items: [
        { menu_item_id: 'm1', item_name: 'Pizza', item_price: 12, quantity: 1 },
        { menu_item_id: 'm2', item_name: 'Salad', item_price: 8, quantity: 1, notes: 'No onions' },
      ],
    });

    // Hook stamps a per-item `client_request_id` (Blocker 1) so React
    // Query retries dedupe against the partial-unique index.
    const uuidV4 = expect.stringMatching(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(apiRoutes.customerOrders.addItems).toHaveBeenCalledWith('order-1', [
      expect.objectContaining({
        menu_item_id: 'm1',
        item_name: 'Pizza',
        item_price: 12,
        quantity: 1,
        notes: null,
        tenant_id: 'tenant-1',
        client_request_id: uuidV4,
      }),
      expect.objectContaining({
        menu_item_id: 'm2',
        item_name: 'Salad',
        item_price: 8,
        quantity: 1,
        notes: 'No onions',
        tenant_id: 'tenant-1',
        client_request_id: uuidV4,
      }),
    ]);
  });

  it('invalidates DELIVERY_ORDER queries', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useAddDeliveryOrderItems());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      orderId: 'order-1',
      tenantId: 'tenant-1',
      items: [{ menu_item_id: 'm1', item_name: 'Pizza', item_price: 12, quantity: 1 }],
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.DELIVERY_ORDER]);
  });
});
