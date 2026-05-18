import { QUERY_KEYS } from '@gustri/queries';
import {
  useAddOrderItems,
  useCancelOrder,
  useCancelOrderItem,
  useCreateOrder,
  useOrder,
} from '@/hooks/use-order';
import { apiRoutes } from '@/lib/api-routes';
import { db, supabase } from '@/lib/supabase';
import { renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('useOrder', () => {
  it('calls supabase.rpc with get_active_order_for_table', () => {
    renderHookWithProviders(() => useOrder('table-1'));
    expect(supabase.rpc).toHaveBeenCalledWith('get_active_order_for_table', {
      p_table_id: 'table-1',
    });
  });

  it('is disabled when tableId is empty', () => {
    renderHookWithProviders(() => useOrder(''));
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('subscribes to a realtime channel keyed by orderId once active order resolves', async () => {
    const mockOrder = { id: 'order-1', table_id: 'table-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockOrder, error: null });

    renderHookWithProviders(() => useOrder('table-1'));

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledWith('order:order-1');
    });
  });

  it('does not subscribe before an active order resolves (H5: avoids cross-customer leak)', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHookWithProviders(() => useOrder('table-1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(supabase.channel).not.toHaveBeenCalled();
  });
});

describe('useCreateOrder', () => {
  it('calls apiRoutes.customerOrders.create with correct shape (no tenant_id — derived server-side, C1)', async () => {
    const { result } = renderHookWithProviders(() => useCreateOrder());

    await result.current.mutateAsync({ tableId: 'table-1', notes: 'No ice' });

    expect(apiRoutes.customerOrders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        table_id: 'table-1',
        order_type: 'dine_in',
        customer_notes: 'No ice',
      }),
    );
    // C1: tenant_id must NOT be sent in the body — staff-web derives it
    // from the table row.
    const payload = (apiRoutes.customerOrders.create as any).mock.calls[0][0];
    expect(payload).not.toHaveProperty('tenant_id');
  });

  it('invalidates ORDER query key scoped to tableId', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateOrder());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ tableId: 'table-1' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.ORDER, 'table-1']);
  });

  it('preserves an explicit client_request_id across user-driven retries (C1)', async () => {
    // The call-site (usePlaceOrder) holds a stable id via
    // `useStableClientRequestId` and threads it through `mutateAsync`.
    // A failed-then-retried submit must reuse that id so the server
    // dedupes via the `(tenant_id, client_request_id)` partial unique
    // index. `onMutate` only mints when the caller doesn't pass one;
    // when one IS passed, it must survive untouched.
    const stableId = '11111111-1111-4111-8111-111111111111';

    (apiRoutes.customerOrders.create as any)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ order: { id: 'order-1', status: 'pending_approval' } });

    const { result } = renderHookWithProviders(() => useCreateOrder());

    await result.current
      .mutateAsync({ tableId: 'table-1', client_request_id: stableId })
      .catch(() => {});
    await result.current.mutateAsync({ tableId: 'table-1', client_request_id: stableId });

    const calls = (apiRoutes.customerOrders.create as any).mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[0][0].client_request_id).toBe(stableId);
    expect(calls[1][0].client_request_id).toBe(stableId);
  });
});

describe('useOrder - H1/H2 channel hooks', () => {
  it('exposes rtStatus and refresh alongside the query (H1/H2)', async () => {
    const mockOrder = { id: 'order-1', table_id: 'table-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockOrder, error: null });

    const { result } = renderHookWithProviders(() => useOrder('table-1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Banner consumer needs both fields. CONNECTING is the startup
    // state — without a real Supabase server the mock never flips it,
    // so we assert presence + initial value, not the transition.
    expect(result.current.rtStatus).toBe('CONNECTING');
    expect(typeof result.current.refresh).toBe('function');
  });

  it('refresh() tears down the channel and refetches (H1 manual recovery)', async () => {
    const mockOrder = { id: 'order-1', table_id: 'table-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValue({ data: mockOrder, error: null });

    const { result } = renderHookWithProviders(() => useOrder('table-1'));

    await waitFor(() => {
      expect((supabase.channel as any).mock.calls.length).toBe(1);
    });

    const removeCountBefore = (supabase.removeChannel as any).mock.calls.length;
    await result.current.refresh();

    // Synchronous teardown — the refresh path doesn't go through the
    // deferred-timer cleanup the unmount path uses.
    expect((supabase.removeChannel as any).mock.calls.length).toBeGreaterThan(removeCountBefore);
  });
});

describe('useCancelOrder', () => {
  // M6: this hook now POSTs through `/api/v1/customer/orders/[id]/cancel`
  // so the staff-web edge limiter and the table-id-match check apply.
  it('calls apiRoutes.customerOrders.cancel with table_id and customer reason', async () => {
    const { result } = renderHookWithProviders(() => useCancelOrder());

    await result.current.mutateAsync({ orderId: 'order-1', tableId: 'table-1' });

    expect(apiRoutes.customerOrders.cancel).toHaveBeenCalledWith('order-1', {
      table_id: 'table-1',
      reason: 'Cancelled by customer',
    });
  });

  it('does NOT call the legacy db.orders.cancelOrder wrapper (M6)', async () => {
    const { result } = renderHookWithProviders(() => useCancelOrder());

    await result.current.mutateAsync({ orderId: 'order-1', tableId: 'table-1' });

    expect(db.orders.cancelOrder).not.toHaveBeenCalled();
  });

  it('invalidates the ORDER query scoped to tableId', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCancelOrder());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'order-1', tableId: 'table-1' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.ORDER, 'table-1']);
  });
});

describe('useCancelOrderItem', () => {
  // C3: per-item cancel now routes through
  // `/api/v1/customer/orders/[id]/items/[itemId]/cancel` so the Upstash
  // limiter and the M6 `table_id`-match check apply on parity with the
  // order-level cancel. Direct `db.orderItems.cancel` is forbidden from
  // the customer-side path.
  it('calls apiRoutes.customerOrders.cancelItem with orderId/itemId/tableId', async () => {
    const { result } = renderHookWithProviders(() => useCancelOrderItem());

    await result.current.mutateAsync({
      orderId: 'order-1',
      itemId: 'item-1',
      tableId: 'table-1',
      cancelQty: 2,
    });

    expect(apiRoutes.customerOrders.cancelItem).toHaveBeenCalledWith('order-1', 'item-1', {
      table_id: 'table-1',
      cancel_qty: 2,
    });
  });

  it('does NOT call the legacy db.orderItems.cancel wrapper (C3)', async () => {
    const { result } = renderHookWithProviders(() => useCancelOrderItem());

    await result.current.mutateAsync({
      orderId: 'order-1',
      itemId: 'item-1',
      tableId: 'table-1',
      cancelQty: 1,
    });

    expect(db.orderItems.cancel).not.toHaveBeenCalled();
  });

  it('passes cancel_qty=null on full cancel (clamped server-side)', async () => {
    const { result } = renderHookWithProviders(() => useCancelOrderItem());

    await result.current.mutateAsync({
      orderId: 'order-1',
      itemId: 'item-1',
      tableId: 'table-1',
    });

    expect(apiRoutes.customerOrders.cancelItem).toHaveBeenCalledWith('order-1', 'item-1', {
      table_id: 'table-1',
      cancel_qty: null,
    });
  });

  it('invalidates all ORDER queries', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCancelOrderItem());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      orderId: 'order-1',
      itemId: 'item-1',
      tableId: 'table-1',
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.ORDER]);
  });
});

describe('useAddOrderItems', () => {
  it('calls apiRoutes.customerOrders.addItems with mapped items', async () => {
    const { result } = renderHookWithProviders(() => useAddOrderItems());

    await result.current.mutateAsync({
      orderId: 'order-1',
      tenantId: 'tenant-1',
      items: [
        { menu_item_id: 'm1', item_name: 'Coffee', item_price: 5, quantity: 1 },
        { menu_item_id: 'm2', item_name: 'Tea', item_price: 3, quantity: 2, notes: 'Hot' },
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
        item_name: 'Coffee',
        item_price: 5,
        quantity: 1,
        notes: null,
        tenant_id: 'tenant-1',
        client_request_id: uuidV4,
      }),
      expect.objectContaining({
        menu_item_id: 'm2',
        item_name: 'Tea',
        item_price: 3,
        quantity: 2,
        notes: 'Hot',
        tenant_id: 'tenant-1',
        client_request_id: uuidV4,
      }),
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
  it('subscribes to orders filtered by id, not table_id (H5)', async () => {
    // A `table_id=eq.${tableId}` filter would also broadcast events for the
    // *next* customer at the same physical table. The narrow `id=eq.` filter
    // pins the subscription to this customer's order.
    const mockOrder = { id: 'order-1', table_id: 'table-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockOrder, error: null });

    renderHookWithProviders(() => useOrder('table-1'));

    await waitFor(() => {
      const channelObj = (supabase.channel as any).mock.results[0]?.value;
      const ordersCall = channelObj?.on.mock.calls.find((c: any[]) => c[1]?.table === 'orders');
      expect(ordersCall?.[1]?.filter).toBe('id=eq.order-1');
    });
  });

  it('subscribes to orders with event: "UPDATE" so customer-own INSERT and impossible DELETE are not echoed (audit fresh-pass)', async () => {
    // The customer's own order INSERT is a single event they themselves
    // triggered (the cart-submit hook already invalidates locally on
    // success). Orders are never DELETE-d. Status UPDATEs are the only
    // realtime traffic the customer cares about.
    const mockOrder = { id: 'order-1', table_id: 'table-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockOrder, error: null });

    renderHookWithProviders(() => useOrder('table-1'));

    await waitFor(() => {
      const channelObj = (supabase.channel as any).mock.results[0]?.value;
      const ordersCall = channelObj?.on.mock.calls.find((c: any[]) => c[1]?.table === 'orders');
      expect(ordersCall?.[1]?.event).toBe('UPDATE');
    });
  });

  it('keeps order_items at event: "*" so waiter-side INSERTs surface to the customer', async () => {
    // Distinct from the orders narrowing above — order_items can receive
    // INSERTs from staff-web (waiter manually adding an item to the
    // customer's order during dine-in) that the customer should see.
    // Narrowing this to UPDATE only would drop those server-side adds.
    const mockOrder = { id: 'order-1', table_id: 'table-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockOrder, error: null });

    renderHookWithProviders(() => useOrder('table-1'));

    await waitFor(() => {
      const channelObj = (supabase.channel as any).mock.results[0]?.value;
      const itemsCall = channelObj?.on.mock.calls.find((c: any[]) => c[1]?.table === 'order_items');
      expect(itemsCall?.[1]?.event).toBe('*');
    });
  });
});

describe('useCancelOrder - scoped invalidation', () => {
  it('invalidates only the specific table query (M6: tableId is required)', async () => {
    // Pre-M6 there was a fallback to [QUERY_KEYS.ORDER] when tableId
    // was omitted, but the new API path requires tableId so the
    // fallback can't trigger. The test for the fallback is gone with
    // the fallback itself.
    const { result, queryClient } = renderHookWithProviders(() => useCancelOrder());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'order-1', tableId: 'table-1' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.ORDER, 'table-1']);
    // Should NOT contain the broad [QUERY_KEYS.ORDER] (without tableId)
    const broadKeys = keys.filter((k: any[]) => k.length === 1 && k[0] === QUERY_KEYS.ORDER);
    expect(broadKeys).toHaveLength(0);
  });
});

// RT2 — iOS App Switcher / rapid Android task-list flips can fire
// three `visibilitychange` events in <500 ms. Pre-fix: each one
// synchronously tore down + reopened the channel, the cleanup timers
// stacked, and the `channelRef.current?.orderId === orderId`
// early-return inside the subscribe effect could skip a reopen that
// should have happened. Post-fix: a 250 ms leading-edge throttle
// collapses the storm to a single resubscribe.
describe('useOrder - RT2 visibility-restore throttle', () => {
  it('collapses three rapid visibility-restore events into one channel reopen', async () => {
    const mockOrder = { id: 'order-1', table_id: 'table-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValue({ data: mockOrder, error: null });

    renderHookWithProviders(() => useOrder('table-1'));

    await waitFor(() => {
      expect((supabase.channel as any).mock.calls.length).toBe(1);
    });

    const channelCallsBefore = (supabase.channel as any).mock.calls.length;

    // Simulate three rapid foreground/background flips. Default jsdom
    // `visibilityState` is 'visible' so dispatching the event with no
    // state change matches the production path.
    for (let i = 0; i < 3; i += 1) {
      document.dispatchEvent(new Event('visibilitychange'));
    }

    // The effect that reopens the channel runs on a state update
    // (resubscribeNonce bump). Flush microtasks/macrotasks.
    await waitFor(() => {
      // Expect exactly ONE new channel open across the three flips,
      // not three. (Total channels = before + 1.)
      expect((supabase.channel as any).mock.calls.length).toBe(channelCallsBefore + 1);
    });
  });
});

describe('useOrder - data flow', () => {
  it('returns fetched order data', async () => {
    const mockOrder = { id: 'o1', table_id: 't1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockOrder, error: null });
    const { result } = renderHookWithProviders(() => useOrder('t1'));
    await waitFor(() => expect(result.current.data).toEqual(mockOrder));
  });

  it('reports error when rpc rejects', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ data: null, error: new Error('DB error') });
    const { result } = renderHookWithProviders(() => useOrder('t1'));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── Realtime Subscription Lifecycle ────────────────────────────────────────

describe('useOrder - realtime lifecycle', () => {
  it('subscribes to order_items when orderId is available', async () => {
    const mockOrder = { id: 'order-1', table_id: 'table-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockOrder, error: null });

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

  it('does not create a realtime channel when no active order exists', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHookWithProviders(() => useOrder('table-1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('creates first channel only once orderId resolves', async () => {
    const mockOrder = { id: 'order-1', table_id: 'table-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockOrder, error: null });

    renderHookWithProviders(() => useOrder('table-1'));

    // Before orderId resolves: no channel.
    expect((supabase.channel as any).mock.calls.length).toBe(0);

    // After orderId resolves: exactly one channel — no broad table-keyed
    // sub during the no-order phase to tear down.
    await waitFor(() => {
      expect((supabase.channel as any).mock.calls.length).toBe(1);
    });
  });

  it('cleans up channel on unmount even with active order', async () => {
    const mockOrder = { id: 'order-1', table_id: 'table-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockOrder, error: null });

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
    // M5: teardown is deferred one macrotask so a synchronous remount can
    // cancel it (strict-mode double-invoke). On a real unmount the timer
    // fires uncontested.
    await waitFor(() => {
      expect((supabase.removeChannel as any).mock.calls.length).toBeGreaterThan(removeCountBefore);
    });
  });

  it('orders channel callback invokes invalidateQueries (debounced — P1)', async () => {
    const mockOrder = { id: 'order-1', table_id: 'table-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockOrder, error: null });

    const { queryClient } = renderHookWithProviders(() => useOrder('table-1'));

    await waitFor(() => {
      const channelObj = (supabase.channel as any).mock.results[0]?.value;
      expect(channelObj?.on.mock.calls.some((c: any[]) => c[1]?.table === 'orders')).toBe(true);
    });

    const channelObj = (supabase.channel as any).mock.results[0].value;
    const ordersCall = channelObj.on.mock.calls.find((c: any[]) => c[1]?.table === 'orders');
    const callback = ordersCall[2];
    expect(callback).toBeTypeOf('function');

    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    // P1 — invalidations are 150ms-debounced now, so the assertion must
    // wait for the trailing-edge fire rather than expecting synchronous.
    callback();
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ queryKey: [QUERY_KEYS.ORDER, 'table-1'] });
    });
  });

  it('coalesces a burst of realtime events into a single invalidation (P1 debounce)', async () => {
    // Staff bulk-edit of 10 items fires 10 events in ~1s; pre-fix that
    // produced 10 invalidations + 10 refetches. The 150ms trailing-edge
    // debounce collapses the storm to one refetch.
    const mockOrder = { id: 'order-1', table_id: 'table-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockOrder, error: null });

    const { queryClient } = renderHookWithProviders(() => useOrder('table-1'));

    await waitFor(() => {
      const channelObj = (supabase.channel as any).mock.results[0]?.value;
      expect(channelObj?.on.mock.calls.some((c: any[]) => c[1]?.table === 'orders')).toBe(true);
    });

    const channelObj = (supabase.channel as any).mock.results[0].value;
    const ordersCall = channelObj.on.mock.calls.find((c: any[]) => c[1]?.table === 'orders');
    const itemsCall = channelObj.on.mock.calls.find((c: any[]) => c[1]?.table === 'order_items');
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    for (let i = 0; i < 10; i += 1) {
      ordersCall[2]();
      itemsCall[2]();
    }

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ queryKey: [QUERY_KEYS.ORDER, 'table-1'] });
    });
    const orderInvalidations = spy.mock.calls.filter(
      (c) =>
        Array.isArray((c[0] as any)?.queryKey) && (c[0] as any).queryKey[0] === QUERY_KEYS.ORDER,
    );
    expect(orderInvalidations.length).toBe(1);
  });

  // ─── M5 — useRef dedupe + deferred teardown ──────────────────────────────
  //
  // The M5 fix has two parts:
  //   1. A useRef dedupe so the effect is a no-op when re-run with the same
  //      orderId (defends against dep-array identity wobble in prod).
  //   2. A setTimeout(0) deferred cleanup so a synchronous remount (React
  //      strict-mode double-invoke in dev, or fast back/forward navigation)
  //      can cancel the teardown via clearTimeout before it fires.
  //
  // Part 2 is exercised below. Part 1 is hard to unit-test in isolation —
  // re-rendering the same hook instance does not re-fire the effect unless
  // a dep changes, and changing the dep would defeat the dedupe by design.
  // A full StrictMode simulation here is too coupled to TanStack Query's
  // strict-mode observer cycle to give a stable signal; the dedupe ref's
  // value is in defending against subtle dep churn we can't easily fabricate.

  it('defers channel teardown one macrotask so a synchronous remount can cancel it (M5)', async () => {
    const mockOrder = { id: 'order-1', table_id: 'table-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockOrder, error: null });

    const { unmount } = renderHookWithProviders(() => useOrder('table-1'));

    await waitFor(() => {
      expect((supabase.channel as any).mock.calls.length).toBe(1);
    });

    const removeCountBefore = (supabase.removeChannel as any).mock.calls.length;
    unmount();
    // Synchronously after unmount the channel must NOT yet be torn down —
    // the cleanup queues a setTimeout(0) so a synchronous remount can
    // cancel it before it fires.
    expect((supabase.removeChannel as any).mock.calls.length).toBe(removeCountBefore);

    // After a macrotask flush the deferred teardown fires.
    await waitFor(() => {
      expect((supabase.removeChannel as any).mock.calls.length).toBeGreaterThan(removeCountBefore);
    });
  });

  // RT1 — the customer's order create resolves, the channel opens for
  // `order:${orderId}`, then a staff-side order_items echo fires
  // BEFORE the order refetch lands. Pre-fix: the realtime callback
  // invalidated against an empty cache, kicking off a redundant
  // refetch (and risking optimistic clobber). Post-fix: the
  // scheduleInvalidate guards on `queryClient.getQueryData(...)` and
  // no-ops when the order isn't yet cached. The populating fetch
  // from the create's `onSuccess` is already queued.
  it('does not invalidate when the local order cache is missing (RT1)', async () => {
    const mockOrder = { id: 'order-1', table_id: 'table-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockOrder, error: null });

    const { queryClient } = renderHookWithProviders(() => useOrder('table-1'));

    await waitFor(() => {
      const channelObj = (supabase.channel as any).mock.results[0]?.value;
      expect(channelObj?.on.mock.calls.some((c: any[]) => c[1]?.table === 'order_items')).toBe(
        true,
      );
    });

    // Drop the cached order to simulate the race: channel is live,
    // local cache empty, item echo about to fire.
    queryClient.removeQueries({ queryKey: [QUERY_KEYS.ORDER, 'table-1'] });

    const channelObj = (supabase.channel as any).mock.results[0].value;
    const itemsCall = channelObj.on.mock.calls.find((c: any[]) => c[1]?.table === 'order_items');
    const ordersCall = channelObj.on.mock.calls.find((c: any[]) => c[1]?.table === 'orders');

    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    itemsCall[2](); // order_items echo with no payload
    ordersCall[2](); // orders UPDATE echo with no payload

    // Wait long enough that the 150ms debounce would have fired if the
    // guard were absent. Assert no invalidation happened.
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(spy).not.toHaveBeenCalled();
  });

  it('order_items channel callback invokes invalidateQueries (debounced — P1)', async () => {
    const mockOrder = { id: 'order-1', table_id: 'table-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockOrder, error: null });

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
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ queryKey: [QUERY_KEYS.ORDER, 'table-1'] });
    });
  });
});
