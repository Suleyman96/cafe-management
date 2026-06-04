/**
 * Server-side dedupe + tenant-binding for the customer-facing order routes.
 *
 * Two contracts under test:
 *  1. C1 tenant-spoofing fix — the service derives `tenant_id` from the
 *     `tables` row (dine_in) or the `qr_tokens` row (takeout/delivery)
 *     and ignores anything the body claims. A missing/expired/revoked
 *     token rejects with the typed error the route translates to 400.
 *  2. `client_request_id` dedupe contract from migration 20260428000002 —
 *     a paused-then-replayed customer order must NOT create a duplicate
 *     row, and the per-item batch insert short-circuits when any item
 *     id is already on disk.
 */

import { ConflictError, NotFoundError, ValidationError } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  addCustomerOrderItems,
  cancelCustomerOrder,
  createCustomerOrder,
} from '@/lib/services/customer-order-service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const TENANT_OTHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TABLE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CRID = '22222222-2222-4222-8222-222222222222';
const CRID_ITEM_A = '33333333-3333-4333-8333-333333333333';
const CRID_ITEM_B = '44444444-4444-4444-8444-444444444444';
const QR_TOKEN_VALID = 'tkn_valid_1234567890';
const QR_TOKEN_REVOKED = 'tkn_revoked_xxx';
const QR_TOKEN_EXPIRED = 'tkn_expired_xxx';
const MENU_ITEM = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OPTION = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const VALUE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const ORDER_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const CRID_PRICE = '55555555-5555-4555-8555-555555555555';
const CRID_INVALID = '66666666-6666-4666-8666-666666666666';

interface QueuedResponse {
  data: unknown;
  error: unknown;
  count?: number;
}

function buildClient(plan: Record<string, QueuedResponse[]>): SupabaseClient {
  const cursor: Record<string, number> = {};
  const inserts: Array<{ table: string; payload: unknown }> = [];

  function next(table: string): QueuedResponse {
    const queue = plan[table] ?? [];
    const i = cursor[table] ?? 0;
    cursor[table] = i + 1;
    return queue[i] ?? { data: null, error: { message: `unexpected ${table}[${i}]` } };
  }

  const client = {
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
      // Capture insert payloads so tests can assert server-computed values.
      builder.insert = (payload: unknown) => {
        inserts.push({ table, payload });
        return builder;
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  (client as unknown as { __inserts: typeof inserts }).__inserts = inserts;
  return client;
}

describe('createCustomerOrder — tenant binding (C1)', () => {
  it('dine_in: derives tenant from the table row, ignores the body', async () => {
    // Body would have spoofed tenant=OTHER, but the table belongs to TENANT.
    // The service must reach into `tables` first and use its tenant_id.
    const fresh = { id: 'order-fresh', tenant_id: TENANT };
    const client = buildClient({
      tables: [
        {
          data: {
            id: TABLE,
            tenant_id: TENANT,
            qr_code_revoked_at: null,
            qr_code_expires_at: null,
          },
          error: null,
        },
      ],
      tenants: [{ data: { plan: 'pro' }, error: null }],
      orders: [
        { data: null, error: null }, // dedupe lookup → no replay
        { data: fresh, error: null }, // insert
      ],
    });

    const result = await createCustomerOrder(client, {
      orderData: {
        order_type: 'dine_in',
        table_id: TABLE,
        client_request_id: CRID,
      },
    });

    expect(result.order).toEqual(fresh);
  });

  it('dine_in: rejects when the table_id does not exist', async () => {
    const client = buildClient({
      tables: [{ data: null, error: null }],
    });

    await expect(
      createCustomerOrder(client, {
        orderData: {
          order_type: 'dine_in',
          table_id: '99999999-9999-4999-8999-999999999999',
          client_request_id: CRID,
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('dine_in: rejects when the table QR has been revoked (H2)', async () => {
    // Admin rotated or revoked this table's QR; an attacker who scraped
    // the table_id during an earlier visit can't keep submitting orders.
    const client = buildClient({
      tables: [
        {
          data: {
            id: TABLE,
            tenant_id: TENANT,
            qr_code_revoked_at: new Date('2026-04-01').toISOString(),
            qr_code_expires_at: null,
          },
          error: null,
        },
      ],
    });

    await expect(
      createCustomerOrder(client, {
        orderData: {
          order_type: 'dine_in',
          table_id: TABLE,
          client_request_id: CRID,
        },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('dine_in: rejects when the table QR has expired (H2)', async () => {
    const client = buildClient({
      tables: [
        {
          data: {
            id: TABLE,
            tenant_id: TENANT,
            qr_code_revoked_at: null,
            qr_code_expires_at: new Date('2026-01-01').toISOString(),
          },
          error: null,
        },
      ],
    });

    await expect(
      createCustomerOrder(client, {
        orderData: {
          order_type: 'dine_in',
          table_id: TABLE,
          client_request_id: CRID,
        },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('dine_in: accepts a future expires_at as still-valid (H2)', async () => {
    // expires_at in the future = still valid. Same shape as the happy
    // path; just proves the comparison is `<= now()`, not just "not null".
    const fresh = { id: 'order-fresh', tenant_id: TENANT };
    const client = buildClient({
      tables: [
        {
          data: {
            id: TABLE,
            tenant_id: TENANT,
            qr_code_revoked_at: null,
            qr_code_expires_at: new Date(Date.now() + 86400_000).toISOString(),
          },
          error: null,
        },
      ],
      tenants: [{ data: { plan: 'pro' }, error: null }],
      orders: [
        { data: null, error: null },
        { data: fresh, error: null },
      ],
    });

    const result = await createCustomerOrder(client, {
      orderData: {
        order_type: 'dine_in',
        table_id: TABLE,
        client_request_id: CRID,
      },
    });

    expect(result.order).toEqual(fresh);
  });

  it('takeout: a missing qr_token is not even constructable — service rejects on lookup miss', async () => {
    // The route's zod schema rejects missing qr_token at the boundary.
    // At the service layer, an empty string makes the lookup miss.
    const client = buildClient({
      qr_tokens: [{ data: null, error: null }],
    });

    await expect(
      createCustomerOrder(client, {
        orderData: {
          order_type: 'takeout',
          qr_token: 'does-not-exist',
          client_request_id: CRID,
        },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('takeout: revoked qr_token rejected', async () => {
    const client = buildClient({
      qr_tokens: [
        {
          data: {
            tenant_id: TENANT,
            table_id: null,
            kind: 'takeout',
            expires_at: null,
            revoked_at: new Date('2026-04-01').toISOString(),
          },
          error: null,
        },
      ],
    });

    await expect(
      createCustomerOrder(client, {
        orderData: {
          order_type: 'takeout',
          qr_token: QR_TOKEN_REVOKED,
          client_request_id: CRID,
        },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('takeout: expired qr_token rejected', async () => {
    const client = buildClient({
      qr_tokens: [
        {
          data: {
            tenant_id: TENANT,
            table_id: null,
            kind: 'takeout',
            expires_at: new Date('2026-04-01').toISOString(),
            revoked_at: null,
          },
          error: null,
        },
      ],
    });

    await expect(
      createCustomerOrder(client, {
        orderData: {
          order_type: 'takeout',
          qr_token: QR_TOKEN_EXPIRED,
          client_request_id: CRID,
        },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('takeout: token kind mismatch rejected', async () => {
    // A delivery-kind token used for a takeout request — wrong scope.
    const client = buildClient({
      qr_tokens: [
        {
          data: {
            tenant_id: TENANT,
            table_id: null,
            kind: 'delivery',
            expires_at: null,
            revoked_at: null,
          },
          error: null,
        },
      ],
    });

    await expect(
      createCustomerOrder(client, {
        orderData: {
          order_type: 'takeout',
          qr_token: QR_TOKEN_VALID,
          client_request_id: CRID,
        },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('takeout: valid qr_token resolves to the bound tenant', async () => {
    const fresh = { id: 'order-takeout', tenant_id: TENANT };
    const client = buildClient({
      qr_tokens: [
        {
          data: {
            tenant_id: TENANT,
            table_id: null,
            kind: 'takeout',
            expires_at: null,
            revoked_at: null,
          },
          error: null,
        },
      ],
      tenants: [{ data: { plan: 'pro' }, error: null }],
      orders: [
        { data: null, error: null }, // dedupe lookup → no replay
        { data: fresh, error: null },
      ],
    });

    const result = await createCustomerOrder(client, {
      orderData: {
        order_type: 'takeout',
        qr_token: QR_TOKEN_VALID,
        client_request_id: CRID,
      },
    });

    expect(result.order).toEqual(fresh);
  });

  it('delivery: valid qr_token + delivery fields resolves to bound tenant', async () => {
    // Even though the test body could try to lie about tenant elsewhere,
    // the discriminated-union schema in route.ts means tenant_id can't
    // be in the body at all. The service path here is the same as
    // takeout — the difference is the persisted columns.
    const fresh = { id: 'order-delivery', tenant_id: TENANT_OTHER };
    const client = buildClient({
      qr_tokens: [
        {
          data: {
            tenant_id: TENANT_OTHER,
            table_id: null,
            kind: 'delivery',
            expires_at: null,
            revoked_at: null,
          },
          error: null,
        },
      ],
      tenants: [{ data: { plan: 'pro' }, error: null }],
      orders: [
        { data: null, error: null }, // dedupe lookup → no replay
        { data: fresh, error: null },
      ],
    });

    const result = await createCustomerOrder(client, {
      orderData: {
        order_type: 'delivery',
        qr_token: QR_TOKEN_VALID,
        delivery_address: '1 Main St',
        delivery_phone: '+15551234567',
        client_request_id: CRID,
      },
    });

    expect(result.order).toEqual(fresh);
  });
});

describe('createCustomerOrder — dedupe', () => {
  it('returns the existing row with deduped=true on replay', async () => {
    const persisted = { id: 'order-A', tenant_id: TENANT, client_request_id: CRID };
    const client = buildClient({
      tables: [
        {
          data: {
            id: TABLE,
            tenant_id: TENANT,
            qr_code_revoked_at: null,
            qr_code_expires_at: null,
          },
          error: null,
        },
      ],
      orders: [{ data: persisted, error: null }],
    });

    const result = await createCustomerOrder(client, {
      orderData: {
        order_type: 'dine_in',
        table_id: TABLE,
        client_request_id: CRID,
      },
    });

    expect(result.deduped).toBe(true);
    expect(result.order).toEqual(persisted);
  });

  it('runs plan check + insert on the fresh path when no replay exists', async () => {
    const fresh = { id: 'order-fresh', tenant_id: TENANT, client_request_id: CRID };
    const client = buildClient({
      qr_tokens: [
        {
          data: {
            tenant_id: TENANT,
            table_id: null,
            kind: 'takeout',
            expires_at: null,
            revoked_at: null,
          },
          error: null,
        },
      ],
      orders: [
        { data: null, error: null }, // dedupe lookup → no replay
        { data: fresh, error: null }, // insert
      ],
      tenants: [{ data: { plan: 'pro' }, error: null }],
    });

    const result = await createCustomerOrder(client, {
      orderData: {
        order_type: 'takeout',
        qr_token: QR_TOKEN_VALID,
        client_request_id: CRID,
      },
    });

    expect(result.deduped).toBe(false);
    expect(result.order).toEqual(fresh);
  });
});

describe('addCustomerOrderItems — server-side pricing + modifier validation', () => {
  function priceClient(menuItemOptions: QueuedResponse) {
    return buildClient({
      order_items: [
        { data: [], error: null }, // dedupe lookup → no replay
        { data: [{ id: 'oi-1' }], error: null }, // insert
      ],
      orders: [{ data: { id: ORDER_ID, status: 'new', tenant_id: TENANT }, error: null }],
      menu_items: [{ data: [{ id: MENU_ITEM, is_available: true, price: 5 }], error: null }],
      menu_item_option_values: [
        {
          data: [
            { id: VALUE, name: 'Large', price_delta: 2, is_available: true, option_id: OPTION },
          ],
          error: null,
        },
      ],
      menu_item_options: [menuItemOptions],
    });
  }

  it('recomputes item_price as base + modifier delta, ignoring the client price', async () => {
    const client = priceClient({
      data: [
        {
          id: OPTION,
          name: 'Size',
          menu_item_id: MENU_ITEM,
          is_available: true,
          is_required: false,
          min_select: 0,
          max_select: 1,
        },
      ],
      error: null,
    });

    await addCustomerOrderItems(client, {
      orderId: ORDER_ID,
      items: [
        {
          menu_item_id: MENU_ITEM,
          item_name: 'Coffee',
          item_price: 0.01, // tampered client price — must be ignored
          quantity: 1,
          tenant_id: TENANT,
          client_request_id: CRID_PRICE,
          selected_options: [{ option_id: OPTION, value_id: VALUE }],
        },
      ],
    });

    const captured = (client as unknown as { __inserts: { table: string; payload: unknown }[] })
      .__inserts;
    const row = (
      captured.find((i) => i.table === 'order_items')?.payload as Record<string, unknown>[]
    )[0];
    expect(row.item_price).toBe(7); // 5 + 2, not 0.01
    expect(row.selected_options).toHaveLength(1);
    expect((row.selected_options as Record<string, unknown>[])[0].value_name).toBe('Large');
  });

  it('rejects a selected value whose option belongs to a different menu item', async () => {
    const client = priceClient({
      data: [
        {
          id: OPTION,
          name: 'Size',
          menu_item_id: 'other-item',
          is_available: true,
          is_required: false,
          min_select: 0,
          max_select: 1,
        },
      ],
      error: null,
    });

    await expect(
      addCustomerOrderItems(client, {
        orderId: ORDER_ID,
        items: [
          {
            menu_item_id: MENU_ITEM,
            item_name: 'Coffee',
            item_price: 5,
            quantity: 1,
            tenant_id: TENANT,
            client_request_id: CRID_INVALID,
            selected_options: [{ option_id: OPTION, value_id: VALUE }],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects when a required option group has no selection', async () => {
    const client = priceClient({
      data: [
        {
          id: OPTION,
          name: 'Size',
          menu_item_id: MENU_ITEM,
          is_available: true,
          is_required: true,
          min_select: 1,
          max_select: 1,
        },
      ],
      error: null,
    });

    await expect(
      addCustomerOrderItems(client, {
        orderId: ORDER_ID,
        items: [
          {
            menu_item_id: MENU_ITEM,
            item_name: 'Coffee',
            item_price: 5,
            quantity: 1,
            tenant_id: TENANT,
            client_request_id: CRID_INVALID,
            // no selected_options → required "Size" group is unmet
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
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

// Blocker 1: customer-facing routes also enforce client_request_id. The
// service must reject a missing key with ValidationError so the route
// returns a typed 400 instead of bypassing dedupe.
describe('createCustomerOrder — client_request_id is required', () => {
  it('rejects with ValidationError when no client_request_id is supplied', async () => {
    const client = buildClient({
      qr_tokens: [
        {
          data: {
            tenant_id: TENANT,
            table_id: null,
            kind: 'takeout',
            expires_at: null,
            revoked_at: null,
          },
          error: null,
        },
      ],
    });

    await expect(
      createCustomerOrder(client, {
        orderData: { order_type: 'takeout', qr_token: QR_TOKEN_VALID },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('plan-gating still runs once a key is supplied', async () => {
    const client = buildClient({
      qr_tokens: [
        {
          data: {
            tenant_id: TENANT,
            table_id: null,
            kind: 'takeout',
            expires_at: null,
            revoked_at: null,
          },
          error: null,
        },
      ],
      orders: [{ data: null, error: null }], // dedupe lookup → no replay
      tenants: [{ data: { plan: 'free' }, error: null }],
    });

    await expect(
      createCustomerOrder(client, {
        orderData: {
          order_type: 'takeout',
          qr_token: QR_TOKEN_VALID,
          client_request_id: CRID,
        },
      }),
    ).rejects.toThrow(/plan_required/);
  });
});

describe('cancelCustomerOrder — M6', () => {
  const ORDER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const TABLE_OTHER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  it('rejects when the order does not exist', async () => {
    const client = buildClient({
      orders: [{ data: null, error: null }],
    });

    await expect(
      cancelCustomerOrder(client, { orderId: ORDER_ID, tableId: TABLE }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects when table_id does not match the order (M6 grief gate)', async () => {
    // Attacker has order_id but is at a different table — server
    // refuses the cancel.
    const client = buildClient({
      orders: [
        {
          data: {
            id: ORDER_ID,
            tenant_id: TENANT,
            table_id: TABLE,
            status: 'new',
          },
          error: null,
        },
      ],
    });

    await expect(
      cancelCustomerOrder(client, { orderId: ORDER_ID, tableId: TABLE_OTHER }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects when the order is past the cancellable status', async () => {
    // Once the kitchen is preparing, customer-side cancel is blocked.
    // Staff-side cancel (with a reason) is the right surface.
    const client = buildClient({
      orders: [
        {
          data: {
            id: ORDER_ID,
            tenant_id: TENANT,
            table_id: TABLE,
            status: 'preparing',
          },
          error: null,
        },
      ],
    });

    await expect(
      cancelCustomerOrder(client, { orderId: ORDER_ID, tableId: TABLE }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it.each([
    ['preparing'],
    ['ready'],
    ['served'],
    ['out_for_delivery'],
  ])('rejects with `order_cancel_too_late` when kitchen has progressed to %s (H3)', async (status) => {
    // H3 — the client distinguishes this from `order_not_cancellable`
    // so the "Call a waiter" CTA renders for the kitchen-has-started
    // case but not for the already-terminal case.
    const client = buildClient({
      orders: [
        {
          data: { id: ORDER_ID, tenant_id: TENANT, table_id: TABLE, status },
          error: null,
        },
      ],
    });

    await expect(
      cancelCustomerOrder(client, { orderId: ORDER_ID, tableId: TABLE }),
    ).rejects.toMatchObject({ message: 'order_cancel_too_late' });
  });

  it.each([
    ['delivered'],
    ['closed'],
    ['cancelled'],
  ])('rejects with `order_not_cancellable` for terminal status %s', async (status) => {
    const client = buildClient({
      orders: [
        {
          data: { id: ORDER_ID, tenant_id: TENANT, table_id: TABLE, status },
          error: null,
        },
      ],
    });

    await expect(
      cancelCustomerOrder(client, { orderId: ORDER_ID, tableId: TABLE }),
    ).rejects.toMatchObject({ message: 'order_not_cancellable' });
  });

  it('cancels successfully when order is in pending_approval and table matches', async () => {
    const cancelled = {
      id: ORDER_ID,
      tenant_id: TENANT,
      table_id: TABLE,
      status: 'cancelled',
    };
    const client = buildClient({
      orders: [
        // 1st `from('orders')` → SELECT to fetch the row
        {
          data: { id: ORDER_ID, tenant_id: TENANT, table_id: TABLE, status: 'pending_approval' },
          error: null,
        },
        // 2nd `from('orders')` → UPDATE returning the cancelled row
        { data: cancelled, error: null },
      ],
    });

    const result = await cancelCustomerOrder(client, {
      orderId: ORDER_ID,
      tableId: TABLE,
      reason: 'changed mind',
    });

    expect(result).toEqual(cancelled);
  });
});

// silence unused vi import in some Vitest configs
void vi;
