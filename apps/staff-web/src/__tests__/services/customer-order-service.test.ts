/**
 * Server-side dedupe for the customer-facing order routes.
 *
 * Mirrors the `client_request_id` contract from migration 20260428000002:
 * a paused-then-replayed customer order must NOT create a duplicate row,
 * and the per-item batch insert must short-circuit when any item id is
 * already on disk.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { addCustomerOrderItems, createCustomerOrder } from '@/lib/services/customer-order-service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const CRID = '22222222-2222-4222-8222-222222222222';
const CRID_ITEM_A = '33333333-3333-4333-8333-333333333333';
const CRID_ITEM_B = '44444444-4444-4444-8444-444444444444';

interface QueuedResponse {
  data: unknown;
  error: unknown;
}

function buildClient(plan: Record<string, QueuedResponse[]>): SupabaseClient {
  const cursor: Record<string, number> = {};

  function next(table: string): QueuedResponse {
    const queue = plan[table] ?? [];
    const i = cursor[table] ?? 0;
    cursor[table] = i + 1;
    return queue[i] ?? { data: null, error: { message: `unexpected ${table}[${i}]` } };
  }

  return {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      const chain =
        () =>
        (..._args: unknown[]) =>
          builder;
      for (const m of [
        'select',
        'insert',
        'update',
        'delete',
        'eq',
        'in',
        'gte',
        'order',
        'limit',
      ]) {
        builder[m] = chain();
      }
      builder.maybeSingle = () => Promise.resolve(next(table));
      builder.single = () => Promise.resolve(next(table));
      // PostgREST builders are thenable — `await client.from(...).insert(...)`
      // resolves to `{ data, error }`. We mirror that contract for callers
      // that don't end the chain with `.single()` / `.maybeSingle()`.
      // biome-ignore lint/suspicious/noThenProperty: required to mock the supabase builder shape
      builder.then = (resolve: (v: QueuedResponse) => unknown) => resolve(next(table));
      return builder;
    },
  } as unknown as SupabaseClient;
}

describe('createCustomerOrder — dedupe', () => {
  it('returns the existing row with deduped=true on replay', async () => {
    const persisted = { id: 'order-A', tenant_id: TENANT, client_request_id: CRID };
    const client = buildClient({
      orders: [{ data: persisted, error: null }],
    });

    const result = await createCustomerOrder(client, {
      orderData: {
        tenant_id: TENANT,
        order_type: 'dine_in',
        client_request_id: CRID,
      },
    });

    expect(result.deduped).toBe(true);
    expect(result.order).toEqual(persisted);
  });

  it('runs plan check + insert on the fresh path when no replay exists', async () => {
    const fresh = { id: 'order-fresh', tenant_id: TENANT, client_request_id: CRID };
    const client = buildClient({
      orders: [
        { data: null, error: null }, // dedupe lookup → no replay
        { data: null, error: null, count: 0 } as QueuedResponse, // monthly-count check
        { data: fresh, error: null }, // insert
      ],
      tenants: [{ data: { plan: 'pro' }, error: null }],
    });

    const result = await createCustomerOrder(client, {
      orderData: {
        tenant_id: TENANT,
        order_type: 'takeout',
        client_request_id: CRID,
      },
    });

    expect(result.deduped).toBe(false);
    expect(result.order).toEqual(fresh);
  });
});

describe('addCustomerOrderItems — dedupe', () => {
  it('returns persisted rows when every item id is already on disk', async () => {
    const persistedA = { id: 'item-A', client_request_id: CRID_ITEM_A };
    const persistedB = { id: 'item-B', client_request_id: CRID_ITEM_B };
    const client = buildClient({
      order_items: [{ data: [persistedA, persistedB], error: null }],
    });

    const result = await addCustomerOrderItems(client, {
      orderId: 'order-1',
      items: [
        {
          menu_item_id: '55555555-5555-4555-8555-555555555555',
          item_name: 'A',
          item_price: 5,
          quantity: 1,
          tenant_id: TENANT,
          client_request_id: CRID_ITEM_A,
        },
        {
          menu_item_id: '66666666-6666-4666-8666-666666666666',
          item_name: 'B',
          item_price: 8,
          quantity: 2,
          tenant_id: TENANT,
          client_request_id: CRID_ITEM_B,
        },
      ],
    });

    expect(result).toEqual([persistedA, persistedB]);
  });

  it('refuses payloads where some items have a request id and some do not', async () => {
    const client = buildClient({});

    await expect(
      addCustomerOrderItems(client, {
        orderId: 'order-1',
        items: [
          {
            menu_item_id: '55555555-5555-4555-8555-555555555555',
            item_name: 'A',
            item_price: 5,
            quantity: 1,
            tenant_id: TENANT,
            client_request_id: CRID_ITEM_A,
          },
          {
            menu_item_id: '66666666-6666-4666-8666-666666666666',
            item_name: 'B',
            item_price: 8,
            quantity: 2,
            tenant_id: TENANT,
          },
        ],
      }),
    ).rejects.toThrow(/client_request_id must be set on every item or none/);
  });
});

// Defensive: a smoke test to make sure the service stays unfrozen when no
// dedupe id is supplied (legacy/server-originated callers). This is the
// same contract the wrapper variants honor.
describe('createCustomerOrder — no dedupe id', () => {
  it('runs the insert path directly', async () => {
    const fresh = { id: 'order-fresh-2', tenant_id: TENANT };
    const client = buildClient({
      orders: [
        { data: null, error: null, count: 0 } as QueuedResponse, // monthly-count check
        { data: fresh, error: null }, // insert
      ],
      tenants: [{ data: { plan: 'standard' }, error: null }],
    });

    const result = await createCustomerOrder(client, {
      orderData: { tenant_id: TENANT, order_type: 'takeout' },
    });
    expect(result.order).toEqual(fresh);
    expect(result.deduped).toBe(false);
  });

  it('rejects free-tier customer orders with plan_required (QR ordering off)', async () => {
    const client = buildClient({
      tenants: [{ data: { plan: 'free' }, error: null }],
    });

    await expect(
      createCustomerOrder(client, {
        orderData: { tenant_id: TENANT, order_type: 'takeout' },
      }),
    ).rejects.toThrow(/plan_required/);
  });
});

// silence unused vi import in some Vitest configs
void vi;
