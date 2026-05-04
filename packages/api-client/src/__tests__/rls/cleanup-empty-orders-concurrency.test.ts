/**
 * cleanup_empty_orders concurrency probe.
 *
 * The RPC defined in 20260423000003_cleanup_empty_orders_function.sql
 * (hardened in 20260430000002_multitenant_security_hardening.sql) bulk-cancels
 * orders older than `p_older_than_minutes` that have zero items. Under
 * READ COMMITTED isolation the SELECT-then-UPDATE pattern leaves a TOCTOU
 * window: a concurrent first-item insert could land between the empty check
 * and the cancellation.
 *
 * This test backdates an order so it qualifies for cleanup, then races an
 * order_items insert against the cleanup RPC. The invariant is: after both
 * operations settle, an order that contains items must NOT be cancelled.
 *
 * Run: pnpm test:rls
 *
 * Prerequisites: local Supabase running, db reset & seeded.
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

async function seedBackdatedEmptyOrder(): Promise<string> {
  const orderNumber = `CL${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, '0')}`;
  const { data, error } = await svc
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
      // Backdate so the 2-minute eligibility filter accepts it.
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`Seed order failed: ${error?.message ?? 'no data'}`);
  }
  const orderId = data.id as string;
  createdOrderIds.push(orderId);
  return orderId;
}

async function insertOrderItem(orderId: string): Promise<void> {
  const { error } = await svc.from('order_items').insert({
    tenant_id: TENANT_1,
    order_id: orderId,
    menu_item_id: SEED_MENU_ITEM_ID,
    item_name: 'Matcha Latte',
    item_price: 550,
    quantity: 1,
    status: 'pending',
  });
  if (error) throw new Error(`insertOrderItem failed: ${error.message}`);
}

beforeAll(async () => {
  svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // cleanup_empty_orders runs as SECURITY DEFINER but reads auth.uid() to
  // resolve the caller's tenant + role. Service role gives us nothing; the
  // RPC must be invoked through an authenticated admin session.
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
  // order_items DELETE fires the recalculate trigger which writes audit
  // rows; financial_audit_log → orders is now ON DELETE RESTRICT
  // (20260505000001) so clear it before deleting orders.
  await svc.from('order_items').delete().in('order_id', createdOrderIds);
  await svc.from('financial_audit_log').delete().in('order_id', createdOrderIds);
  await svc.from('orders').delete().in('id', createdOrderIds);
});

describe('cleanup_empty_orders concurrency', () => {
  test('order receiving its first item during cleanup must not be cancelled', async () => {
    const orderId = await seedBackdatedEmptyOrder();

    await Promise.all([
      insertOrderItem(orderId),
      adminClient.rpc('cleanup_empty_orders', { p_older_than_minutes: 2 }),
    ]);

    const { data: order, error: orderErr } = await svc
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single();
    expect(orderErr).toBeNull();

    const { data: items, error: itemsErr } = await svc
      .from('order_items')
      .select('id')
      .eq('order_id', orderId);
    expect(itemsErr).toBeNull();

    if ((items?.length ?? 0) > 0) {
      // Invariant: a non-empty order must not be auto-cancelled.
      expect(order!.status).not.toBe('cancelled');
    }
  });

  test('repeated races never produce a cancelled order with items', async () => {
    const TRIALS = 8;
    const results: Array<{ status: string; itemCount: number }> = [];

    for (let i = 0; i < TRIALS; i++) {
      const orderId = await seedBackdatedEmptyOrder();
      await Promise.all([
        insertOrderItem(orderId),
        adminClient.rpc('cleanup_empty_orders', { p_older_than_minutes: 2 }),
      ]);

      const { data: order } = await svc.from('orders').select('status').eq('id', orderId).single();
      const { data: items } = await svc.from('order_items').select('id').eq('order_id', orderId);

      results.push({
        status: order!.status as string,
        itemCount: items?.length ?? 0,
      });
    }

    const violations = results.filter((r) => r.status === 'cancelled' && r.itemCount > 0);
    expect(violations).toEqual([]);
  });
});
