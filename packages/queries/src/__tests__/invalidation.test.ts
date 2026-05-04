import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import {
  invalidateExpenses,
  invalidateMenuAndCategories,
  invalidateOrders,
  invalidateOrdersAndTables,
  invalidateStock,
  invalidateTasks,
  invalidateWaiterCalls,
  invalidateWaste,
} from '../invalidation';
import { QUERY_KEYS, tenantKey } from '../keys';
import { TEST_TENANT_ID } from './helpers/test-utils';

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
    invalidateOrders(qc, TEST_TENANT_ID);
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.DELIVERY_ORDERS));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TAKEOUT_ORDERS));
  });

  it('also invalidates specific order when orderId provided', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrders(qc, TEST_TENANT_ID, 'order-123');
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDER, 'order-123'));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
  });

  it('does not invalidate specific order without orderId', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrders(qc, TEST_TENANT_ID);
    const keys = getInvalidatedKeys(spy);

    const orderKeys = keys.filter((k: string[]) => k[0] === QUERY_KEYS.ORDER && k.length > 2);
    expect(orderKeys).toHaveLength(0);
  });
});

describe('invalidateOrdersAndTables', () => {
  it('invalidates the conservative pre-M6 superset when no transition info is given', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrdersAndTables(qc, TEST_TENANT_ID);
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.DELIVERY_ORDERS));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TAKEOUT_ORDERS));
  });

  it('invalidates the specific order when orderId is in the transition', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrdersAndTables(qc, TEST_TENANT_ID, { orderId: 'order-456' });
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDER, 'order-456'));
  });

  it('does NOT invalidate TABLES on a non-terminal status transition (preparing → ready)', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrdersAndTables(qc, TEST_TENANT_ID, {
      oldStatus: 'preparing',
      newStatus: 'ready',
      oldType: 'dine_in',
    });
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS));
    expect(keys).not.toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
    expect(keys).not.toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.DELIVERY_ORDERS));
    expect(keys).not.toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TAKEOUT_ORDERS));
  });

  it('DOES invalidate TABLES when the transition crosses into a terminal state (served → closed)', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrdersAndTables(qc, TEST_TENANT_ID, {
      oldStatus: 'served',
      newStatus: 'closed',
      oldType: 'dine_in',
    });
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
  });

  it('DOES invalidate TABLES on cancellation (preparing → cancelled)', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrdersAndTables(qc, TEST_TENANT_ID, {
      oldStatus: 'preparing',
      newStatus: 'cancelled',
    });
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
  });

  it('invalidates DELIVERY_ORDERS when status enters the delivery flow', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrdersAndTables(qc, TEST_TENANT_ID, {
      oldStatus: 'ready',
      newStatus: 'out_for_delivery',
      newType: 'delivery',
    });
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.DELIVERY_ORDERS));
    expect(keys).not.toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TAKEOUT_ORDERS));
  });

  it('invalidates TABLES on dine-in order creation (claims a table)', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrdersAndTables(qc, TEST_TENANT_ID, {
      isCreation: true,
      newStatus: 'new',
      newType: 'dine_in',
    });
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ACTIVE_ORDERS));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
    expect(keys).not.toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.DELIVERY_ORDERS));
    expect(keys).not.toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TAKEOUT_ORDERS));
  });

  it('does NOT invalidate TABLES on takeout order creation', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrdersAndTables(qc, TEST_TENANT_ID, {
      isCreation: true,
      newStatus: 'new',
      newType: 'takeout',
    });
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TAKEOUT_ORDERS));
    expect(keys).not.toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
    expect(keys).not.toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.DELIVERY_ORDERS));
  });

  it('does NOT invalidate TABLES on delivery order creation', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrdersAndTables(qc, TEST_TENANT_ID, {
      isCreation: true,
      newStatus: 'new',
      newType: 'delivery',
    });
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.DELIVERY_ORDERS));
    expect(keys).not.toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
    expect(keys).not.toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TAKEOUT_ORDERS));
  });

  it('invalidates TAKEOUT_ORDERS only when type === takeout', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateOrdersAndTables(qc, TEST_TENANT_ID, {
      oldStatus: 'preparing',
      newStatus: 'ready',
      oldType: 'takeout',
      newType: 'takeout',
    });
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TAKEOUT_ORDERS));
    expect(keys).not.toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
    expect(keys).not.toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.DELIVERY_ORDERS));
  });
});

describe('invalidateStock', () => {
  it('invalidates stock item keys', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateStock(qc, TEST_TENANT_ID);
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.STOCK_ITEMS));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.LOW_STOCK_COUNT));
  });

  it('invalidates the stock item detail key (prefix-match)', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateStock(qc, TEST_TENANT_ID);
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.STOCK_ITEM));
  });

  it('includes movements when requested', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateStock(qc, TEST_TENANT_ID, true);
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.STOCK_MOVEMENTS));
  });

  it('excludes movements by default', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateStock(qc, TEST_TENANT_ID);
    const keys = getInvalidatedKeys(spy);

    const movementKeys = keys.filter((k: string[]) => k[0] === QUERY_KEYS.STOCK_MOVEMENTS);
    expect(movementKeys).toHaveLength(0);
  });
});

describe('invalidateMenuAndCategories', () => {
  it('invalidates list, categories, and detail key (prefix-match)', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateMenuAndCategories(qc, TEST_TENANT_ID);
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.CATEGORIES));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.MENU_ITEMS));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.MENU_ITEM));
  });
});

describe('invalidateExpenses', () => {
  it('invalidates list, monthly summary, categories, and detail key (prefix-match)', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateExpenses(qc, TEST_TENANT_ID);
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.EXPENSES));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.EXPENSE));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.EXPENSE_CATEGORIES));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY));
  });
});

describe('invalidateTasks', () => {
  it('invalidates list, count keys, and detail key (prefix-match)', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateTasks(qc, TEST_TENANT_ID);
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TASKS));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TASK));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.OVERDUE_TASKS_COUNT));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.OPEN_TASKS_COUNT));
  });
});

describe('invalidateWaste', () => {
  it('invalidates list, summary, and detail key (prefix-match)', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateWaste(qc, TEST_TENANT_ID);
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.WASTE_LOGS));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.WASTE_LOG));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.WASTE_SUMMARY));
  });
});

describe('invalidateWaiterCalls', () => {
  it('invalidates waiter call keys', () => {
    const { qc, spy } = createMockQueryClient();
    invalidateWaiterCalls(qc, TEST_TENANT_ID);
    const keys = getInvalidatedKeys(spy);

    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.WAITER_CALLS));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.WAITER_CALLS_COUNT));
  });
});
