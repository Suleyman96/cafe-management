/**
 * Integration test — server-side enforcement of the order status state
 * machine.
 *
 * Migrations 20260504000007 + 20260504000008 install a BEFORE UPDATE
 * trigger that validates (OLD.status, NEW.status, NEW.order_type) against
 * the legal-transitions table encoded in the trigger function. The schema's
 * `orders_status_check` constraint validates the enum value but says
 * nothing about transitions; without the trigger a buggy client could
 * UPDATE an order from `served` back to `new` (or jump straight to
 * `served` from `new`, skipping preparing/ready) and the schema would
 * accept it.
 *
 * Pre-fix this whole file would have shown all UPDATEs succeeding. The
 * trigger raises with ERRCODE = check_violation (SQLSTATE 23514) which
 * supabase-js surfaces as a PostgrestError on `error.code`.
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
const SEED_TABLE_ID = '20000000-0000-0000-0000-000000000008';
const PG_CHECK_VIOLATION = '23514';

let svc: SupabaseClient;
const createdOrderIds: string[] = [];

async function seedOrder(opts: {
  status: string;
  order_type: 'dine_in' | 'takeout' | 'delivery';
}): Promise<string> {
  const orderNumber = `ST${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, '0')}`;
  const insert: Record<string, unknown> = {
    tenant_id: TENANT_1,
    order_number: orderNumber,
    status: opts.status,
    order_type: opts.order_type,
    source: 'waiter',
    subtotal: 0,
    tax: 0,
    total: 0,
  };
  if (opts.order_type === 'dine_in') {
    insert.table_id = SEED_TABLE_ID;
  } else {
    // takeout requires customer name+phone per orders_takeout_customer_check;
    // delivery only requires customer_name (phone optional). The seed
    // sets both so the same helper works for either type. customer_name
    // and customer_phone are encrypted by trg_encrypt_order_pii on insert.
    insert.customer_name = 'Test Customer';
    insert.customer_phone = '+994500000000';
  }
  if (opts.order_type === 'delivery') {
    insert.delivery_address = '1 Test St';
  }

  const { data, error } = await svc.from('orders').insert(insert).select('id').single();
  if (error || !data) {
    throw new Error(`Seed order failed: ${error?.message ?? 'no data'}`);
  }
  createdOrderIds.push(data.id);
  return data.id;
}

async function trySetStatus(orderId: string, status: string) {
  return svc.from('orders').update({ status }).eq('id', orderId).select('id, status').single();
}

beforeAll(() => {
  svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
});

afterAll(async () => {
  if (createdOrderIds.length > 0) {
    await svc.from('orders').delete().in('id', createdOrderIds);
  }
});

describe('order status state machine — universal rules', () => {
  test('terminal state closed cannot transition to anything', async () => {
    const orderId = await seedOrder({ status: 'closed', order_type: 'dine_in' });

    const { error } = await trySetStatus(orderId, 'new');
    expect(error).not.toBeNull();
    expect(error?.code).toBe(PG_CHECK_VIOLATION);
    expect(error?.message).toMatch(/terminal state/i);
  });

  test('terminal state cancelled cannot transition to anything', async () => {
    const orderId = await seedOrder({ status: 'cancelled', order_type: 'dine_in' });

    const { error } = await trySetStatus(orderId, 'preparing');
    expect(error).not.toBeNull();
    expect(error?.code).toBe(PG_CHECK_VIOLATION);
  });

  test('any non-terminal can jump to cancelled', async () => {
    const orderId = await seedOrder({ status: 'preparing', order_type: 'dine_in' });

    const { error, data } = await trySetStatus(orderId, 'cancelled');
    expect(error).toBeNull();
    expect(data?.status).toBe('cancelled');
  });

  test('any non-terminal can jump to closed', async () => {
    const orderId = await seedOrder({ status: 'new', order_type: 'dine_in' });

    const { error, data } = await trySetStatus(orderId, 'closed');
    expect(error).toBeNull();
    expect(data?.status).toBe('closed');
  });

  test('writing the same status is a no-op (passes validation)', async () => {
    const orderId = await seedOrder({ status: 'preparing', order_type: 'dine_in' });

    const { error, data } = await trySetStatus(orderId, 'preparing');
    expect(error).toBeNull();
    expect(data?.status).toBe('preparing');
  });
});

describe('order status state machine — illegal regressions', () => {
  test('rejects served -> new (backward regression)', async () => {
    const orderId = await seedOrder({ status: 'served', order_type: 'dine_in' });

    const { error } = await trySetStatus(orderId, 'new');
    expect(error).not.toBeNull();
    expect(error?.code).toBe(PG_CHECK_VIOLATION);
    expect(error?.message).toMatch(/illegal/i);
  });

  test('rejects ready -> preparing (backward regression)', async () => {
    const orderId = await seedOrder({ status: 'ready', order_type: 'dine_in' });

    const { error } = await trySetStatus(orderId, 'preparing');
    expect(error).not.toBeNull();
    expect(error?.code).toBe(PG_CHECK_VIOLATION);
  });

  test('rejects preparing -> new (backward regression)', async () => {
    const orderId = await seedOrder({ status: 'preparing', order_type: 'dine_in' });

    const { error } = await trySetStatus(orderId, 'new');
    expect(error).not.toBeNull();
    expect(error?.code).toBe(PG_CHECK_VIOLATION);
  });
});

describe('order status state machine — illegal forward skips', () => {
  test('rejects new -> served (skips preparing+ready)', async () => {
    const orderId = await seedOrder({ status: 'new', order_type: 'dine_in' });

    const { error } = await trySetStatus(orderId, 'served');
    expect(error).not.toBeNull();
    expect(error?.code).toBe(PG_CHECK_VIOLATION);
  });

  test('rejects pending_approval -> preparing (skips new)', async () => {
    const orderId = await seedOrder({ status: 'pending_approval', order_type: 'dine_in' });

    const { error } = await trySetStatus(orderId, 'preparing');
    expect(error).not.toBeNull();
    expect(error?.code).toBe(PG_CHECK_VIOLATION);
  });
});

describe('order status state machine — dine_in flow', () => {
  test('walks the full forward path pending_approval -> new -> preparing -> ready -> served', async () => {
    const orderId = await seedOrder({ status: 'pending_approval', order_type: 'dine_in' });

    for (const next of ['new', 'preparing', 'ready', 'served']) {
      const { error, data } = await trySetStatus(orderId, next);
      expect(error).toBeNull();
      expect(data?.status).toBe(next);
    }
  });
});

describe('order status state machine — takeout flow (no served)', () => {
  test('walks the full path pending_approval -> new -> preparing -> ready', async () => {
    const orderId = await seedOrder({ status: 'pending_approval', order_type: 'takeout' });

    for (const next of ['new', 'preparing', 'ready']) {
      const { error, data } = await trySetStatus(orderId, next);
      expect(error).toBeNull();
      expect(data?.status).toBe(next);
    }
  });

  test('rejects ready -> served on a takeout order', async () => {
    const orderId = await seedOrder({ status: 'ready', order_type: 'takeout' });

    const { error } = await trySetStatus(orderId, 'served');
    expect(error).not.toBeNull();
    expect(error?.code).toBe(PG_CHECK_VIOLATION);
    expect(error?.message).toMatch(/order_type=takeout/);
  });
});

describe('order status state machine — delivery flow', () => {
  test('walks the full path through out_for_delivery -> delivered', async () => {
    const orderId = await seedOrder({ status: 'pending_approval', order_type: 'delivery' });

    for (const next of ['new', 'preparing', 'ready', 'out_for_delivery', 'delivered']) {
      const { error, data } = await trySetStatus(orderId, next);
      expect(error).toBeNull();
      expect(data?.status).toBe(next);
    }
  });

  test('rejects ready -> served on a delivery order', async () => {
    const orderId = await seedOrder({ status: 'ready', order_type: 'delivery' });

    const { error } = await trySetStatus(orderId, 'served');
    expect(error).not.toBeNull();
    expect(error?.code).toBe(PG_CHECK_VIOLATION);
    expect(error?.message).toMatch(/order_type=delivery/);
  });

  test('rejects out_for_delivery -> ready (regression)', async () => {
    const orderId = await seedOrder({ status: 'out_for_delivery', order_type: 'delivery' });

    const { error } = await trySetStatus(orderId, 'ready');
    expect(error).not.toBeNull();
    expect(error?.code).toBe(PG_CHECK_VIOLATION);
  });
});
