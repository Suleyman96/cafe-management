/**
 * Integration test — `guard_close_order_unpaid` rejects closing an order
 * with an unsettled balance unless `force_close_reason` rides on the same
 * UPDATE.
 *
 * Migration `20260506000003_close_order_unpaid_guard.sql` adds:
 *   - `orders.force_close_reason TEXT`
 *   - `guard_close_order_unpaid` BEFORE UPDATE OF status trigger
 *
 * The trigger reuses the canonical `get_order_remaining_balance`
 * function so test setup mirrors real flows: insert an order with a total,
 * land partial payments via order_payments, then attempt to close.
 *
 * Run: pnpm test:rls
 *
 * Prerequisites: local Supabase running, db reset & seeded.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const TENANT_1 = '00000000-0000-0000-0000-000000000001';
const ADMIN_STAFF_ID = '10000000-0000-0000-0000-000000000001';
const SEED_TABLE_ID = '20000000-0000-0000-0000-000000000008';
// PL/pgSQL `RAISE EXCEPTION` without an explicit ERRCODE in the function
// body uses the SQLSTATE assigned via USING ERRCODE = 'P0002'. supabase-js
// surfaces that on `error.code`.
const PG_NO_DATA_FOUND = 'P0002';

let svc: SupabaseClient;
const createdOrderIds: string[] = [];

async function seedOrder(total: number): Promise<string> {
  const orderNumber = `CG${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, '0')}`;
  const { data, error } = await svc
    .from('orders')
    .insert({
      tenant_id: TENANT_1,
      table_id: SEED_TABLE_ID,
      order_number: orderNumber,
      // Seed in `served` so the close transition is the legal one for a
      // dine-in order under the state-machine trigger.
      status: 'served',
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

async function landPayment(orderId: string, amount: number) {
  const { error } = await svc.from('order_payments').insert({
    tenant_id: TENANT_1,
    order_id: orderId,
    amount,
    payment_method: 'cash',
    payment_type: 'partial_amount',
    received_by: ADMIN_STAFF_ID,
  });
  if (error) throw new Error(`landPayment failed: ${error.message}`);
}

async function tryClose(orderId: string, opts?: { reason?: string }) {
  const update: Record<string, unknown> = { status: 'closed' };
  if (opts?.reason !== undefined) {
    update.force_close_reason = opts.reason;
  }
  return svc
    .from('orders')
    .update(update)
    .eq('id', orderId)
    .select('id, status, force_close_reason')
    .single();
}

beforeAll(() => {
  svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
});

afterAll(async () => {
  if (createdOrderIds.length === 0) return;
  // Financial children are ON DELETE RESTRICT (20260505000001) — clear
  // payments + audit explicitly before deleting orders.
  await svc.from('order_payments').delete().in('order_id', createdOrderIds);
  await svc.from('financial_audit_log').delete().in('order_id', createdOrderIds);
  await svc.from('orders').delete().in('id', createdOrderIds);
});

describe('guard_close_order_unpaid', () => {
  test('rejects close on an unpaid order with no reason', async () => {
    const orderId = await seedOrder(100);

    const { error } = await tryClose(orderId);

    expect(error).not.toBeNull();
    expect(error?.code).toBe(PG_NO_DATA_FOUND);
    expect(error?.message).toContain('order_close_requires_payment_or_reason');

    // Side-effect check: status didn't flip.
    const { data: row } = await svc.from('orders').select('status').eq('id', orderId).single();
    expect(row?.status).toBe('served');
  });

  test('rejects close on a partially-paid order with no reason', async () => {
    const orderId = await seedOrder(100);
    await landPayment(orderId, 40);

    const { error } = await tryClose(orderId);

    expect(error).not.toBeNull();
    expect(error?.code).toBe(PG_NO_DATA_FOUND);
    expect(error?.message).toContain('order_close_requires_payment_or_reason');
  });

  test('allows close on an unpaid order when force_close_reason is supplied', async () => {
    const orderId = await seedOrder(75);

    const { error, data } = await tryClose(orderId, { reason: 'comped' });

    expect(error).toBeNull();
    expect(data?.status).toBe('closed');
    expect(data?.force_close_reason).toBe('comped');
  });

  test('allows close on a fully-paid order without a reason (happy path)', async () => {
    const orderId = await seedOrder(50);
    await landPayment(orderId, 50);

    const { error, data } = await tryClose(orderId);

    expect(error).toBeNull();
    expect(data?.status).toBe('closed');
    expect(data?.force_close_reason).toBeNull();
  });

  test('tolerates sub-cent precision drift on the paid side', async () => {
    // total 10.00 paid 9.999 — within the 0.01 epsilon, treated as paid.
    const orderId = await seedOrder(10.0);
    await landPayment(orderId, 9.999);

    const { error, data } = await tryClose(orderId);

    expect(error).toBeNull();
    expect(data?.status).toBe('closed');
  });

  test('1-cent shortfall is treated as unpaid (epsilon does not let real money slip)', async () => {
    const orderId = await seedOrder(20.0);
    await landPayment(orderId, 19.98); // 0.02 short — outside epsilon

    const { error } = await tryClose(orderId);

    expect(error).not.toBeNull();
    expect(error?.code).toBe(PG_NO_DATA_FOUND);
    expect(error?.message).toContain('order_close_requires_payment_or_reason');
  });
});
