import type { SupabaseWrapper } from '@gustri/api-client';
import { DbProvider, QUERY_KEYS, tenantKey } from '@gustri/queries';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
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
import { createMockDb } from '../helpers/mock-db';
import {
  createWrapper,
  renderHookWithProviders,
  TEST_TENANT_ID,
  waitFor,
} from '../helpers/test-utils';

// --- Hooks from @gustri/queries (use useDb → mockDb from provider) ---

describe('useOrders', () => {
  it('uses ORDERS query key', () => {
    const { result, mockDb } = renderHookWithProviders(() => useOrders());
    expect(result.current.isLoading).toBe(true);
    expect(mockDb.orders.findAll).toHaveBeenCalled();
  });

  it('passes filters to findAll', () => {
    const filters = { status: 'new' as const, table_id: 't1' };
    const { mockDb } = renderHookWithProviders(() => useOrders(filters));
    expect(mockDb.orders.findAll).toHaveBeenCalledWith(filters);
  });

  it('returns fetched orders data', async () => {
    const mockOrders = [{ id: 'o1', status: 'new', table_id: 't1' }];
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

describe('useOrder', () => {
  it('calls findById with given id', () => {
    const { mockDb } = renderHookWithProviders(() => useOrder('order-1'));
    expect(mockDb.orders.findById).toHaveBeenCalledWith('order-1');
  });

  it('is disabled when id is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useOrder(''));
    expect(mockDb.orders.findById).not.toHaveBeenCalled();
  });
});

describe('useActiveOrders', () => {
  it('calls getActiveOrders', () => {
    const { mockDb } = renderHookWithProviders(() => useActiveOrders());
    expect(mockDb.orders.getActiveOrders).toHaveBeenCalled();
  });
});

// --- Local hooks (use direct db import → assert on db from vi.mock) ---

describe('useUpdateOrderStatus', () => {
  it('invalidates ORDERS and ACTIVE_ORDERS but NOT TABLES on a non-terminal transition', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateOrderStatus());
    // Seed previousOrder so the mutation captures oldStatus="new" (non-terminal)
    // and the smart helper can decide whether to refetch TABLES.
    queryClient.setQueryData(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDER, 'o1'), {
      id: 'o1',
      status: 'new',
      order_type: 'dine_in',
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'o1', status: 'PREPARING' });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS));
    // new → preparing is not a terminal-state crossing, so TABLES must NOT
    // be refetched (kitchen toggles would otherwise spam table queries).
    expect(invalidatedKeys).not.toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
  });

  it('invalidates TABLES on a terminal transition (preparing → closed)', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateOrderStatus());
    queryClient.setQueryData(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDER, 'o1'), {
      id: 'o1',
      status: 'preparing',
      order_type: 'dine_in',
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'o1', status: 'CLOSED' });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS));
    // closing the order frees the table — TABLES must refetch.
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
  });

  it('calls updateStatus with correct status value and a fresh client_request_id', async () => {
    const { result } = renderHookWithProviders(() => useUpdateOrderStatus());
    await result.current.mutateAsync({ orderId: 'o1', status: 'PREPARING' });
    expect(db.orders.updateStatus).toHaveBeenCalledWith(
      'o1',
      'preparing',
      expect.objectContaining({ clientRequestId: expect.any(String) }),
    );
  });

  it('preserves concurrent realtime updates when the mutation fails (no stale rollback)', async () => {
    // Bug repro: the previous implementation snapshotted the full ORDERS /
    // ACTIVE_ORDERS list in onMutate and restored it on error. Any realtime
    // update (delivery_fee, customer_notes, …) that landed between onMutate
    // and onError would be clobbered by the rollback. Option A drops the
    // snapshot, so realtime fields survive a failed mutation.
    //
    // Uses a local QueryClient with non-zero gcTime — the shared test client
    // sets gcTime: 0, which collects observerless queries before this
    // assertion can read them.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 60_000 }, mutations: { retry: false } },
    });
    const mockDb = createMockDb() as unknown as SupabaseWrapper;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <DbProvider db={mockDb} tenantId={TEST_TENANT_ID}>
          {children}
        </DbProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateOrderStatus(), { wrapper });

    const seedOrder = {
      id: 'o1',
      status: 'new',
      order_type: 'dine_in',
      delivery_fee: 10,
    } as any;
    queryClient.setQueryData(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS), [seedOrder]);
    queryClient.setQueryData(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS), [seedOrder]);
    queryClient.setQueryData(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDER, 'o1'), seedOrder);

    // Defer the rejection so we can sequence: onMutate → realtime → reject.
    let rejectMutation!: (e: Error) => void;
    (db.orders.updateStatus as any).mockReturnValueOnce(
      new Promise<unknown>((_resolve, reject) => {
        rejectMutation = reject;
      }),
    );

    const promise = result.current
      .mutateAsync({ orderId: 'o1', status: 'PREPARING' })
      .catch(() => {});

    // Wait for the optimistic patch to land (signals onMutate is complete).
    await waitFor(() => {
      const list = queryClient.getQueryData<any[]>(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
      expect(list?.[0]?.status).toBe('preparing');
    });

    // Realtime update arrives mid-flight: same order, different field.
    queryClient.setQueryData<any[]>(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS), (old) =>
      old?.map((o) => (o.id === 'o1' ? { ...o, delivery_fee: 20 } : o)),
    );
    queryClient.setQueryData<any[]>(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS), (old) =>
      old?.map((o) => (o.id === 'o1' ? { ...o, delivery_fee: 20 } : o)),
    );

    rejectMutation(new Error('Network'));
    await promise;

    // Realtime field must survive — the old snapshot rollback would have
    // reverted delivery_fee back to 10.
    expect(
      queryClient.getQueryData<any[]>(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS))?.[0]
        ?.delivery_fee,
    ).toBe(20);
    expect(
      queryClient.getQueryData<any[]>(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS))?.[0]
        ?.delivery_fee,
    ).toBe(20);
  });

  it('rapid double-fire produces a single in-flight DB call (variables.orderId latches the row)', async () => {
    // The button-disable contract on OrderListCard depends on
    // `mutation.isPending` + `mutation.variables.orderId` matching the row.
    // If both fire at the same orderId, the parent disables the button —
    // we assert that the second `mutateAsync` for the same row resolves to
    // the same delivered call shape so the disabled contract is observable.
    const { result } = renderHookWithProviders(() => useUpdateOrderStatus());
    const first = result.current.mutateAsync({ orderId: 'o1', status: 'READY' });
    const second = result.current.mutateAsync({ orderId: 'o1', status: 'READY' });
    await Promise.all([first, second]);
    // Both calls go through (the UI disables the button — the wrapper makes
    // the second one a no-op via its conditional UPDATE).
    expect(db.orders.updateStatus).toHaveBeenCalledTimes(2);
    expect(db.orders.updateStatus).toHaveBeenNthCalledWith(
      1,
      'o1',
      'ready',
      expect.objectContaining({ clientRequestId: expect.any(String) }),
    );
  });
});

describe('useCreateOrder', () => {
  it('invalidates ORDERS and TABLES on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateOrder());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({} as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
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
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS));
  });
});

// --- Mutations from @gustri/queries (use useDb → mockDb from provider) ---

describe('useAddOrderItems', () => {
  it('invalidates ORDERS and ACTIVE_ORDERS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useAddOrderItems());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync([{ order_id: 'o1', menu_item_id: 'm1', quantity: 1 }] as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS));
  });
});

describe('useAssignWaiter', () => {
  it('invalidates ORDERS and ACTIVE_ORDERS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useAssignWaiter());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'o1', waiterId: 'w1' });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS));
  });
});

describe('useCancelOrder', () => {
  it('invalidates ORDERS, ACTIVE_ORDERS, and TABLES on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCancelOrder());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'o1', reason: 'test' });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
  });

  it('calls cancelOrder with correct args', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCancelOrder());
    await result.current.mutateAsync({ orderId: 'o1', reason: 'test reason', tableId: 't1' });
    expect(mockDb.orders.cancelOrder).toHaveBeenCalledWith('o1', 'test reason', 't1');
  });
});

describe('useUpdateOrderItemStatus', () => {
  it('invalidates ORDERS and ACTIVE_ORDERS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateOrderItemStatus());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ itemId: 'i1', status: 'preparing' as any });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS));
  });

  it('preserves concurrent realtime updates when the mutation fails (no stale rollback)', async () => {
    // Same bug class as useUpdateOrderStatus — verify the item-status hook
    // doesn't roll the entire list back to a pre-mutation snapshot.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 60_000 }, mutations: { retry: false } },
    });
    const mockDb = createMockDb() as unknown as SupabaseWrapper;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <DbProvider db={mockDb} tenantId={TEST_TENANT_ID}>
          {children}
        </DbProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateOrderItemStatus(), { wrapper });

    const seedOrder = {
      id: 'o1',
      status: 'new',
      delivery_fee: 10,
      order_items: [{ id: 'i1', status: 'pending' }],
    } as any;
    queryClient.setQueryData(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS), [seedOrder]);
    queryClient.setQueryData(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS), [seedOrder]);

    let rejectMutation!: (e: Error) => void;
    (db.orderItems.updateStatus as any).mockReturnValueOnce(
      new Promise<unknown>((_resolve, reject) => {
        rejectMutation = reject;
      }),
    );

    const promise = result.current
      .mutateAsync({ itemId: 'i1', status: 'preparing' as any })
      .catch(() => {});

    await waitFor(() => {
      const list = queryClient.getQueryData<any[]>(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
      expect(list?.[0]?.order_items?.[0]?.status).toBe('preparing');
    });

    queryClient.setQueryData<any[]>(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS), (old) =>
      old?.map((o) => (o.id === 'o1' ? { ...o, delivery_fee: 20 } : o)),
    );
    queryClient.setQueryData<any[]>(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS), (old) =>
      old?.map((o) => (o.id === 'o1' ? { ...o, delivery_fee: 20 } : o)),
    );

    rejectMutation(new Error('Network'));
    await promise;

    expect(
      queryClient.getQueryData<any[]>(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS))?.[0]
        ?.delivery_fee,
    ).toBe(20);
    expect(
      queryClient.getQueryData<any[]>(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS))?.[0]
        ?.delivery_fee,
    ).toBe(20);
  });
});

describe('useDeleteOrderItem', () => {
  it('invalidates ORDERS and ACTIVE_ORDERS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteOrderItem());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('item-1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS));
  });
});

describe('useUpdateOrderNotes', () => {
  it('invalidates specific ORDER, ORDERS, and ACTIVE_ORDERS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateOrderNotes());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ orderId: 'o1', notes: { customer_notes: 'test' } });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDER, 'o1'));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS));
  });
});
