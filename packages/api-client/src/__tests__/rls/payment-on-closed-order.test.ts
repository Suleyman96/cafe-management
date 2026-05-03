/**
 * Integration test — `validate_payment_amount` rejects payments against
 * orders whose status is `closed` or `cancelled`.
 *
 * The pre-fix trigger (20260503000003) only guarded against overpayment
 * and tenant mismatch. A late insert against a settled or aborted order
 * would land successfully and trip the AFTER trigger
 * `update_order_payment_status`, leaving phantom credit balances and
 * inconsistent payment_status.
 *
 * Migration `20260503000006_payment_reject_closed_orders.sql` adds the
 * status check after the FOR UPDATE lock; this test verifies the new
 * behavior end-to-end against the live trigger.
 *
 * Run: pnpm test:rls
 *
 * Prerequisites: local Supabase running, db reset & seeded.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const SUPABASE_URL = 'http://127.0.0.1:54321';
// Local-dev service-role JWT — only valid against localhost:54321.
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const TENANT_1 = '00000000-0000-0000-0000-000000000001';
const ADMIN_STAFF_ID = '10000000-0000-0000-0000-000000000001';
const SEED_TABLE_ID = '20000000-0000-0000-0000-000000000008';

let svc: SupabaseClient;
const createdOrderIds: string[] = [];

async function seedOrder(total: number): Promise<string> {
  const orderNumber = `PC${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 100)
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
      subtotal: total,
      tax: 0,
      total,
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`Seed order failed: ${error?.message ?? 'no data'}`);
  }
  createdOrderIds.push(data.id);
  return data.id;
}

async function setOrderStatus(orderId: string, status: 'closed' | 'cancelled'): Promise<void> {
  const { error } = await svc.from('orders').update({ status }).eq('id', orderId);
  if (error) throw new Error(`setOrderStatus failed: ${error.message}`);
}

function payOnce(orderId: string, amount: number) {
  return svc.from('order_payments').insert({
    tenant_id: TENANT_1,
    order_id: orderId,
    amount,
    payment_method: 'cash',
    payment_type: 'partial_amount',
    received_by: ADMIN_STAFF_ID,
  });
}

beforeAll(() => {
  svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
});

afterAll(async () => {
  if (createdOrderIds.length === 0) return;
  await svc.from('order_payments').delete().in('order_id', createdOrderIds);
  await svc.from('orders').delete().in('id', createdOrderIds);
});

describe('validate_payment_amount terminal-state rejection', () => {
  test('payment against a closed order is rejected with payment_on_terminal_order', async () => {
    const orderId = await seedOrder(100);
    await setOrderStatus(orderId, 'closed');

    const { error } = await payOnce(orderId, 25);

    expect(error).not.toBeNull();
    expect(error?.message).toContain('payment_on_terminal_order');

    // Side-effect check: nothing landed.
    const { data: payments } = await svc
      .from('order_payments')
      .select('id')
      .eq('order_id', orderId);
    expect(payments ?? []).toHaveLength(0);
  });

  test('payment against a cancelled order is rejected with payment_on_terminal_order', async () => {
    const orderId = await seedOrder(50);
    await setOrderStatus(orderId, 'cancelled');

    const { error } = await payOnce(orderId, 10);

    expect(error).not.toBeNull();
    expect(error?.message).toContain('payment_on_terminal_order');

    const { data: payments } = await svc
      .from('order_payments')
      .select('id')
      .eq('order_id', orderId);
    expect(payments ?? []).toHaveLength(0);
  });

  test('payment against an open order still succeeds (regression guard)', async () => {
    const orderId = await seedOrder(40);

    const { error } = await payOnce(orderId, 40);

    expect(error).toBeNull();

    const { data: payments } = await svc
      .from('order_payments')
      .select('amount')
      .eq('order_id', orderId);
    expect((payments ?? []).reduce((s, p) => s + Number(p.amount), 0)).toBe(40);
  });
});
