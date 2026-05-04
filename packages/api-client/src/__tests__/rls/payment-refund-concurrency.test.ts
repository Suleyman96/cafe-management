/**
 * Concurrency Integration Tests — Atomic Payment & Refund Validation
 *
 * Verifies that the BEFORE-INSERT triggers `validate_payment_amount` and
 * `validate_refund_amount` correctly serialize concurrent inserts via the
 * row lock added in 20260503000003_atomic_payment_refund_locking.sql.
 *
 * Pre-fix bug: under READ COMMITTED, two concurrent inserts both saw the
 * same pre-insert snapshot, both passed the amount check, and both
 * committed — producing total_paid > order.total or
 * total_refunded > total_paid.
 *
 * Each test seeds a real order via service-role and fires the racing
 * inserts via Promise.allSettled. We assert (a) the post-condition holds
 * (no overpayment / no over-refund) and (b) the expected number of
 * fulfilled vs. rejected promises.
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
// Reserved table from the seed (T08 — id ends in …008).
const SEED_TABLE_ID = '20000000-0000-0000-0000-000000000008';

let svc: SupabaseClient;
const createdOrderIds: string[] = [];

async function seedOrder(total: number): Promise<string> {
  const orderNumber = `RC${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 100)
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

async function paySync(orderId: string, amount: number, method = 'cash'): Promise<void> {
  const { error } = await svc.from('order_payments').insert({
    tenant_id: TENANT_1,
    order_id: orderId,
    amount,
    payment_method: method,
    payment_type: 'partial_amount',
    received_by: ADMIN_STAFF_ID,
  });
  if (error) {
    throw new Error(`paySync failed: ${error.message}`);
  }
}

beforeAll(() => {
  svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
});

afterAll(async () => {
  if (createdOrderIds.length === 0) return;
  // Financial children are ON DELETE RESTRICT (20260505000001) — clear them
  // explicitly before deleting orders.
  await svc.from('refunds').delete().in('order_id', createdOrderIds);
  await svc.from('order_payments').delete().in('order_id', createdOrderIds);
  await svc.from('financial_audit_log').delete().in('order_id', createdOrderIds);
  await svc.from('orders').delete().in('id', createdOrderIds);
});

describe('atomic refund validation under concurrent inserts', () => {
  test('5 concurrent $30 refunds against a $100 paid order — at most 3 succeed', async () => {
    const orderId = await seedOrder(100);
    await paySync(orderId, 100);

    const refundOnce = () =>
      svc.from('refunds').insert({
        tenant_id: TENANT_1,
        order_id: orderId,
        processed_by: ADMIN_STAFF_ID,
        amount: 30,
        reason: 'concurrency probe',
        refund_method: 'cash',
      });

    const results = await Promise.allSettled([
      refundOnce(),
      refundOnce(),
      refundOnce(),
      refundOnce(),
      refundOnce(),
    ]);

    // PostgREST returns errors as { error } in the resolved payload, not as
    // a rejected promise — count both 'error' shapes.
    const succeeded = results.filter(
      (r) => r.status === 'fulfilled' && (r.value as { error: unknown }).error == null,
    ).length;

    // Read back the persisted total — this is the load-bearing assertion.
    const { data: refundRows } = await svc.from('refunds').select('amount').eq('order_id', orderId);
    const totalRefunded = (refundRows ?? []).reduce((sum, r) => sum + Number(r.amount), 0);

    expect(totalRefunded).toBeLessThanOrEqual(100);
    expect(succeeded).toBeLessThanOrEqual(3);
    // Exactly 3 should have succeeded (3 × 30 = 90 ≤ 100; the 4th would push
    // to 120 > 100). The trigger must reject the 4th and 5th.
    expect(succeeded).toBe(3);
    expect(totalRefunded).toBe(90);

    // Every rejection must carry the sentinel error code from the trigger
    // (not some unrelated failure like a deadlock).
    const rejectionMessages = results
      .filter((r) => r.status === 'fulfilled' && (r.value as { error: unknown }).error != null)
      .map((r) => {
        const err = (r as PromiseFulfilledResult<{ error: { message: string } }>).value.error;
        return err.message;
      });
    for (const msg of rejectionMessages) {
      expect(msg).toContain('refund_exceeds_available');
    }
  });
});

describe('atomic payment validation under concurrent inserts', () => {
  test('2 concurrent $60 payments against a $100 order — at most 1 succeeds', async () => {
    const orderId = await seedOrder(100);

    const payOnce = () =>
      svc.from('order_payments').insert({
        tenant_id: TENANT_1,
        order_id: orderId,
        amount: 60,
        payment_method: 'cash',
        payment_type: 'partial_amount',
        received_by: ADMIN_STAFF_ID,
      });

    const results = await Promise.allSettled([payOnce(), payOnce()]);

    const succeeded = results.filter(
      (r) => r.status === 'fulfilled' && (r.value as { error: unknown }).error == null,
    ).length;

    const { data: paymentRows } = await svc
      .from('order_payments')
      .select('amount')
      .eq('order_id', orderId);
    const totalPaid = (paymentRows ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

    expect(totalPaid).toBeLessThanOrEqual(100);
    expect(succeeded).toBe(1);
    expect(totalPaid).toBe(60);

    const rejectionMessages = results
      .filter((r) => r.status === 'fulfilled' && (r.value as { error: unknown }).error != null)
      .map(
        (r) => (r as PromiseFulfilledResult<{ error: { message: string } }>).value.error.message,
      );
    for (const msg of rejectionMessages) {
      expect(msg).toContain('payment_exceeds_remaining');
    }
  });
});

describe('tenant guard on payment & refund triggers', () => {
  test('refund with mismatched tenant_id is rejected', async () => {
    const orderId = await seedOrder(100);
    await paySync(orderId, 100);

    const fakeTenant = '00000000-0000-0000-0000-000000000099';
    const { error } = await svc.from('refunds').insert({
      tenant_id: fakeTenant,
      order_id: orderId,
      processed_by: ADMIN_STAFF_ID,
      amount: 10,
      reason: 'tenant probe',
      refund_method: 'cash',
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain('refund_tenant_mismatch');
  });

  test('payment with mismatched tenant_id is rejected', async () => {
    const orderId = await seedOrder(100);

    const fakeTenant = '00000000-0000-0000-0000-000000000099';
    const { error } = await svc.from('order_payments').insert({
      tenant_id: fakeTenant,
      order_id: orderId,
      amount: 10,
      payment_method: 'cash',
      payment_type: 'partial_amount',
      received_by: ADMIN_STAFF_ID,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain('payment_tenant_mismatch');
  });
});
