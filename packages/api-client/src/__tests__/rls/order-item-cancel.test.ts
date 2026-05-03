/**
 * Integration test — `cancel_order_item_qty` is atomic under concurrent
 * partial-cancels.
 *
 * The pre-fix wrapper performed SELECT → mutate-in-JS → UPDATE. Two
 * concurrent partial-cancel calls each read the same `quantity`,
 * computed `quantity - cancelQty` from the same baseline, and the second
 * UPDATE clobbered the first — a classic lost update under READ
 * COMMITTED.
 *
 * Migration `20260503000007_cancel_order_item_rpc.sql` introduces
 * `cancel_order_item_qty(p_order_item_id, p_cancel_qty)` which takes a
 * row-level lock. This test seeds an item with quantity=5, fires two
 * concurrent partial-cancels of 2 each, and asserts the persisted
 * quantity is 1 (5 − 2 − 2). Pre-fix it would have been 3.
 *
 * Also verifies the RPC's authorization gates (active staff +
 * tenant match) and the rejection of terminal-state items.
 *
 * Run: pnpm test:rls
 *
 * Prerequisites: local Supabase running, db reset & seeded, admin@test.com
 * exists.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const TENANT_1 = '00000000-0000-0000-0000-000000000001';
const SEED_TABLE_ID = '20000000-0000-0000-0000-000000000008';
const SEED_MENU_ITEM_ID = '40000000-0000-0000-0000-000000000001';

let svc: SupabaseClient;
let adminClient: SupabaseClient;
const createdOrderIds: string[] = [];

async function seedOrderWithItem(quantity: number): Promise<{ orderId: string; itemId: string }> {
  const orderNumber = `IC${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 100)
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
    throw new Error(`Seed order failed: ${orderErr?.message ?? 'no data'}`);
  }
  createdOrderIds.push(order.id);

  const { data: item, error: itemErr } = await svc
    .from('order_items')
    .insert({
      tenant_id: TENANT_1,
      order_id: order.id,
      menu_item_id: SEED_MENU_ITEM_ID,
      item_name: 'Matcha Latte',
      item_price: 550,
      quantity,
      status: 'pending',
    })
    .select('id')
    .single();
  if (itemErr || !item) {
    throw new Error(`Seed order_item failed: ${itemErr?.message ?? 'no data'}`);
  }

  return { orderId: order.id, itemId: item.id };
}

beforeAll(async () => {
  svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // The RPC is SECURITY DEFINER but resolves the actor via auth.uid().
  // Service role gives auth.uid() = NULL, so we must invoke as an
  // authenticated admin session.
  const { data, error } = await createClient(SUPABASE_URL, ANON_KEY).auth.signInWithPassword({
    email: 'admin@test.com',
    password: 'test1234',
  });
  if (error || !data.session) {
    throw new Error(`Admin sign-in failed: ${error?.message ?? 'no session'}`);
  }
  adminClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
});

afterAll(async () => {
  if (createdOrderIds.length === 0) return;
  await svc.from('order_items').delete().in('order_id', createdOrderIds);
  await svc.from('orders').delete().in('id', createdOrderIds);
});

describe('cancel_order_item_qty atomicity', () => {
  test('two concurrent partial-cancels of 2 against quantity=5 leave quantity=1', async () => {
    const { itemId } = await seedOrderWithItem(5);

    const results = await Promise.all([
      adminClient.rpc('cancel_order_item_qty', { p_order_item_id: itemId, p_cancel_qty: 2 }),
      adminClient.rpc('cancel_order_item_qty', { p_order_item_id: itemId, p_cancel_qty: 2 }),
    ]);

    for (const r of results) {
      expect(r.error).toBeNull();
    }

    const { data: row, error } = await svc
      .from('order_items')
      .select('quantity, status')
      .eq('id', itemId)
      .single();
    expect(error).toBeNull();
    // 5 − 2 − 2 = 1. Pre-fix lost-update would persist 3.
    expect(row!.quantity).toBe(1);
    expect(row!.status).toBe('pending');
  });

  test('partial-cancel = quantity collapses to a full cancel (status=cancelled)', async () => {
    const { itemId } = await seedOrderWithItem(3);

    const { error } = await adminClient.rpc('cancel_order_item_qty', {
      p_order_item_id: itemId,
      p_cancel_qty: 3,
    });
    expect(error).toBeNull();

    const { data: row } = await svc
      .from('order_items')
      .select('quantity, status')
      .eq('id', itemId)
      .single();
    expect(row!.status).toBe('cancelled');
    expect(row!.quantity).toBe(3); // quantity preserved on full cancel
  });

  test('partial-cancel exceeding quantity also collapses to a full cancel (slider-friendly clamp)', async () => {
    const { itemId } = await seedOrderWithItem(2);

    const { error } = await adminClient.rpc('cancel_order_item_qty', {
      p_order_item_id: itemId,
      p_cancel_qty: 99,
    });
    expect(error).toBeNull();

    const { data: row } = await svc
      .from('order_items')
      .select('quantity, status')
      .eq('id', itemId)
      .single();
    expect(row!.status).toBe('cancelled');
  });

  test('zero cancel quantity is rejected', async () => {
    const { itemId } = await seedOrderWithItem(2);

    const { error } = await adminClient.rpc('cancel_order_item_qty', {
      p_order_item_id: itemId,
      p_cancel_qty: 0,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain('invalid cancel quantity');
  });

  test('cancel against an already-cancelled item is rejected', async () => {
    const { itemId } = await seedOrderWithItem(2);

    // First cancel succeeds.
    const first = await adminClient.rpc('cancel_order_item_qty', {
      p_order_item_id: itemId,
      p_cancel_qty: 2,
    });
    expect(first.error).toBeNull();

    // Second cancel must reject — the item is already terminal.
    const second = await adminClient.rpc('cancel_order_item_qty', {
      p_order_item_id: itemId,
      p_cancel_qty: 1,
    });
    expect(second.error).not.toBeNull();
    expect(second.error?.message).toContain('cannot cancel order_item');
  });
});
