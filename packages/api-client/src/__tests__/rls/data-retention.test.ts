/**
 * Integration test — `run_data_retention()` (M11 retention + L4 audit archival).
 *
 * The RPC (migrations 20260424000004 → 20260505000001 → 20261010000004, exposed
 * via POST /api/v1/admin/retention) archives aged closed/cancelled orders + ALL
 * their children (items, payments, refunds, table_transfers, audit rows) into
 * the `archive.*` schema, then deletes them from the hot tables, and
 * PII-anonymizes aged delivery orders. This locks in:
 *   1. an aged closed order is pruned from public.orders (and reported archived);
 *   2. its refunds + financial_audit_log rows are ARCHIVED, not destroyed
 *      (reported via refunds_archived / audit_archived) — regression for the
 *      original CASCADE-destroys-money bug;
 *   3. its table_transfers row is archived losslessly too — the archival INSERT
 *      runs without error (column-parity guard) and the order still prunes
 *      (regression for 20261010000004, which added table_transfers to the
 *      archived set);
 *   4. an aged delivery order's PII is redacted in place.
 *   5. (MED-4) the archived rows ACTUALLY LAND in archive.* — including
 *      archive.table_transfers, the child with no surfaced return count — and
 *      (MED-5a) the archived order's PII is REDACTED in archive.orders.
 *
 * archive.* is now exposed to PostgREST (supabase/config.toml) but locked by a
 * RESTRICTIVE deny-all RLS policy for authenticated/anon (20261011000001).
 * service_role has BYPASSRLS, so the service-role client below reads it directly
 * — this is what lets us assert the archived rows rather than only inferring
 * them from a clean RPC run.
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
const TABLE_1 = '20000000-0000-0000-0000-000000000001';
const TABLE_2 = '20000000-0000-0000-0000-000000000002';
const ADMIN_STAFF_ID = '10000000-0000-0000-0000-000000000001';
// Comfortably past both the 24-month order and 12-month PII default windows.
const THREE_YEARS_AGO = '2023-01-01T00:00:00Z';

let svc: SupabaseClient;
const createdOrderIds: string[] = [];
let seq = 0;

async function insertOrder(fields: Record<string, unknown>): Promise<string> {
  // order_number is varchar(15): "RT" + 9-digit time slice + seq stays ≤ 13.
  const orderNumber = `RT${Date.now().toString().slice(-9)}${seq++}`;
  const { data, error } = await svc
    .from('orders')
    .insert({
      tenant_id: TENANT_1,
      table_id: TABLE_1,
      order_number: orderNumber,
      order_type: 'dine_in',
      source: 'waiter',
      subtotal: 0,
      tax: 0,
      total: 0,
      created_at: THREE_YEARS_AGO,
      ...fields,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Seed order failed: ${error?.message ?? 'no data'}`);
  createdOrderIds.push(data.id);
  return data.id;
}

beforeAll(() => {
  svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
});

afterAll(async () => {
  // The closed order is pruned by retention; the delivery order survives
  // (anonymized) — clean up whatever remains. Delete the RESTRICT-FK children
  // (financial_audit_log, refunds, order_payments) before orders;
  // table_transfers is CASCADE.
  if (createdOrderIds.length) {
    await svc.from('financial_audit_log').delete().in('order_id', createdOrderIds);
    await svc.from('refunds').delete().in('order_id', createdOrderIds);
    await svc.from('order_payments').delete().in('order_id', createdOrderIds);
    await svc.from('table_transfers').delete().in('order_id', createdOrderIds);
    await svc.from('order_items').delete().in('order_id', createdOrderIds);
    await svc.from('orders').delete().in('id', createdOrderIds);
    // Retention copies the aged orders into archive.* — clear those too so a
    // local re-run without `db reset` starts clean (CI always resets).
    const arc = svc.schema('archive');
    await arc.from('financial_audit_log').delete().in('order_id', createdOrderIds);
    await arc.from('refunds').delete().in('order_id', createdOrderIds);
    await arc.from('order_payments').delete().in('order_id', createdOrderIds);
    await arc.from('table_transfers').delete().in('order_id', createdOrderIds);
    await arc.from('order_items').delete().in('order_id', createdOrderIds);
    await arc.from('orders').delete().in('id', createdOrderIds);
  }
});

describe('run_data_retention', () => {
  test('prunes an aged closed order and anonymizes an aged delivery order', async () => {
    // (1) aged closed dine-in order → should be archived + pruned.
    const closedId = await insertOrder({ status: 'closed' });
    // (2) aged delivery order with PII → NOT archived (not closed/cancelled),
    //     but its customer PII should be redacted in place.
    const deliveryId = await insertOrder({
      status: 'delivered',
      order_type: 'delivery',
      table_id: null,
      customer_name: 'Jane Customer',
      customer_phone: '+15551234567',
      delivery_address: '1 Test Street',
    });

    // Sanity: both present and the delivery order's PII is intact pre-run.
    const pre = await svc.from('orders').select('id, customer_name').eq('id', deliveryId).single();
    expect(pre.data?.customer_name).toBe('Jane Customer');

    // Run with default windows (order 24mo / PII 12mo) — both seeds are 3y old.
    const { data: result, error } = await svc.rpc('run_data_retention');
    expect(error).toBeNull();
    const row = Array.isArray(result) ? result[0] : result;
    expect(Number(row.orders_archived)).toBeGreaterThanOrEqual(1);
    expect(Number(row.pii_anonymized)).toBeGreaterThanOrEqual(1);

    // (1) closed order pruned from the hot table.
    const closedAfter = await svc.from('orders').select('id').eq('id', closedId).maybeSingle();
    expect(closedAfter.data).toBeNull();

    // (2) delivery order retained but PII redacted.
    const deliveryAfter = await svc
      .from('orders')
      .select('id, customer_name, customer_phone, delivery_address')
      .eq('id', deliveryId)
      .single();
    expect(deliveryAfter.data?.customer_name).toBe('REDACTED');
    expect(deliveryAfter.data?.customer_phone).toBe('REDACTED');
    expect(deliveryAfter.data?.delivery_address).toBe('REDACTED');

    // (MED-4) the closed order physically LANDED in archive.orders (not just
    // vanished from the hot table), and (MED-5a) its PII is REDACTED there.
    const archivedClosed = await svc
      .schema('archive')
      .from('orders')
      .select('id, customer_name, customer_phone, delivery_address')
      .eq('id', closedId)
      .single();
    expect(archivedClosed.error).toBeNull();
    expect(archivedClosed.data?.id).toBe(closedId);
    expect(archivedClosed.data?.customer_name).toBe('REDACTED');
    expect(archivedClosed.data?.customer_phone).toBe('REDACTED');
    expect(archivedClosed.data?.delivery_address).toBe('REDACTED');
  });

  test('archives refund, audit, and table_transfer children instead of destroying them', async () => {
    // Aged closed order carrying all three "lossy-on-cascade" children:
    //   - a refund            (was CASCADE-destroyed pre-20260505000001)
    //   - a financial_audit_log row (same)
    //   - a table_transfer    (still CASCADE today — fixed by 20261010000004)
    // Seeding order mirrors the known-good recipe in refund-audit.test.ts and
    // payment-on-closed-order.test.ts (both pass in the same CI RLS job through
    // the same triggers). Payments are REJECTED on terminal orders
    // (20260503000006), so we can't seed a 'closed' order and then pay it — the
    // order must be OPEN when the payment + refund land, then transition to a
    // terminal state for retention to archive+prune it.
    //
    // Amounts — every trigger in the chain passes:
    //   order.total = 100
    //   payment 50  (partial): validate_payment_amount on OPEN order →
    //     remaining = total - SUM(paid) = 100 - 0 = 100; 50 <= 100 ✓, and a
    //     partial payment leaves status 'new' (not auto-closed).
    //   refund  25:  validate_refund_amount →
    //     available = SUM(paid) - SUM(refunded) = 50 - 0 = 50; 25 <= 50 ✓.
    //   close new→closed: legal (state-machine rule 2: any non-terminal → closed)
    //     and guard_close_order_unpaid (20260506000003) sees
    //     remaining = total - paid + refunded = 100 - 50 + 25 = 75 > 0.01, so a
    //     force_close_reason is required → supplied ('test_seed').
    const orderId = await insertOrder({ status: 'new', subtotal: 100, tax: 0, total: 100 });

    const { error: payErr } = await svc.from('order_payments').insert({
      tenant_id: TENANT_1,
      order_id: orderId,
      amount: 50,
      payment_method: 'cash',
      payment_type: 'partial_amount',
      received_by: ADMIN_STAFF_ID,
    });
    expect(payErr).toBeNull();

    const { error: refundErr } = await svc.from('refunds').insert({
      tenant_id: TENANT_1,
      order_id: orderId,
      processed_by: ADMIN_STAFF_ID,
      amount: 25,
      reason: 'retention regression seed',
      refund_method: 'cash',
    });
    expect(refundErr).toBeNull();

    // Explicit audit row (independent of the refund-insert trigger) so the
    // assertion doesn't rely on trigger behavior.
    const { error: auditErr } = await svc.from('financial_audit_log').insert({
      tenant_id: TENANT_1,
      order_id: orderId,
      action: 'refund',
    });
    expect(auditErr).toBeNull();

    const { error: transferErr } = await svc.from('table_transfers').insert({
      tenant_id: TENANT_1,
      order_id: orderId,
      from_table_id: TABLE_1,
      to_table_id: TABLE_2,
      transferred_by: ADMIN_STAFF_ID,
    });
    expect(transferErr).toBeNull();

    // Transition the (still 3-years-old) order to a terminal state so retention
    // archives+prunes it. force_close_reason satisfies guard_close_order_unpaid
    // for the 75 left outstanding after the refund (see amount trace above).
    const { error: closeErr } = await svc
      .from('orders')
      .update({ status: 'closed', force_close_reason: 'test_seed' })
      .eq('id', orderId);
    expect(closeErr).toBeNull();

    // A clean RPC run is itself the table_transfers column-parity guard: if
    // archive.table_transfers were misaligned, the positional `INSERT ... SELECT
    // *` would raise 42601 and `error` would be non-null.
    const { data: result, error } = await svc.rpc('run_data_retention');
    expect(error).toBeNull();
    const row = Array.isArray(result) ? result[0] : result;

    // Refund + audit rows were ARCHIVED (reported counts), not silently lost.
    expect(Number(row.refunds_archived)).toBeGreaterThanOrEqual(1);
    expect(Number(row.audit_archived)).toBeGreaterThanOrEqual(1);

    // The order (and all its children) are gone from the hot tables. The order
    // deleting at all proves the RESTRICT-FK children (refund, audit) were
    // cleared first — which only happens after they're archived.
    const orderAfter = await svc.from('orders').select('id').eq('id', orderId).maybeSingle();
    expect(orderAfter.data).toBeNull();
    const refundAfter = await svc.from('refunds').select('id').eq('order_id', orderId);
    expect(refundAfter.data ?? []).toHaveLength(0);
    const transferAfter = await svc.from('table_transfers').select('id').eq('order_id', orderId);
    expect(transferAfter.data ?? []).toHaveLength(0);

    // (MED-4) LOSSLESSNESS: the children physically LANDED in archive.*, read
    // back with the BYPASSRLS service-role client. The table_transfers row is
    // the important one — it carries no return count, so a clean RPC run alone
    // can't prove it was archived rather than cascade-destroyed.
    const archivedTransfer = await svc
      .schema('archive')
      .from('table_transfers')
      .select('order_id, from_table_id, to_table_id')
      .eq('order_id', orderId);
    expect(archivedTransfer.error).toBeNull();
    expect(archivedTransfer.data ?? []).toHaveLength(1);
    expect(archivedTransfer.data?.[0]?.from_table_id).toBe(TABLE_1);
    expect(archivedTransfer.data?.[0]?.to_table_id).toBe(TABLE_2);

    const archivedRefund = await svc
      .schema('archive')
      .from('refunds')
      .select('order_id, amount')
      .eq('order_id', orderId);
    expect(archivedRefund.error).toBeNull();
    expect(archivedRefund.data ?? []).toHaveLength(1);

    const archivedAudit = await svc
      .schema('archive')
      .from('financial_audit_log')
      .select('order_id')
      .eq('order_id', orderId);
    expect(archivedAudit.error).toBeNull();
    expect((archivedAudit.data ?? []).length).toBeGreaterThanOrEqual(1);

    // (MED-5a) the archived order copy has its PII redacted.
    const archivedOrder = await svc
      .schema('archive')
      .from('orders')
      .select('id, customer_name, customer_phone, delivery_address')
      .eq('id', orderId)
      .single();
    expect(archivedOrder.error).toBeNull();
    expect(archivedOrder.data?.customer_name).toBe('REDACTED');
    expect(archivedOrder.data?.customer_phone).toBe('REDACTED');
    expect(archivedOrder.data?.delivery_address).toBe('REDACTED');
  });
});
