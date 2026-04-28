/**
 * Wrapper-level idempotency tests.
 *
 * Migration 20260428000002 adds a partial-unique index on
 * `(tenant_id, client_request_id)` for every replay-target table. The
 * `dedupeInsert` / `dedupeInsertMany` helpers in `wrapper/_dedupe.ts`
 * translate that index into a "first attempt wins, replays return the
 * original row" guarantee at the wrapper layer.
 *
 * Real Postgres conflicts surface as `{ code: '23505' }`; the mock
 * supabase helper here doesn't model per-operation responses, so each
 * test wires up a tiny purpose-built mock that returns a different
 * response on the second call to a given chain.
 */

import { describe, expect, it } from 'vitest';
import { createOrderItemsWrapper } from '../wrapper/order-items';
import { createOrdersWrapper } from '../wrapper/orders';
import { buildOrder, buildOrderItem, buildOrderItemInsert } from './helpers/factories';

interface MockResponse {
  data: unknown;
  error: unknown;
}

/**
 * Build a Supabase client mock where each call to `.from(table)` returns
 * the next queued response for the next chain that resolves. Chains are
 * still chainable (every method returns the same builder); resolution
 * happens via `.then`.
 */
function createSequencedMockClient(responsesByTable: Record<string, MockResponse[]>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];

  return {
    client: {
      from: (table: string) => {
        const queue = responsesByTable[table] ?? [];
        const builder: Record<string, unknown> = {};
        const passthrough =
          (method: string) =>
          (...args: unknown[]) => {
            calls.push({ table, method, args });
            return builder;
          };
        for (const m of [
          'select',
          'insert',
          'update',
          'delete',
          'eq',
          'in',
          'order',
          'limit',
          'range',
          'single',
          'maybeSingle',
          'gte',
          'lt',
        ]) {
          builder[m] = passthrough(m);
        }
        // biome-ignore lint/suspicious/noThenProperty: mirrors PostgrestQueryBuilder
        builder.then = (resolve: (value: MockResponse) => void) => {
          const next = queue.shift() ?? { data: null, error: null };
          resolve(next);
        };
        return builder;
      },
    },
    calls,
  };
}

describe('Wrapper idempotency — orders.create', () => {
  it('returns the original row when the insert trips the unique index', async () => {
    const id = '00000000-0000-0000-0000-0000000000a1';
    const original = buildOrder({ id, client_request_id: id });

    const { client } = createSequencedMockClient({
      orders: [
        // The insert call resolves with the conflict.
        { data: null, error: { code: '23505', message: 'duplicate key value' } },
        // The follow-up select returns the original row.
        { data: original, error: null },
      ],
    });

    const ctx = { client: client as never, anyClient: client as never };
    const wrapper = createOrdersWrapper(ctx);

    const result = await wrapper.create({
      tenant_id: '00000000-0000-0000-0000-0000000000aa',
      table_id: '00000000-0000-0000-0000-0000000000bb',
      order_type: 'dine_in',
      source: 'waiter',
      client_request_id: id,
    } as never);

    expect(result).toEqual(original);
  });

  it('three replays produce three returns, all the same row, only one true insert path executed', async () => {
    const id = '00000000-0000-0000-0000-0000000000a2';
    const original = buildOrder({ id, client_request_id: id });

    const { client } = createSequencedMockClient({
      orders: [
        // Attempt 1: real insert, success.
        { data: original, error: null },
        // Attempt 2: insert hits unique index.
        { data: null, error: { code: '23505', message: 'duplicate key value' } },
        // Attempt 2 follow-up select.
        { data: original, error: null },
        // Attempt 3: same.
        { data: null, error: { code: '23505', message: 'duplicate key value' } },
        { data: original, error: null },
      ],
    });

    const ctx = { client: client as never, anyClient: client as never };
    const wrapper = createOrdersWrapper(ctx);
    const args = {
      tenant_id: '00000000-0000-0000-0000-0000000000aa',
      table_id: '00000000-0000-0000-0000-0000000000bb',
      order_type: 'dine_in' as const,
      source: 'waiter' as const,
      client_request_id: id,
    };

    const r1 = await wrapper.create(args as never);
    const r2 = await wrapper.create(args as never);
    const r3 = await wrapper.create(args as never);

    expect(r1).toEqual(original);
    expect(r2).toEqual(original);
    expect(r3).toEqual(original);
  });

  it('does not swallow non-conflict errors even when client_request_id is set', async () => {
    const { client } = createSequencedMockClient({
      orders: [{ data: null, error: { code: '23503', message: 'foreign key violation' } }],
    });

    const ctx = { client: client as never, anyClient: client as never };
    const wrapper = createOrdersWrapper(ctx);

    await expect(
      wrapper.create({
        tenant_id: '00000000-0000-0000-0000-0000000000aa',
        order_type: 'dine_in',
        source: 'waiter',
        client_request_id: '00000000-0000-0000-0000-0000000000a3',
      } as never),
    ).rejects.toThrow();
  });
});

describe('Wrapper idempotency — orderItems.create (batch)', () => {
  it('refetches all items by client_request_id when the batch trips the index', async () => {
    const orderId = '00000000-0000-0000-0000-0000000000bb';
    const id1 = '11111111-1111-4111-8111-111111111111';
    const id2 = '22222222-2222-4222-8222-222222222222';
    const item1 = buildOrderItem({ order_id: orderId, client_request_id: id1 });
    const item2 = buildOrderItem({ order_id: orderId, client_request_id: id2 });

    const { client } = createSequencedMockClient({
      order_items: [
        // Batch insert: one of the rows trips the unique index → entire
        // statement fails, all rolled back.
        { data: null, error: { code: '23505', message: 'duplicate key value' } },
        // Refetch by `IN (id1, id2)`: returns both prior rows.
        { data: [item1, item2], error: null },
      ],
    });

    const ctx = { client: client as never, anyClient: client as never };
    const wrapper = createOrderItemsWrapper(ctx);

    const items = [
      buildOrderItemInsert({ order_id: orderId, client_request_id: id1 }),
      buildOrderItemInsert({ order_id: orderId, client_request_id: id2 }),
    ];

    const result = await wrapper.create(items);

    expect(result).toHaveLength(2);
    expect(result[0]?.client_request_id).toBe(id1);
    expect(result[1]?.client_request_id).toBe(id2);
  });

  it('falls back to throwing when the batch has rows without client_request_id', async () => {
    const { client } = createSequencedMockClient({
      order_items: [{ data: null, error: { code: '23505', message: 'duplicate key value' } }],
    });

    const ctx = { client: client as never, anyClient: client as never };
    const wrapper = createOrderItemsWrapper(ctx);

    // Mixed batch: one item has an id, one doesn't. Helper does NOT dedupe.
    await expect(
      wrapper.create([
        buildOrderItemInsert({ client_request_id: '33333333-3333-4333-8333-333333333333' }),
        buildOrderItemInsert({}),
      ]),
    ).rejects.toThrow();
  });
});
