import { describe, expect, it, vi } from 'vitest';
import { QUERY_KEYS, tenantKey } from '../../keys';
import {
  useAddOrderItems,
  useAssignDeliveryPerson,
  useCancelOrder,
  useCancelOrderItem,
  useCleanupEmptyOrders,
  useDeleteOrderItem,
  useMarkDelivered,
  useMarkOutForDelivery,
  useUpdateDeliveryFee,
  useUpdateOrderItemStatus,
  useUpdateOrderNotes,
  useUpdateOrderStatus,
} from '../../mutations/use-order-mutations';
import { renderHookWithProviders, TEST_TENANT_ID } from '../helpers/test-utils';

function getInvalidatedKeys(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.map((c: any) => (c[0] as any).queryKey);
}

describe('useUpdateOrderStatus', () => {
  it('calls db.orders.updateStatus with correct args', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateOrderStatus());
    await result.current.mutateAsync({ id: 'o1', status: 'preparing' });
    expect(mockDb.orders.updateStatus).toHaveBeenCalledWith('o1', 'preparing');
  });

  // M6: a non-terminal transition (e.g. preparing) does NOT touch TABLES —
  // tables only refetch when an order crosses into closed/cancelled.
  it('invalidates ORDERS + ACTIVE_ORDERS but NOT TABLES on a non-terminal status', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateOrderStatus());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({ id: 'o1', status: 'preparing' });
    const keys = getInvalidatedKeys(spy);
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS));
    expect(keys).not.toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
  });

  it('invalidates TABLES when the new status is terminal (closed)', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateOrderStatus());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({ id: 'o1', status: 'closed' });
    const keys = getInvalidatedKeys(spy);
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
  });

  it('propagates errors to caller', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateOrderStatus());
    (mockDb.orders.updateStatus as any).mockRejectedValueOnce(new Error('DB fail'));
    await expect(result.current.mutateAsync({ id: 'o1', status: 'preparing' })).rejects.toThrow(
      'DB fail',
    );
  });

  it('calls onError callback when provided', async () => {
    const onError = vi.fn();
    const { result, mockDb } = renderHookWithProviders(() => useUpdateOrderStatus({ onError }));
    (mockDb.orders.updateStatus as any).mockRejectedValueOnce(new Error('boom'));
    await expect(result.current.mutateAsync({ id: 'o1', status: 'preparing' })).rejects.toThrow();
    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});

// Note: `useAssignWaiter` was moved out of @gustri/queries — assignment is now
// admin-gated via `/api/v1/orders/[id]/assign`, so the hook lives in the
// staff-web app where `apiRoutes` is available. Mobile doesn't expose a
// reassign UI today; if it ever does, promote the hook back here once a
// per-app override pattern is in place.

describe('useCancelOrder', () => {
  it('forwards orderId, reason, and tableId', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCancelOrder());
    await result.current.mutateAsync({ orderId: 'o1', reason: 'duplicate', tableId: 't1' });
    expect(mockDb.orders.cancelOrder).toHaveBeenCalledWith('o1', 'duplicate', 't1');
  });

  it('works without tableId', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCancelOrder());
    await result.current.mutateAsync({ orderId: 'o1', reason: 'duplicate' });
    expect(mockDb.orders.cancelOrder).toHaveBeenCalledWith('o1', 'duplicate', undefined);
  });

  it('invalidates orders + tables on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCancelOrder());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({ orderId: 'o1', reason: 'r' });
    const keys = getInvalidatedKeys(spy);
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
  });
});

describe('useUpdateOrderNotes', () => {
  it('calls db.orders.updateNotes with notes object', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateOrderNotes());
    const notes = { customer_notes: 'no nuts', internal_notes: 'rush' };
    await result.current.mutateAsync({ orderId: 'o1', notes });
    expect(mockDb.orders.updateNotes).toHaveBeenCalledWith('o1', notes);
  });

  it('invalidates the specific order on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateOrderNotes());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({ orderId: 'o-xyz', notes: {} });
    expect(getInvalidatedKeys(spy)).toContainEqual(
      tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDER, 'o-xyz'),
    );
  });
});

describe('useCleanupEmptyOrders', () => {
  it('calls db.orders.cleanupEmptyOrders with optional minutes', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCleanupEmptyOrders());
    await result.current.mutateAsync(60);
    expect(mockDb.orders.cleanupEmptyOrders).toHaveBeenCalledWith(60);
  });

  it('invalidates orders + tables on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCleanupEmptyOrders());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync(undefined);
    const keys = getInvalidatedKeys(spy);
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
  });
});

describe('useAddOrderItems', () => {
  it('calls db.orderItems.create with the items array', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useAddOrderItems());
    const items = [{ order_id: 'o1', menu_item_id: 'm1', quantity: 1 }] as any;
    await result.current.mutateAsync(items);
    expect(mockDb.orderItems.create).toHaveBeenCalledWith(items);
  });

  it('invalidates orders on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useAddOrderItems());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync([] as any);
    expect(getInvalidatedKeys(spy)).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
  });

  it('propagates create errors', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useAddOrderItems());
    (mockDb.orderItems.create as any).mockRejectedValueOnce(new Error('insert failed'));
    await expect(result.current.mutateAsync([] as any)).rejects.toThrow('insert failed');
  });
});

describe('useUpdateOrderItemStatus', () => {
  it('calls updateStatus with id + status', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateOrderItemStatus());
    await result.current.mutateAsync({ id: 'i1', status: 'ready' });
    expect(mockDb.orderItems.updateStatus).toHaveBeenCalledWith('i1', 'ready');
  });
});

describe('useDeleteOrderItem', () => {
  it('calls db.orderItems.delete with id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteOrderItem());
    await result.current.mutateAsync('i1');
    expect(mockDb.orderItems.delete).toHaveBeenCalledWith('i1');
  });
});

describe('useCancelOrderItem', () => {
  it('passes id and cancelQty when provided', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCancelOrderItem());
    await result.current.mutateAsync({ id: 'i1', cancelQty: 2 });
    expect(mockDb.orderItems.cancel).toHaveBeenCalledWith('i1', 2);
  });

  it('passes undefined cancelQty by default', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCancelOrderItem());
    await result.current.mutateAsync({ id: 'i1' });
    expect(mockDb.orderItems.cancel).toHaveBeenCalledWith('i1', undefined);
  });
});

describe('delivery mutations', () => {
  it('useAssignDeliveryPerson forwards orderId and staffId', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useAssignDeliveryPerson());
    await result.current.mutateAsync({ orderId: 'o1', staffId: 's2' });
    expect(mockDb.orders.assignDeliveryPerson).toHaveBeenCalledWith('o1', 's2');
  });

  it('useUpdateDeliveryFee forwards orderId and fee', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateDeliveryFee());
    await result.current.mutateAsync({ orderId: 'o1', fee: 5.5 });
    expect(mockDb.orders.updateDeliveryFee).toHaveBeenCalledWith('o1', 5.5);
  });

  it('useMarkOutForDelivery forwards orderId and deliveryPersonId', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useMarkOutForDelivery());
    await result.current.mutateAsync({ orderId: 'o1', deliveryPersonId: 'd1' });
    expect(mockDb.orders.markOutForDelivery).toHaveBeenCalledWith('o1', 'd1');
  });

  // M6: out_for_delivery is in the delivery flow but NOT terminal — DELIVERY_ORDERS
  // refetches; TABLES does not (delivery orders don't occupy tables).
  it('useMarkOutForDelivery invalidates orders + delivery, leaves tables alone', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMarkOutForDelivery());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({ orderId: 'o1', deliveryPersonId: 'd1' });
    const keys = getInvalidatedKeys(spy);
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.DELIVERY_ORDERS));
    expect(keys).not.toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
  });

  it('useMarkDelivered forwards orderId', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useMarkDelivered());
    await result.current.mutateAsync('o1');
    expect(mockDb.orders.markDelivered).toHaveBeenCalledWith('o1');
  });
});
