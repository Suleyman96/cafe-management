import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import {
  invalidateOrders,
  invalidateOrdersAndTables,
  invalidateStock,
  invalidateWaiterCalls,
} from '../invalidation';
import { QUERY_KEYS } from '../keys';

function createMockQueryClient() {
  const qc = new QueryClient();
  const spy = vi.spyOn(qc, 'invalidateQueries').mockImplementation(() => Promise.resolve());
  return { qc, spy };
}

function getInvalidatedKeys(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.map((c: any) => (c[0] as any).queryKey);
}

describe('invalidateOrders', () => {
  it('invalidates all order list keys', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrders(qc);
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual([QUERY_KEYS.ORDERS]);
    expect(keys).toContainEqual([QUERY_KEYS.ACTIVE_ORDERS]);
    expect(keys).toContainEqual([QUERY_KEYS.DELIVERY_ORDERS]);
    expect(keys).toContainEqual([QUERY_KEYS.TAKEOUT_ORDERS]);
  });

  it('also invalidates specific order when orderId provided', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrders(qc, 'order-123');
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual([QUERY_KEYS.ORDER, 'order-123']);
    expect(keys).toContainEqual([QUERY_KEYS.ORDERS]);
  });

  it('does not invalidate specific order without orderId', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrders(qc);
    const keys = getInvalidatedKeys(spy);

    const orderKeys = keys.filter((k: string[]) => k[0] === QUERY_KEYS.ORDER && k.length > 1);
    expect(orderKeys).toHaveLength(0);
  });
});

describe('invalidateOrdersAndTables', () => {
  it('invalidates orders and tables keys', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrdersAndTables(qc);
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual([QUERY_KEYS.ORDERS]);
    expect(keys).toContainEqual([QUERY_KEYS.ACTIVE_ORDERS]);
    expect(keys).toContainEqual([QUERY_KEYS.TABLES]);
    expect(keys).toContainEqual([QUERY_KEYS.DELIVERY_ORDERS]);
    expect(keys).toContainEqual([QUERY_KEYS.TAKEOUT_ORDERS]);
  });

  it('invalidates specific order when orderId provided', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrdersAndTables(qc, 'order-456');
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual([QUERY_KEYS.ORDER, 'order-456']);
    expect(keys).toContainEqual([QUERY_KEYS.TABLES]);
  });
});

describe('invalidateStock', () => {
  it('invalidates stock item keys', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateStock(qc);
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual([QUERY_KEYS.STOCK_ITEMS]);
    expect(keys).toContainEqual([QUERY_KEYS.LOW_STOCK_COUNT]);
  });

  it('includes movements when requested', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateStock(qc, true);
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual([QUERY_KEYS.STOCK_MOVEMENTS]);
  });

  it('excludes movements by default', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateStock(qc);
    const keys = getInvalidatedKeys(spy);

    const movementKeys = keys.filter((k: string[]) => k[0] === QUERY_KEYS.STOCK_MOVEMENTS);
    expect(movementKeys).toHaveLength(0);
  });
});

describe('invalidateWaiterCalls', () => {
  it('invalidates waiter call keys', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateWaiterCalls(qc);
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual([QUERY_KEYS.WAITER_CALLS]);
    expect(keys).toContainEqual([QUERY_KEYS.WAITER_CALLS_COUNT]);
  });
});
