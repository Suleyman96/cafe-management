import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  useActiveOrders,
  useDeliveryOrders,
  useOrder,
  useOrders,
  useTakeoutOrders,
} from '../../hooks/use-orders';
import { QUERY_KEYS } from '../../keys';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useOrders', () => {
  it('calls db.orders.findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useOrders());
    expect(mockDb.orders.findAll).toHaveBeenCalled();
  });

  it('forwards filters to findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useOrders({ status: 'new' }));
    expect(mockDb.orders.findAll).toHaveBeenCalledWith({ status: 'new' });
  });

  it('returns data from db', async () => {
    const { result } = renderHookWithProviders(() => useOrders());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Default mock returns []
    expect(result.current.data).toEqual([]);
  });
});

describe('useOrder', () => {
  it('calls db.orders.findById with the id', () => {
    const { mockDb } = renderHookWithProviders(() => useOrder('o1'));
    expect(mockDb.orders.findById).toHaveBeenCalledWith('o1');
  });

  it('is disabled when orderId is empty', () => {
    const { mockDb, result } = renderHookWithProviders(() => useOrder(''));
    expect(mockDb.orders.findById).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useActiveOrders', () => {
  it('uses ACTIVE_ORDERS query key', async () => {
    const { mockDb, queryClient } = renderHookWithProviders(() => useActiveOrders());
    await waitFor(() => expect(mockDb.orders.getActiveOrders).toHaveBeenCalled());
    expect(
      queryClient.getQueryCache().findAll({ queryKey: [QUERY_KEYS.ACTIVE_ORDERS] }),
    ).toHaveLength(1);
  });
});

describe('useDeliveryOrders', () => {
  it('calls db.orders.findDeliveryOrders', () => {
    const { mockDb } = renderHookWithProviders(() => useDeliveryOrders());
    expect(mockDb.orders.findDeliveryOrders).toHaveBeenCalled();
  });
});

describe('useTakeoutOrders', () => {
  it('calls db.orders.findTakeoutOrders', () => {
    const { mockDb } = renderHookWithProviders(() => useTakeoutOrders());
    expect(mockDb.orders.findTakeoutOrders).toHaveBeenCalled();
  });
});
