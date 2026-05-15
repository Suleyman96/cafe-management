/**
 * Integration test — `orders_takeout_customer_check` constraint after the
 * delivery relaxation (migration 20260515000005). The CHECK now allows
 * delivery orders with `customer_name` alone; takeout still requires both
 * `customer_name` and `customer_phone`. Also exercises the
 * `delivery_customers.address` relaxation (migration 20260515000006).
 *
 * Pre-relaxation a name-only delivery insert would have been rejected with
 * SQLSTATE 23514. This file pins the new boundary so a future revert (or
 * a duplicate constraint added elsewhere) breaks the test instead of
 * silently re-tightening the rule.
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
const PG_CHECK_VIOLATION = '23514';
const PG_NOT_NULL_VIOLATION = '23502';

let svc: SupabaseClient;
const createdOrderIds: string[] = [];
const createdCustomerIds: string[] = [];

function uniqueOrderNumber(): string {
  return `DC${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, '0')}`;
}

beforeAll(() => {
  svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
});

afterAll(async () => {
  if (createdOrderIds.length > 0) {
    await svc.from('orders').delete().in('id', createdOrderIds);
  }
  if (createdCustomerIds.length > 0) {
    await svc.from('delivery_customers').delete().in('id', createdCustomerIds);
  }
});

describe('orders_takeout_customer_check — delivery relaxation', () => {
  test('delivery order with only customer_name inserts', async () => {
    const { data, error } = await svc
      .from('orders')
      .insert({
        tenant_id: TENANT_1,
        order_number: uniqueOrderNumber(),
        status: 'new',
        order_type: 'delivery',
        source: 'waiter',
        subtotal: 0,
        tax: 0,
        total: 0,
        customer_name: 'Phone-In Customer',
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    if (data?.id) createdOrderIds.push(data.id);
  });

  test('delivery order with name + phone (no address) inserts', async () => {
    const { data, error } = await svc
      .from('orders')
      .insert({
        tenant_id: TENANT_1,
        order_number: uniqueOrderNumber(),
        status: 'new',
        order_type: 'delivery',
        source: 'waiter',
        subtotal: 0,
        tax: 0,
        total: 0,
        customer_name: 'Call-In Customer',
        customer_phone: '+994500000000',
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    if (data?.id) createdOrderIds.push(data.id);
  });

  test('delivery order without customer_name fails CHECK', async () => {
    const { error } = await svc.from('orders').insert({
      tenant_id: TENANT_1,
      order_number: uniqueOrderNumber(),
      status: 'new',
      order_type: 'delivery',
      source: 'waiter',
      subtotal: 0,
      tax: 0,
      total: 0,
      customer_phone: '+994500000000',
    });

    expect(error).not.toBeNull();
    expect(error?.code).toBe(PG_CHECK_VIOLATION);
  });

  test('takeout order still requires customer_phone (regression guard)', async () => {
    const { error } = await svc.from('orders').insert({
      tenant_id: TENANT_1,
      order_number: uniqueOrderNumber(),
      status: 'new',
      order_type: 'takeout',
      source: 'waiter',
      subtotal: 0,
      tax: 0,
      total: 0,
      customer_name: 'Takeout Customer',
    });

    expect(error).not.toBeNull();
    expect(error?.code).toBe(PG_CHECK_VIOLATION);
  });
});

describe('delivery_customers.address — nullable relaxation', () => {
  test('saved profile with name only inserts', async () => {
    const { data, error } = await svc
      .from('delivery_customers')
      .insert({
        tenant_id: TENANT_1,
        name: `Test ${Date.now()}`,
      })
      .select('id, address, phone')
      .single();

    expect(error).toBeNull();
    expect(data?.address).toBeNull();
    expect(data?.phone).toBeNull();
    if (data?.id) createdCustomerIds.push(data.id);
  });

  test('saved profile without name still fails NOT NULL', async () => {
    const { error } = await svc.from('delivery_customers').insert({
      tenant_id: TENANT_1,
      address: '1 Test St',
    });

    expect(error).not.toBeNull();
    expect(error?.code).toBe(PG_NOT_NULL_VIOLATION);
  });
});
