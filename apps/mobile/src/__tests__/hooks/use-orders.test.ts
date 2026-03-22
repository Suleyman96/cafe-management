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

import {
  useOrder,
  useOrders,
  useUpdateOrderItemStatus,
  useUpdateOrderStatus,
} from '@/hooks/use-orders';
import { db } from '@/lib/supabase';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useOrders', () => {
  it('calls db.orders.findAll', () => {
    renderHookWithProviders(() => useOrders());
    expect(db.orders.findAll).toHaveBeenCalled();
  });
});

describe('useOrder', () => {
  it('calls db.orders.findById', () => {
    renderHookWithProviders(() => useOrder('o1'));
    expect(db.orders.findById).toHaveBeenCalledWith('o1');
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
