/**
 * Verifies every wrapper `findAll` enforces a numeric LIMIT on the underlying
 * Supabase query, either via `.limit(n)` or `.range(start, end)`.
 *
 * The cost of capping at this layer is zero, and the upside is preventing
 * one bad query (e.g. a future table_history join that explodes row counts)
 * from taking down a slow connection.
 */

import { describe, expect, it } from 'vitest';
import { createDeliveryCustomersWrapper } from '../wrapper/delivery-customers';
import { createExpenseCategoriesWrapper, createExpensesWrapper } from '../wrapper/expenses';
import { createFeedbackWrapper } from '../wrapper/feedback';
import { createCategoriesWrapper, createMenuItemsWrapper } from '../wrapper/menu';
import { createStaffWrapper } from '../wrapper/staff';
import { createStockItemsWrapper } from '../wrapper/stock';
import { createTablesWrapper } from '../wrapper/tables';
import { createTasksWrapper } from '../wrapper/tasks';
import { createWaiterCallsWrapper } from '../wrapper/waiter-calls';
import { createWasteWrapper } from '../wrapper/waste';

interface MethodCall {
  name: string;
  args: any[];
}

/**
 * Builds a Supabase-shaped query mock that records every chained method call,
 * so a test can assert that `.limit(n)` (or `.range(start, end)`) was issued.
 */
function makeRecordingClient() {
  const calls: MethodCall[] = [];

  const proxy: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === 'then') {
          return (resolve: (value: any) => void) => resolve({ data: [], error: null, count: 0 });
        }
        return (...args: any[]) => {
          calls.push({ name: prop, args });
          return proxy;
        };
      },
    },
  );

  return {
    client: { from: () => proxy } as any,
    calls,
  };
}

function hasBoundedQuery(calls: MethodCall[]): boolean {
  return calls.some((c) => {
    if (c.name === 'limit' && typeof c.args[0] === 'number' && c.args[0] > 0) return true;
    if (c.name === 'range' && typeof c.args[0] === 'number' && typeof c.args[1] === 'number') {
      return true;
    }
    return false;
  });
}

describe('wrapper findAll methods enforce LIMIT', () => {
  // Each entry is [name, () => Promise]. The promise is the findAll invocation
  // against a recording client. If the resulting call list contains a numeric
  // .limit(n) or .range(s, e), the test passes.
  const cases: Array<[string, () => { calls: MethodCall[]; promise: Promise<any> }]> = [
    [
      'tables.findAll',
      () => {
        const { client, calls } = makeRecordingClient();
        const wrapper = createTablesWrapper({ client, anyClient: client });
        return { calls, promise: wrapper.findAll() };
      },
    ],
    [
      'staff.findAll',
      () => {
        const { client, calls } = makeRecordingClient();
        const wrapper = createStaffWrapper({ client, anyClient: client });
        return { calls, promise: wrapper.findAll() };
      },
    ],
    [
      'menu.findAll',
      () => {
        const { client, calls } = makeRecordingClient();
        const wrapper = createMenuItemsWrapper({ client, anyClient: client });
        return { calls, promise: wrapper.findAll() };
      },
    ],
    [
      'categories.findAll',
      () => {
        const { client, calls } = makeRecordingClient();
        const wrapper = createCategoriesWrapper({ client, anyClient: client });
        return { calls, promise: wrapper.findAll() };
      },
    ],
    [
      'stock.findAll',
      () => {
        const { client, calls } = makeRecordingClient();
        const wrapper = createStockItemsWrapper({ client, anyClient: client });
        return { calls, promise: wrapper.findAll() };
      },
    ],
    [
      'expenseCategories.findAll',
      () => {
        const { client, calls } = makeRecordingClient();
        const wrapper = createExpenseCategoriesWrapper({ client, anyClient: client });
        return { calls, promise: wrapper.findAll() };
      },
    ],
    [
      'expenses.findAll',
      () => {
        const { client, calls } = makeRecordingClient();
        const wrapper = createExpensesWrapper({ client, anyClient: client });
        return { calls, promise: wrapper.findAll() };
      },
    ],
    [
      'feedback.findAll',
      () => {
        const { client, calls } = makeRecordingClient();
        const wrapper = createFeedbackWrapper({ client, anyClient: client });
        return { calls, promise: wrapper.findAll() };
      },
    ],
    [
      'tasks.findAll',
      () => {
        const { client, calls } = makeRecordingClient();
        const wrapper = createTasksWrapper({ client, anyClient: client });
        return { calls, promise: wrapper.findAll() };
      },
    ],
    [
      'waiterCalls.findAll',
      () => {
        const { client, calls } = makeRecordingClient();
        const wrapper = createWaiterCallsWrapper({ client, anyClient: client });
        return { calls, promise: wrapper.findAll() };
      },
    ],
    [
      'waste.findAll',
      () => {
        const { client, calls } = makeRecordingClient();
        const wrapper = createWasteWrapper({ client, anyClient: client });
        return { calls, promise: wrapper.findAll() };
      },
    ],
    [
      'deliveryCustomers.findAll',
      () => {
        const { client, calls } = makeRecordingClient();
        const wrapper = createDeliveryCustomersWrapper({ client, anyClient: client });
        return { calls, promise: wrapper.findAll() };
      },
    ],
  ];

  for (const [name, run] of cases) {
    it(`${name} caps the query`, async () => {
      const { calls, promise } = run();
      await promise;
      expect(
        hasBoundedQuery(calls),
        `Expected ${name} to issue .limit(n) or .range(s,e) — got: ${calls
          .map((c) => `${c.name}(${c.args.length})`)
          .join(' → ')}`,
      ).toBe(true);
    });
  }
});
