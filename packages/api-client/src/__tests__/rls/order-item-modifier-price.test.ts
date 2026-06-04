/**
 * Integration test — `snapshot_item_price_from_menu()` prices modifier
 * deltas, server-authoritatively.
 *
 * The BEFORE INSERT trigger on order_items (migration 20260503000002)
 * overwrites the client-supplied `item_price` with the menu price so a
 * tampered client can't undercut the bill. It predated menu-item modifiers
 * (20260604000002), so it discarded option price deltas: an item with a
 * "+N" modifier was billed at the base price while `selected_options` still
 * advertised the upsell — every paid modifier was silently undercharged.
 *
 * Migration 20260604000003 makes the trigger modifier-aware: it re-derives
 * deltas from `menu_item_option_values` by the value_ids in
 * NEW.selected_options (never trusting the snapshot's own price_delta) and
 * sets item_price = base + Σ delta.
 *
 * This test exercises the REAL trigger via a direct service-role insert —
 * the seam the mocked customer-order-service unit tests can't reach. It
 * asserts:
 *   1. item_price = base + delta (the upsell reaches the bill).
 *   2. a tampered snapshot price_delta is ignored (re-derived from catalog).
 *   3. a value_id not attached to the item contributes 0 (base only).
 *
 * Run: pnpm test:rls
 * Prerequisites: local Supabase running, db reset & seeded.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const TENANT_1 = '00000000-0000-0000-0000-000000000001';
const SEED_TABLE_ID = '20000000-0000-0000-0000-000000000008';
const SEED_MENU_ITEM_ID = '40000000-0000-0000-0000-000000000001';
const DELTA = 3.5;

let svc: SupabaseClient;
let basePrice: number;
let optionId: string;
let valueId: string;
const createdOrderIds: string[] = [];

async function seedOrder(): Promise<string> {
  const orderNumber = `MP${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, '0')}`;
  const { data: order, error } = await svc
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
  if (error || !order) throw new Error(`Seed order failed: ${error?.message ?? 'no data'}`);
  createdOrderIds.push(order.id);
  return order.id;
}

/** Insert an order_item with the given snapshot; return the trigger-set item_price. */
async function insertItem(selectedOptions: unknown, clientPrice: number): Promise<number> {
  const orderId = await seedOrder();
  const { data, error } = await svc
    .from('order_items')
    .insert({
      tenant_id: TENANT_1,
      order_id: orderId,
      menu_item_id: SEED_MENU_ITEM_ID,
      item_name: 'Modifier Probe',
      item_price: clientPrice,
      quantity: 1,
      status: 'pending',
      selected_options: selectedOptions,
    })
    .select('item_price')
    .single();
  if (error || !data) throw new Error(`Insert order_item failed: ${error?.message ?? 'no data'}`);
  return Number(data.item_price);
}

beforeAll(async () => {
  svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: mi, error: miErr } = await svc
    .from('menu_items')
    .select('price')
    .eq('id', SEED_MENU_ITEM_ID)
    .eq('tenant_id', TENANT_1)
    .single();
  if (miErr || !mi) throw new Error(`Seed menu item lookup failed: ${miErr?.message ?? 'no data'}`);
  basePrice = Number(mi.price);

  const { data: opt, error: optErr } = await svc
    .from('menu_item_options')
    .insert({
      tenant_id: TENANT_1,
      menu_item_id: SEED_MENU_ITEM_ID,
      name: 'Test Size (modifier price probe)',
      selection_type: 'single',
      is_required: false,
    })
    .select('id')
    .single();
  if (optErr || !opt) throw new Error(`Seed option group failed: ${optErr?.message ?? 'no data'}`);
  optionId = opt.id;

  const { data: val, error: valErr } = await svc
    .from('menu_item_option_values')
    .insert({
      tenant_id: TENANT_1,
      option_id: optionId,
      name: 'Large',
      price_delta: DELTA,
    })
    .select('id')
    .single();
  if (valErr || !val) throw new Error(`Seed option value failed: ${valErr?.message ?? 'no data'}`);
  valueId = val.id;
});

afterAll(async () => {
  await svc.from('order_items').delete().in('order_id', createdOrderIds);
  await svc.from('financial_audit_log').delete().in('order_id', createdOrderIds);
  await svc.from('orders').delete().in('id', createdOrderIds);
  // Option rows cascade-delete their values via FK.
  if (optionId) await svc.from('menu_item_options').delete().eq('id', optionId);
});

describe('snapshot_item_price_from_menu — modifier deltas', () => {
  test('item_price = base + delta (the upsell reaches the bill)', async () => {
    const snapshot = [
      {
        option_id: optionId,
        option_name: 'Test Size',
        value_id: valueId,
        value_name: 'Large',
        price_delta: DELTA,
      },
    ];
    // Bogus client price must be overwritten by the trigger.
    const price = await insertItem(snapshot, 9999);
    expect(price).toBeCloseTo(basePrice + DELTA, 2);
  });

  test('tampered snapshot price_delta is ignored — re-derived from the catalog', async () => {
    const snapshot = [
      { option_id: optionId, value_id: valueId, value_name: 'Large', price_delta: 9999 },
    ];
    const price = await insertItem(snapshot, 0);
    expect(price).toBeCloseTo(basePrice + DELTA, 2);
  });

  test('a value_id not attached to this item contributes 0 (base only)', async () => {
    const snapshot = [
      {
        option_id: optionId,
        value_id: '99999999-9999-9999-9999-999999999999',
        value_name: 'Hax',
        price_delta: 50,
      },
    ];
    const price = await insertItem(snapshot, 0);
    expect(price).toBeCloseTo(basePrice, 2);
  });

  test('null selected_options prices at base (no modifiers)', async () => {
    const price = await insertItem(null, 12345);
    expect(price).toBeCloseTo(basePrice, 2);
  });
});
