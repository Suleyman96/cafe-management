/**
 * Integration test — `run_data_retention()` (M11 retention + L4 audit archival).
 *
 * The RPC (migration 20260424000004, exposed via POST /api/v1/admin/retention)
 * archives aged closed/cancelled orders + their financial children + audit rows
 * into the `archive.*` schema, then deletes them from the hot tables, and
 * PII-anonymizes aged delivery orders. It deletes financial data, yet had no
 * test. This locks in the two headline behaviors:
 *   1. an aged closed order is pruned from public.orders (and reported archived);
 *   2. an aged delivery order's PII is redacted in place.
 *
 * archive.* isn't exposed via PostgREST, so we assert the public-side prune +
 * the RPC's own archived-count return rather than reading the archive tables.
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
  // (anonymized) — clean up whatever remains. financial_audit_log first
  // (ON DELETE RESTRICT to orders).
  if (createdOrderIds.length) {
    await svc.from('financial_audit_log').delete().in('order_id', createdOrderIds);
    await svc.from('order_items').delete().in('order_id', createdOrderIds);
    await svc.from('orders').delete().in('id', createdOrderIds);
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
  });
});
