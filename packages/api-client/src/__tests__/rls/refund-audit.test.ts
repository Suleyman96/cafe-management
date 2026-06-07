/**
 * Refund Audit Trigger — Integration Tests
 *
 * Verifies the AFTER-INSERT trigger added in
 * 20260503000004_audit_refund_inserts.sql writes one financial_audit_log row
 * per refund, with action='refund', preserving tenant_id and staff_id and
 * recording the refund metadata under details.
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

let svc: SupabaseClient;
const createdOrderIds: string[] = [];

async function seedOrder(total: number): Promise<string> {
  const orderNumber = `RA${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 100)
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

async function paySync(orderId: string, amount: number): Promise<void> {
  const { error } = await svc.from('order_payments').insert({
    tenant_id: TENANT_1,
    order_id: orderId,
    amount,
    payment_method: 'cash',
    payment_type: 'partial_amount',
    received_by: ADMIN_STAFF_ID,
  });
  if (error) throw new Error(`paySync failed: ${error.message}`);
}

beforeAll(() => {
  svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
});

afterAll(async () => {
  if (createdOrderIds.length === 0) return;
  // Financial children are ON DELETE RESTRICT (20260505000001) — clear
  // financial_audit_log explicitly too.
  await svc.from('refunds').delete().in('order_id', createdOrderIds);
  await svc.from('order_payments').delete().in('order_id', createdOrderIds);
  await svc.from('financial_audit_log').delete().in('order_id', createdOrderIds);
  await svc.from('orders').delete().in('id', createdOrderIds);
});

describe('refund audit trigger', () => {
  test('insert into refunds writes a financial_audit_log row with action=refund', async () => {
    const orderId = await seedOrder(100);
    await paySync(orderId, 100);

    const { data: refund, error: refundErr } = await svc
      .from('refunds')
      .insert({
        tenant_id: TENANT_1,
        order_id: orderId,
        processed_by: ADMIN_STAFF_ID,
        amount: 25,
        reason: 'audit-trigger probe',
        refund_method: 'cash',
      })
      .select('id')
      .single();
    expect(refundErr).toBeNull();
    expect(refund).not.toBeNull();

    const { data: auditRows, error: auditErr } = await svc
      .from('financial_audit_log')
      .select('tenant_id, order_id, staff_id, action, details, triggered_by')
      .eq('action', 'refund')
      .eq('order_id', orderId);
    expect(auditErr).toBeNull();
    expect(auditRows).toHaveLength(1);

    // length asserted to be 1 above — index 0 is in-bounds
    const row = auditRows![0]!;
    expect(row.tenant_id).toBe(TENANT_1);
    expect(row.staff_id).toBe(ADMIN_STAFF_ID);
    expect(row.order_id).toBe(orderId);
    expect(row.triggered_by).toBe('trigger:log_refund_on_insert');

    const details = row.details as Record<string, unknown>;
    expect(details.refund_id).toBe(refund!.id);
    expect(Number(details.amount)).toBe(25);
    expect(details.reason).toBe('audit-trigger probe');
    expect(details.refund_method).toBe('cash');
    expect(details.backfilled).toBeUndefined();
  });

  test('refund count matches financial_audit_log refund-action count', async () => {
    const orderId = await seedOrder(100);
    await paySync(orderId, 100);

    for (const amount of [10, 15, 20]) {
      const { error } = await svc.from('refunds').insert({
        tenant_id: TENANT_1,
        order_id: orderId,
        processed_by: ADMIN_STAFF_ID,
        amount,
        reason: `count probe ${amount}`,
        refund_method: 'cash',
      });
      expect(error).toBeNull();
    }

    const { count: refundCount } = await svc
      .from('refunds')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', orderId);

    const { count: auditCount } = await svc
      .from('financial_audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', orderId)
      .eq('action', 'refund');

    expect(refundCount).toBe(3);
    expect(auditCount).toBe(refundCount);
  });
});
