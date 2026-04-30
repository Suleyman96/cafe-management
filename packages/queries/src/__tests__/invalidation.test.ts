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
  it('invalidates the conservative pre-M6 superset when no transition info is given', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrdersAndTables(qc);
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual([QUERY_KEYS.ORDERS]);
    expect(keys).toContainEqual([QUERY_KEYS.ACTIVE_ORDERS]);
    expect(keys).toContainEqual([QUERY_KEYS.TABLES]);
    expect(keys).toContainEqual([QUERY_KEYS.DELIVERY_ORDERS]);
    expect(keys).toContainEqual([QUERY_KEYS.TAKEOUT_ORDERS]);
  });

  it('invalidates the specific order when orderId is in the transition', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrdersAndTables(qc, { orderId: 'order-456' });
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual([QUERY_KEYS.ORDER, 'order-456']);
  });

  it('does NOT invalidate TABLES on a non-terminal status transition (preparing → ready)', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrdersAndTables(qc, {
      oldStatus: 'preparing',
      newStatus: 'ready',
      oldType: 'dine_in',
    });
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual([QUERY_KEYS.ORDERS]);
    expect(keys).toContainEqual([QUERY_KEYS.ACTIVE_ORDERS]);
    expect(keys).not.toContainEqual([QUERY_KEYS.TABLES]);
    expect(keys).not.toContainEqual([QUERY_KEYS.DELIVERY_ORDERS]);
    expect(keys).not.toContainEqual([QUERY_KEYS.TAKEOUT_ORDERS]);
  });

  it('DOES invalidate TABLES when the transition crosses into a terminal state (served → closed)', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrdersAndTables(qc, {
      oldStatus: 'served',
      newStatus: 'closed',
      oldType: 'dine_in',
    });
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual([QUERY_KEYS.TABLES]);
  });

  it('DOES invalidate TABLES on cancellation (preparing → cancelled)', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrdersAndTables(qc, {
      oldStatus: 'preparing',
      newStatus: 'cancelled',
    });
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual([QUERY_KEYS.TABLES]);
  });

  it('invalidates DELIVERY_ORDERS when status enters the delivery flow', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrdersAndTables(qc, {
      oldStatus: 'ready',
      newStatus: 'out_for_delivery',
      newType: 'delivery',
    });
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual([QUERY_KEYS.DELIVERY_ORDERS]);
    expect(keys).not.toContainEqual([QUERY_KEYS.TAKEOUT_ORDERS]);
  });

  it('invalidates TAKEOUT_ORDERS only when type === takeout', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrdersAndTables(qc, {
      oldStatus: 'preparing',
      newStatus: 'ready',
      oldType: 'takeout',
      newType: 'takeout',
    });
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual([QUERY_KEYS.TAKEOUT_ORDERS]);
    expect(keys).not.toContainEqual([QUERY_KEYS.TABLES]);
    expect(keys).not.toContainEqual([QUERY_KEYS.DELIVERY_ORDERS]);
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
