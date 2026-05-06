/**
 * Integration test — `bump_orders_version` trigger + wrapper concurrency.
 *
 * Migration `20260506000004_orders_version_etag.sql` adds:
 *   - `orders.version INTEGER NOT NULL DEFAULT 1`
 *   - `bump_orders_version` BEFORE UPDATE trigger
 *
 * The wrapper (Plan 8) accepts `expectedVersion` on `updateStatus`,
 * `close`, `cancelOrder`, and `applyDiscount`. When supplied, the UPDATE
 * filters on `version = expectedVersion`; a 0-row result surfaces
 * `ConflictError('version_conflict')` with the row's current version
 * attached as `error.details.currentVersion`.
 *
 * Run: pnpm test:rls
 *
 * Prerequisites: local Supabase running, db reset & seeded.
 */

import { ConflictError } from '@gustri/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createOrdersWrapper, ORDER_VERSION_CONFLICT } from '../../wrapper/orders';
import type { WrapperContext } from '../../wrapper/types';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const TENANT_1 = '00000000-0000-0000-0000-000000000001';
const SEED_TABLE_ID = '20000000-0000-0000-0000-000000000008';

let svc: SupabaseClient;
let wrapper: ReturnType<typeof createOrdersWrapper>;
const createdOrderIds: string[] = [];
const createdItemIds: string[] = [];

async function seedOrderWithItem(): Promise<{ orderId: string; itemId: string }> {
  const orderNumber = `VC${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, '0')}`;
  const { data: order, error: orderErr } = await svc
    .from('orders')
    .insert({
      tenant_id: TENANT_1,
      table_id: SEED_TABLE_ID,
      order_number: orderNumber,
      status: 'new',
      order_type: 'dine_in',
      source: 'waiter',
      subtotal: 0,
      tax: 0,
      total: 0,
    })
    .select('id')
    .single();
  if (orderErr || !order) {
    throw new Error(`seedOrder failed: ${orderErr?.message ?? 'no data'}`);
  }
  createdOrderIds.push(order.id);

  // Need at least one item so updateStatus to 'preparing' is allowed by
  // the empty-orders advance guard. Pick whichever menu item the seed
  // happens to have for this tenant; tests don't depend on the price.
  const { data: existingMenu } = await svc
    .from('menu_items')
    .select('id, name, price')
    .eq('tenant_id', TENANT_1)
    .limit(1)
    .single();
  if (!existingMenu) {
    throw new Error('seed menu item missing — run pnpm db:reset');
  }
  const menu = existingMenu as { id: string; name: string; price: number };

  const { data: item, error: itemErr } = await svc
    .from('order_items')
    .insert({
      tenant_id: TENANT_1,
      order_id: order.id,
      menu_item_id: menu.id,
      item_name: menu.name,
      quantity: 1,
      item_price: menu.price,
      status: 'pending',
    })
    .select('id')
    .single();
  if (itemErr || !item) {
    throw new Error(`seed item failed: ${itemErr?.message ?? 'no data'}`);
  }
  createdItemIds.push(item.id);
  return { orderId: order.id, itemId: item.id };
}

async function readVersion(orderId: string): Promise<number> {
  const { data, error } = await svc.from('orders').select('version').eq('id', orderId).single();
  if (error || !data) throw new Error(`readVersion failed: ${error?.message ?? 'no data'}`);
  return (data as { version: number }).version;
}

beforeAll(() => {
  svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const ctx: WrapperContext = {
    client: svc as never,
    anyClient: svc as never,
    tenantContext: { tenantId: TENANT_1, setTenantId: () => {} },
  };
  wrapper = createOrdersWrapper(ctx);
});

afterAll(async () => {
  if (createdItemIds.length > 0) {
    await svc.from('order_items').delete().in('id', createdItemIds);
  }
  if (createdOrderIds.length > 0) {
    await svc.from('order_payments').delete().in('order_id', createdOrderIds);
    await svc.from('financial_audit_log').delete().in('order_id', createdOrderIds);
    await svc.from('orders').delete().in('id', createdOrderIds);
  }
});

describe('bump_orders_version trigger', () => {
  test('orders carry a version starting at 1 (or higher after recompute triggers)', async () => {
    // A bare INSERT into orders lands at version 1; subsequent triggers on
    // the same row (e.g. order_items insert → recompute total) bump it
    // immediately. Asserting "≥ 1" keeps the test resilient to the
    // recompute trigger seeding a higher starting version while still
    // catching a missing default.
    const { orderId } = await seedOrderWithItem();
    const v = await readVersion(orderId);
    expect(v).toBeGreaterThanOrEqual(1);
  });

  test('every meaningful UPDATE bumps version monotonically', async () => {
    const { orderId } = await seedOrderWithItem();
    const v0 = await readVersion(orderId);

    await svc.from('orders').update({ internal_notes: 'first' }).eq('id', orderId);
    const v1 = await readVersion(orderId);
    expect(v1).toBe(v0 + 1);

    await svc.from('orders').update({ internal_notes: 'second' }).eq('id', orderId);
    const v2 = await readVersion(orderId);
    expect(v2).toBe(v1 + 1);
  });
});

describe('orders wrapper expectedVersion', () => {
  test('updateStatus succeeds when expectedVersion matches', async () => {
    const { orderId } = await seedOrderWithItem();
    const v = await readVersion(orderId);

    const result = await wrapper.updateStatus(orderId, 'preparing', { expectedVersion: v });

    expect(result.status).toBe('preparing');
    expect(result.version).toBe(v + 1);
  });

  test('updateStatus throws version_conflict when expectedVersion is stale', async () => {
    const { orderId } = await seedOrderWithItem();
    const stale = await readVersion(orderId);

    // Simulate another device bumping the version first.
    await svc.from('orders').update({ internal_notes: 'concurrent edit' }).eq('id', orderId);
    const fresh = await readVersion(orderId);
    expect(fresh).toBeGreaterThan(stale);

    let caught: unknown;
    try {
      await wrapper.updateStatus(orderId, 'preparing', { expectedVersion: stale });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ConflictError);
    expect((caught as ConflictError).message).toBe(ORDER_VERSION_CONFLICT);
    expect((caught as ConflictError).details?.currentVersion).toBe(fresh);

    // Side-effect check: status did NOT flip.
    const { data } = await svc.from('orders').select('status').eq('id', orderId).single();
    expect((data as { status: string }).status).toBe('new');
  });

  test('two concurrent updateStatus calls with the same expectedVersion: one wins, one conflicts', async () => {
    const { orderId } = await seedOrderWithItem();
    const v = await readVersion(orderId);

    const [a, b] = await Promise.allSettled([
      wrapper.updateStatus(orderId, 'preparing', { expectedVersion: v }),
      wrapper.updateStatus(orderId, 'preparing', { expectedVersion: v }),
    ]);

    const fulfilled = [a, b].filter((r) => r.status === 'fulfilled');
    const rejected = [a, b].filter((r) => r.status === 'rejected');

    // Either both fulfilled (because the second saw status='preparing' and
    // treated it as idempotent — both Promises resolve with the same row),
    // or one fulfilled + one rejected with version_conflict. The illegal
    // state is a silent overwrite; assert that.
    if (fulfilled.length === 2) {
      // Idempotent path — both saw the target status. Either way only one
      // bump should have occurred.
      expect(await readVersion(orderId)).toBe(v + 1);
    } else {
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const err = (rejected[0] as PromiseRejectedResult).reason;
      expect(err).toBeInstanceOf(ConflictError);
      expect((err as ConflictError).message).toBe(ORDER_VERSION_CONFLICT);
    }
  });

  test('updateStatus without expectedVersion still works (back-compat)', async () => {
    const { orderId } = await seedOrderWithItem();
    const result = await wrapper.updateStatus(orderId, 'preparing');
    expect(result.status).toBe('preparing');
  });

  test('cancelOrder honors expectedVersion', async () => {
    const { orderId } = await seedOrderWithItem();
    const stale = await readVersion(orderId);
    await svc.from('orders').update({ internal_notes: 'concurrent' }).eq('id', orderId);

    let caught: unknown;
    try {
      await wrapper.cancelOrder(orderId, 'test cancel', null, { expectedVersion: stale });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ConflictError);
    expect((caught as ConflictError).message).toBe(ORDER_VERSION_CONFLICT);

    const { data } = await svc.from('orders').select('status').eq('id', orderId).single();
    expect((data as { status: string }).status).toBe('new');
  });
});
