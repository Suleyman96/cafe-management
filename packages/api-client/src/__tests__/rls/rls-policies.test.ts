/**
 * RLS Policy Integration Tests
 *
 * These tests verify that Supabase Row-Level Security policies
 * correctly isolate data between tenants and restrict anonymous access.
 *
 * Prerequisites:
 *   - Local Supabase running (supabase start)
 *   - Database seeded (pnpm db:reset)
 *   - Admin user created (scripts/create-admin-user.sh)
 *
 * Run: pnpm test:rls
 */

import type { Database } from '@gustri/database/types';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Anonymous client — no auth. Typed with `<Database>` so PostgREST can
// infer column types on `.insert(...)`, `.update(...)`, etc; without it
// every column narrows to `never` and tests that probe specific fields
// fail to compile (the bug fixed alongside this file's RLS sweep).
const anonClient = createClient<Database>(SUPABASE_URL, ANON_KEY);
// Service-role client — bypasses RLS, used only to seed fixtures.
const svc = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY);

describe('RLS Policies — Anonymous Access', () => {
  test('can read menu items (intentionally public)', async () => {
    const { data, error } = await anonClient.from('menu_items').select('id, name').limit(1);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  test('can read categories (intentionally public)', async () => {
    const { data, error } = await anonClient.from('categories').select('id, name').limit(1);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  test('can read tables (intentionally public)', async () => {
    const { data, error } = await anonClient.from('tables').select('id, table_number').limit(1);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  test('cannot read staff table', async () => {
    const { data } = await anonClient.from('staff').select('*');
    expect(data).toHaveLength(0);
  });

  test('cannot read orders directly', async () => {
    const { data } = await anonClient.from('orders').select('*');
    expect(data).toHaveLength(0);
  });

  // Same enumeration-leak class as `cannot read orders directly`. The
  // previous `anon_read_order_items_scoped USING (EXISTS … table_id IS
  // NOT NULL)` policy was a per-row predicate, not a query-shape gate
  // — bare SELECT returned every item attached to a dine-in order
  // across every tenant. Migration 20260517000003 drops it.
  test('cannot read order_items directly', async () => {
    const { data } = await anonClient.from('order_items').select('*');
    expect(data).toHaveLength(0);
  });

  // Same class. Previous `anon_read_waiter_calls_scoped USING (table_id
  // IS NOT NULL)` leaked every dine-in waiter call cross-tenant.
  // Migration 20260517000003 drops it.
  test('cannot read waiter_calls directly', async () => {
    const { data } = await anonClient.from('waiter_calls').select('*');
    expect(data).toHaveLength(0);
  });

  test('cannot read order_payments', async () => {
    const { data } = await anonClient.from('order_payments').select('*');
    expect(data).toHaveLength(0);
  });

  test('cannot read expenses', async () => {
    const { data } = await anonClient.from('expenses').select('*');
    expect(data).toHaveLength(0);
  });

  test('cannot read waste_logs', async () => {
    const { data } = await anonClient.from('waste_logs').select('*');
    expect(data).toHaveLength(0);
  });

  test('cannot read tasks', async () => {
    const { data } = await anonClient.from('tasks').select('*');
    expect(data).toHaveLength(0);
  });

  test('cannot read staff_schedules', async () => {
    const { data } = await anonClient.from('staff_schedules').select('*');
    expect(data).toHaveLength(0);
  });
});

// Migration 20260727000001 — the dine-in order RPC must treat the table's
// qr_code as the capability. table_id alone is enumerable via the public anon
// key (tables are readable), so an existence-only check let any anonymous user
// scrape every tenant's live orders. These tests lock the fix in.
describe('RLS — get_active_order_for_table QR-token capability', () => {
  const TENANT_1 = '00000000-0000-0000-0000-000000000001';
  const TABLE_ID = '20000000-0000-0000-0000-000000000001'; // seed table (tenant 1)
  let qrToken = '';
  let createdOrderId: string | null = null;

  beforeAll(async () => {
    // The table's secret QR code (only readable via service role / a real scan).
    const { data: tbl, error: tblErr } = await svc
      .from('tables')
      .select('qr_code')
      .eq('id', TABLE_ID)
      .single();
    if (tblErr || !tbl?.qr_code) throw new Error(`seed table qr_code missing: ${tblErr?.message}`);
    qrToken = tbl.qr_code;

    // Seed an active dine-in order on that table.
    const { data: order, error } = await svc
      .from('orders')
      .insert({
        tenant_id: TENANT_1,
        table_id: TABLE_ID,
        status: 'new',
        order_type: 'dine_in',
        source: 'customer',
        subtotal: 10,
        tax: 1,
        total: 11,
      })
      .select('id')
      .single();
    if (error || !order) throw new Error(`failed to seed order: ${error?.message}`);
    createdOrderId = order.id;
  });

  afterAll(async () => {
    if (createdOrderId) await svc.from('orders').delete().eq('id', createdOrderId);
  });

  test('anon WITH the correct qr_token reads the active order', async () => {
    const { data, error } = await (anonClient.rpc as any)('get_active_order_for_table', {
      p_table_id: TABLE_ID,
      p_qr_token: qrToken,
    });
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect((data as { id: string }).id).toBe(createdOrderId);
  });

  test('anon WITHOUT a token cannot read the order (table_id is not a capability)', async () => {
    const { data } = await (anonClient.rpc as any)('get_active_order_for_table', {
      p_table_id: TABLE_ID,
      p_qr_token: null,
    });
    expect(data).toBeNull();
  });

  test('anon with a WRONG token cannot read the order', async () => {
    const { data } = await (anonClient.rpc as any)('get_active_order_for_table', {
      p_table_id: TABLE_ID,
      p_qr_token: 'not-the-real-token',
    });
    expect(data).toBeNull();
  });

  // The two branches below are the actual QR-rotation/revocation security
  // control (`qr_code_revoked_at IS NULL` and the expiry check). Without these,
  // a refactor dropping either predicate would let a rotated/expired sticker
  // keep reading live orders with the tests still green. Each mutates the seed
  // table's column and restores it in `finally` so a failure can't leak state
  // into the other suites.
  test('anon with the correct-but-REVOKED token cannot read the order', async () => {
    await svc
      .from('tables')
      .update({ qr_code_revoked_at: new Date().toISOString() })
      .eq('id', TABLE_ID);
    try {
      const { data } = await (anonClient.rpc as any)('get_active_order_for_table', {
        p_table_id: TABLE_ID,
        p_qr_token: qrToken,
      });
      expect(data).toBeNull();
    } finally {
      await svc.from('tables').update({ qr_code_revoked_at: null }).eq('id', TABLE_ID);
    }
  });

  test('anon with the correct-but-EXPIRED token cannot read the order', async () => {
    await svc
      .from('tables')
      .update({ qr_code_expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', TABLE_ID);
    try {
      const { data } = await (anonClient.rpc as any)('get_active_order_for_table', {
        p_table_id: TABLE_ID,
        p_qr_token: qrToken,
      });
      expect(data).toBeNull();
    } finally {
      await svc.from('tables').update({ qr_code_expires_at: null }).eq('id', TABLE_ID);
    }
  });

  test('the dead get_waiter_calls_for_table RPC is no longer executable by anon', async () => {
    const { error } = await (anonClient.rpc as any)('get_waiter_calls_for_table', {
      p_table_id: TABLE_ID,
      p_status: 'pending',
    });
    expect(error).not.toBeNull(); // anon EXECUTE revoked
  });
});

// Migration 20260728000001 — self-serve signup provisions a tenant via the
// auth.users trigger, and MUST force plan='free' regardless of a client-supplied
// plan (the old `raw_user_meta_data->>'plan'` read was a self-grant vector).
describe('Self-serve signup provisioning (migration 20260728000001)', () => {
  const uniq = `${Date.now()}`;
  const email = `provtest-${uniq}@example.com`;
  const cafeName = `Provision Test Cafe ${uniq}`;
  let userId: string | null = null;
  let tenantId: string | null = null;

  afterAll(async () => {
    if (tenantId) await svc.from('tenants').delete().eq('id', tenantId); // cascades staff/settings/categories
    if (userId) await svc.auth.admin.deleteUser(userId);
  });

  test('provisions a FREE tenant + owner + defaults, ignoring a client-claimed paid plan', async () => {
    const { data, error } = await svc.auth.admin.createUser({
      email,
      password: 'test1234!',
      email_confirm: true,
      // Malicious: try to self-grant 'business' via signup metadata.
      user_metadata: {
        signup: 'true',
        restaurant_name: cafeName,
        plan: 'business',
        full_name: 'Eve',
      },
    });
    expect(error).toBeNull();
    userId = data.user?.id ?? null;
    expect(userId).toBeTruthy();

    const { data: tenant } = await svc
      .from('tenants')
      .select('id, plan')
      .eq('name', cafeName)
      .single();
    tenantId = tenant?.id ?? null;
    expect(tenant?.plan).toBe('free'); // NOT 'business' — self-grant blocked

    const { data: staff } = await svc
      .from('staff')
      .select('role')
      .eq('auth_user_id', userId!)
      .single();
    expect(staff?.role).toBe('owner');

    const { count: taskCats } = await svc
      .from('task_categories')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId!);
    expect(taskCats).toBe(5);
  });
});

describe('RLS Policies — Authenticated Access', () => {
  let staffClient: ReturnType<typeof createClient>;

  beforeAll(async () => {
    const { data, error } = await createClient(SUPABASE_URL, ANON_KEY).auth.signInWithPassword({
      email: 'admin@test.com',
      password: 'test1234',
    });

    if (error || !data.session) {
      throw new Error(`Failed to sign in: ${error?.message || 'no session'}`);
    }

    staffClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      },
    });
  });

  test('can read own tenant tables', async () => {
    const { data, error } = await staffClient.from('tables').select('*');
    expect(error).toBeNull();
    // Seed data has 8 tables
    expect(data!.length).toBeGreaterThanOrEqual(8);
  });

  test('can read own tenant staff', async () => {
    const { data, error } = await staffClient.from('staff').select('*');
    expect(error).toBeNull();
    // Seed data has 4 staff members
    expect(data!.length).toBeGreaterThanOrEqual(4);
  });

  // M15: post-restriction, admin/owner can still see colleagues in their tenant —
  // including waiter/kitchen rows. The pre-M15 policy let any active staff see
  // all rows regardless of role. The check that *waiters* now see only their
  // own row lives in tests/rls/staff-visibility.waiter.test.ts (skipped here
  // because the default seed does not provision a waiter password — once the
  // seed adds `waiter@test.com / test1234`, that test moves into this file).
  test('M15: admin sees colleagues across roles in their tenant', async () => {
    const { data, error } = await staffClient.from('staff').select('id, role, tenant_id, email');
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const roles = new Set((data ?? []).map((row: { role: string }) => row.role));
    // Admin should see at least one non-admin row — proves the policy isn't
    // accidentally restricted to "self only" for the admin.
    expect(roles.size).toBeGreaterThanOrEqual(2);
    // Every visible row must be in the admin's tenant.
    const tenantIds = new Set((data ?? []).map((row: { tenant_id: string }) => row.tenant_id));
    expect(tenantIds.size).toBe(1);
  });

  test('can read own tenant menu items', async () => {
    const { data, error } = await staffClient.from('menu_items').select('*');
    expect(error).toBeNull();
    // Seed data has 16 menu items
    expect(data!.length).toBeGreaterThanOrEqual(16);
  });

  test('cannot insert into a different tenant', async () => {
    const fakeTenantId = '99999999-9999-9999-9999-999999999999';
    // Intentionally using a cross-tenant insert to test RLS rejection.
    // The insert data is deliberately minimal — RLS should reject before validation.
    const { error } = await (staffClient.from('tasks') as any).insert({
      title: 'Cross-tenant test task',
      tenant_id: fakeTenantId,
    });
    // Should be rejected by RLS WITH CHECK
    expect(error).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Cross-tenant WRITE isolation (Phase 2a canaries — see plans/12-NEXT…)
//
// These tests target the systemic OR-bypass class of bugs that PR #69 fixed
// for `staff` only. The pattern: baseline policies named "Admins can …" or
// "Staff can …" carry a role check but no `tenant_id` predicate. Postgres
// OR-combines permissive policies, so a same-role caller bypasses the
// tenant fence regardless of `tenant_isolation`.
//
// Each probe attempts a write as admin@tenant1 targeting tenant 2's real
// UUID. Pre-existing tests use a non-existent tenant_id which fails on FK
// before RLS ever evaluates — that's why the bug went undetected.
//
// These tests are EXPECTED to fail on stock `main`; the next PR (M18 sweep)
// turns them green by adding the tenant predicate to every offending policy.
// ──────────────────────────────────────────────────────────────────────────

const TENANT_2 = '00000000-0000-0000-0000-000000000002';

describe('RLS Policies — Cross-tenant write isolation', () => {
  let tenant1Client: ReturnType<typeof createClient<Database>>;
  let serviceClient: ReturnType<typeof createClient<Database>>;
  let tenant2Fixtures: {
    categoryId: string;
    menuItemId: string;
    taskCategoryId: string;
    taskId: string;
    tableId: string;
    orderId: string;
    expenseCategoryId: string;
    expenseId: string;
    stockItemId: string;
  };

  beforeAll(async () => {
    // Tenant 1 admin client — JWT-bound, RLS-policy-evaluated.
    const { data, error } = await createClient<Database>(
      SUPABASE_URL,
      ANON_KEY,
    ).auth.signInWithPassword({
      email: 'admin@test.com',
      password: 'test1234',
    });
    if (error || !data.session) {
      throw new Error(`Tenant 1 admin sign-in failed: ${error?.message ?? 'no session'}`);
    }
    tenant1Client = createClient<Database>(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    });

    // Service-role client bypasses RLS — used only to seed tenant 2 fixtures
    // for UPDATE/DELETE probes. Probes themselves use tenant1Client.
    serviceClient = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Seed minimum tenant 2 fixtures so UPDATE/DELETE probes have rows to
    // target. INSERT probes don't need fixtures. Each insert is best-effort
    // and ON CONFLICT DO NOTHING-equivalent via consistent UUIDs.
    //
    // `table` is typed as `keyof Database['public']['Tables']` so `from()`
    // accepts it. The row insert itself is cast to `never` because each
    // table has a different Insert type and the helper is deliberately
    // dynamic — every caller knows which row shape its target table needs.
    type SeedTable = keyof Database['public']['Tables'];
    const seed = async <T extends { id: string }>(
      table: SeedTable,
      row: Record<string, unknown>,
    ): Promise<T> => {
      const result = await serviceClient
        .from(table)
        .insert(row as never)
        .select('id')
        .single();
      if (result.error || !result.data) {
        throw new Error(
          `Failed to seed tenant 2 ${table}: ${result.error?.message ?? 'no data returned'}`,
        );
      }
      // PostgREST's typed builder can't statically resolve `select('id')`
      // against a union of all tables (it'd need to prove `id` exists on
      // every table — which it does in our schema, but the typings don't
      // know that), so the inferred return is a SelectQueryError union.
      // Cast through `unknown` since the runtime check above (`!result.data`)
      // already rules out the error case before we reach this line.
      return result.data as unknown as T;
    };

    const cat = await seed<{ id: string }>('categories', {
      tenant_id: TENANT_2,
      name: 'T2 Probe Cat',
    });
    const taskCat = await seed<{ id: string }>('task_categories', {
      tenant_id: TENANT_2,
      name: 'T2 Probe TaskCat',
    });
    const menu = await seed<{ id: string }>('menu_items', {
      tenant_id: TENANT_2,
      category_id: cat.id,
      name: 'T2 Probe Item',
      price: 1,
    });
    const task = await seed<{ id: string }>('tasks', {
      tenant_id: TENANT_2,
      title: 'T2 Probe Task',
    });
    const expCat = await seed<{ id: string }>('expense_categories', {
      tenant_id: TENANT_2,
      name: 'T2 Probe ExpCat',
    });
    const exp = await seed<{ id: string }>('expenses', {
      tenant_id: TENANT_2,
      category_id: expCat.id,
      amount: 1,
      expense_date: '2026-01-01',
      description: 'T2 probe expense',
      payment_method: 'cash',
    });
    const stock = await seed<{ id: string }>('stock_items', {
      tenant_id: TENANT_2,
      name: 'T2 Probe Stock',
      unit: 'pcs',
      quantity: 1,
    });
    // T2-ONLY table from supabase/seed.sql
    const t2TableResult = await serviceClient
      .from('tables')
      .select('id')
      .eq('tenant_id', TENANT_2)
      .eq('table_number', 'T2-ONLY')
      .single();
    if (t2TableResult.error || !t2TableResult.data) {
      throw new Error(`T2-ONLY table missing from seed: ${t2TableResult.error?.message}`);
    }
    const t2Table = t2TableResult.data as { id: string };
    // order_number: NOT NULL, varchar(15), no default. The auto-fill trigger
    // reads `current_tenant_id()` which the service-role client doesn't set,
    // so we provide one explicitly. Limited to 15 chars.
    const order = await seed<{ id: string }>('orders', {
      tenant_id: TENANT_2,
      table_id: t2Table.id,
      order_number: `T2P${Date.now().toString().slice(-12)}`,
      status: 'new',
      order_type: 'dine_in',
      source: 'waiter',
    });

    tenant2Fixtures = {
      categoryId: cat.id,
      menuItemId: menu.id,
      taskCategoryId: taskCat.id,
      taskId: task.id,
      tableId: t2Table.id,
      orderId: order.id,
      expenseCategoryId: expCat.id,
      expenseId: exp.id,
      stockItemId: stock.id,
    };
  });

  // INSERT probes — for every tenant-scoped table, attempt INSERT with
  // `tenant_id = TENANT_2` as admin@tenant1. Each must be REJECTED.
  //
  // Why: PG's OR-combined permissive policies mean a "Admins can insert X"
  // policy carrying only a role check passes for any admin in any tenant,
  // bypassing the `tenant_isolation` policy's tenant fence. The probe asserts
  // the WITH CHECK rejects cross-tenant inserts — i.e. each policy must
  // self-fence on tenant_id.

  type InsertProbe = {
    table: keyof Database['public']['Tables'];
    row: Record<string, unknown>;
  };
  const insertProbes: InsertProbe[] = [
    { table: 'cafe_settings', row: { tenant_id: TENANT_2, restaurant_name: 'Cross-tenant probe' } },
    { table: 'categories', row: { tenant_id: TENANT_2, name: 'Cross-tenant probe' } },
    {
      table: 'menu_items',
      row: { tenant_id: TENANT_2, name: 'Cross-tenant probe', price: 1 },
    },
    { table: 'tables', row: { tenant_id: TENANT_2, table_number: 'PROBE', capacity: 1 } },
    { table: 'task_categories', row: { tenant_id: TENANT_2, name: 'Cross-tenant probe' } },
    { table: 'tasks', row: { tenant_id: TENANT_2, title: 'Cross-tenant probe' } },
    { table: 'expense_categories', row: { tenant_id: TENANT_2, name: 'Cross-tenant probe' } },
    {
      table: 'expenses',
      row: { tenant_id: TENANT_2, amount: 1, expense_date: '2026-01-01' },
    },
    {
      table: 'stock_items',
      row: { tenant_id: TENANT_2, name: 'Cross-tenant probe', unit: 'pcs', quantity: 1 },
    },
    {
      table: 'waste_logs',
      row: {
        tenant_id: TENANT_2,
        item_name: 'Cross-tenant probe',
        quantity: 1,
        reason: 'expired',
      },
    },
    {
      table: 'staff_schedules',
      row: {
        tenant_id: TENANT_2,
        staff_id: '10000000-0000-0000-0000-000000000005',
        scheduled_date: '2026-01-01',
        planned_start: '09:00',
        planned_end: '17:00',
      },
    },
  ];

  for (const probe of insertProbes) {
    test(`admin@tenant1 cannot INSERT into ${probe.table} with tenant_id = tenant2`, async () => {
      const { data, error } = await tenant1Client
        .from(probe.table)
        .insert(probe.row as never)
        .select();
      const insertedRows = data ?? [];
      // RLS WITH CHECK should reject — either by error or by zero rows
      // returned (Postgres returns 0 rows when WITH CHECK silently filters).
      expect(
        error !== null || insertedRows.length === 0,
        `LEAK: admin@tenant1 wrote ${insertedRows.length} row(s) into ${probe.table} with tenant_id=tenant2`,
      ).toBe(true);
    });
  }

  // UPDATE probes — attempt to mutate a tenant 2 row from tenant 1's session.
  // Each must affect 0 rows (RLS USING filters them out before UPDATE sees them).

  test('admin@tenant1 cannot UPDATE tenant2 cafe_settings', async () => {
    const { data, error } = await tenant1Client
      .from('cafe_settings')
      .update({ restaurant_name: 'HACKED FROM TENANT1' })
      .eq('tenant_id', TENANT_2)
      .select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  test('admin@tenant1 cannot UPDATE tenant2 categories', async () => {
    const { data, error } = await tenant1Client
      .from('categories')
      .update({ name: 'HACKED' })
      .eq('id', tenant2Fixtures.categoryId)
      .select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  test('admin@tenant1 cannot UPDATE tenant2 menu_items', async () => {
    const { data, error } = await tenant1Client
      .from('menu_items')
      .update({ price: 999 })
      .eq('id', tenant2Fixtures.menuItemId)
      .select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  test('admin@tenant1 cannot UPDATE tenant2 tasks', async () => {
    const { data, error } = await tenant1Client
      .from('tasks')
      .update({ title: 'HACKED' })
      .eq('id', tenant2Fixtures.taskId)
      .select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  test('admin@tenant1 cannot UPDATE tenant2 expenses', async () => {
    const { data, error } = await tenant1Client
      .from('expenses')
      .update({ amount: 999 })
      .eq('id', tenant2Fixtures.expenseId)
      .select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  test('admin@tenant1 cannot UPDATE tenant2 tables', async () => {
    const { data, error } = await tenant1Client
      .from('tables')
      .update({ status: 'closed' })
      .eq('id', tenant2Fixtures.tableId)
      .select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  test('admin@tenant1 cannot UPDATE tenant2 orders', async () => {
    const { data, error } = await tenant1Client
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', tenant2Fixtures.orderId)
      .select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  test('admin@tenant1 cannot UPDATE tenant2 stock_items', async () => {
    const { data, error } = await tenant1Client
      .from('stock_items')
      .update({ quantity: 0 })
      .eq('id', tenant2Fixtures.stockItemId)
      .select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  // DELETE probes — same pattern. Postgres returns the deleted rows in the
  // .select() result; if RLS USING filtered them out, that array is empty.

  test('admin@tenant1 cannot DELETE tenant2 categories', async () => {
    const { data, error } = await tenant1Client
      .from('categories')
      .delete()
      .eq('id', tenant2Fixtures.categoryId)
      .select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  test('admin@tenant1 cannot DELETE tenant2 menu_items', async () => {
    const { data, error } = await tenant1Client
      .from('menu_items')
      .delete()
      .eq('id', tenant2Fixtures.menuItemId)
      .select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  test('admin@tenant1 cannot DELETE tenant2 tasks', async () => {
    const { data, error } = await tenant1Client
      .from('tasks')
      .delete()
      .eq('id', tenant2Fixtures.taskId)
      .select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  test('admin@tenant1 cannot DELETE tenant2 expenses', async () => {
    const { data, error } = await tenant1Client
      .from('expenses')
      .delete()
      .eq('id', tenant2Fixtures.expenseId)
      .select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  test('admin@tenant1 cannot DELETE tenant2 stock_items', async () => {
    const { data, error } = await tenant1Client
      .from('stock_items')
      .delete()
      .eq('id', tenant2Fixtures.stockItemId)
      .select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Tenant soft-close (migration 20260729000001). Deactivating a tenant must
// collapse current_tenant_id() to NULL so every tenant-scoped RLS policy
// denies — the single chokepoint that closes both staff and customer access.
// ──────────────────────────────────────────────────────────────────────────
describe('RLS Policies — Tenant soft-close (deactivation gate)', () => {
  // Service-role client for fixture toggling (bypasses RLS). This file has no
  // file-scope service client, so create one from the in-scope SERVICE_ROLE_KEY.
  const svcClient = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY);
  let staffClient: ReturnType<typeof createClient>;
  let adminTenantId: string;

  beforeAll(async () => {
    const { data, error } = await createClient(SUPABASE_URL, ANON_KEY).auth.signInWithPassword({
      email: 'admin@test.com',
      password: 'test1234',
    });
    if (error || !data.session) {
      throw new Error(`Failed to sign in: ${error?.message || 'no session'}`);
    }
    staffClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    });

    const { data: staffRow, error: staffErr } = await svcClient
      .from('staff')
      .select('tenant_id')
      .eq('email', 'admin@test.com')
      .single();
    if (staffErr || !staffRow?.tenant_id) {
      throw new Error(`Could not resolve admin tenant_id: ${staffErr?.message}`);
    }
    adminTenantId = staffRow.tenant_id;
  });

  afterAll(async () => {
    // Always restore — the seed tenant is shared with every other suite.
    await svcClient
      .from('tenants')
      .update({
        is_active: true,
        deactivated_at: null,
        deactivated_by: null,
        deactivation_reason: null,
      })
      .eq('id', adminTenantId);
  });

  test('deactivating the tenant collapses current_tenant_id() → authed reads return 0', async () => {
    // Probe `cafe_settings`: tenant-scoped ONLY (no public policy since
    // migration 20260430000002, and no per-user self-row policy like `staff`
    // has), exactly one seed row per tenant — so it cleanly reflects whether
    // current_tenant_id() resolved.
    const before = await staffClient.from('cafe_settings').select('*');
    expect(before.error).toBeNull();
    expect(before.data!.length).toBeGreaterThanOrEqual(1);

    // Soft-close the tenant (what POST /api/v1/admin/tenant/deactivate does).
    const { error: deErr } = await svcClient
      .from('tenants')
      .update({ is_active: false })
      .eq('id', adminTenantId);
    expect(deErr).toBeNull();

    // Same valid session, but current_tenant_id() now resolves to NULL, so the
    // `tenant_id = current_tenant_id()` policy denies every row.
    const after = await staffClient.from('cafe_settings').select('*');
    expect(after.error).toBeNull();
    expect(after.data).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Platform-created tenant: the operator route (POST /platform/tenants) creates
// the owner via admin.createUser with `signup` metadata and relies on
// handle_new_tenant_signup() to provision everything. This proves that
// integration end-to-end (the whole premise of not duplicating provisioning).
// ──────────────────────────────────────────────────────────────────────────
describe('Platform — operator-created tenant provisions via the signup trigger', () => {
  const svc = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY);
  const email = `platform-create-${Date.now()}@example.com`;
  let userId: string | null = null;
  let tenantId: string | null = null;

  afterAll(async () => {
    // Best-effort cleanup (CI resets the DB per run anyway).
    if (tenantId) await svc.from('tenants').delete().eq('id', tenantId);
    if (userId) await svc.auth.admin.deleteUser(userId).catch(() => {});
  });

  test('createUser with signup+restaurant_name provisions a named free tenant + owner + defaults', async () => {
    const { data, error } = await svc.auth.admin.createUser({
      email,
      password: 'test1234x',
      email_confirm: true,
      user_metadata: {
        signup: 'platform',
        restaurant_name: 'Platform Test Cafe',
        full_name: 'HQ Owner',
      },
    });
    expect(error).toBeNull();
    userId = data.user?.id ?? null;
    expect(userId).toBeTruthy();

    // Owner staff row was created by the trigger, in the same transaction.
    const { data: staff } = await svc
      .from('staff')
      .select('tenant_id, role')
      .eq('auth_user_id', userId as string)
      .single();
    expect(staff?.role).toBe('owner');
    tenantId = (staff?.tenant_id as string) ?? null;
    expect(tenantId).toBeTruthy();

    // Tenant is named from metadata and forced to the free plan.
    const { data: tenant } = await svc
      .from('tenants')
      .select('name, plan')
      .eq('id', tenantId as string)
      .single();
    expect(tenant?.name).toBe('Platform Test Cafe');
    expect(tenant?.plan).toBe('free');

    // Default categories seeded so first-run pickers aren't empty.
    const { count: taskCats } = await svc
      .from('task_categories')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId as string);
    const { count: expCats } = await svc
      .from('expense_categories')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId as string);
    expect(taskCats ?? 0).toBeGreaterThanOrEqual(5);
    expect(expCats ?? 0).toBeGreaterThanOrEqual(6);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Cafe-scoped login: the same staff "username" (email) can now exist at two
// different cafes (each gets a distinct internal auth account), and the
// login-resolution query (slug → tenant → staff by email) maps each to the
// right account. This is the core of feat/cafe-scoped-login.
// ──────────────────────────────────────────────────────────────────────────
describe('Cafe-scoped login — same username across cafes resolves per-cafe', () => {
  const svc = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY);
  const stamp = Date.now();
  const slugA = `login-cafe-a-${stamp}`;
  const slugB = `login-cafe-b-${stamp}`;
  const sharedUsername = `waiter1@x.com`; // same fake email at both cafes
  const ids: { tenantA?: string; tenantB?: string; userA?: string; userB?: string } = {};

  afterAll(async () => {
    if (ids.tenantA) await svc.from('tenants').delete().eq('id', ids.tenantA);
    if (ids.tenantB) await svc.from('tenants').delete().eq('id', ids.tenantB);
    if (ids.userA) await svc.auth.admin.deleteUser(ids.userA).catch(() => {});
    if (ids.userB) await svc.auth.admin.deleteUser(ids.userB).catch(() => {});
  });

  test('two cafes, identical username → two accounts, each resolvable by cafe', async () => {
    // Two cafes.
    const { data: a } = await svc
      .from('tenants')
      .insert({ name: 'Login Cafe A', slug: slugA, plan: 'free' })
      .select('id')
      .single();
    const { data: b } = await svc
      .from('tenants')
      .insert({ name: 'Login Cafe B', slug: slugB, plan: 'free' })
      .select('id')
      .single();
    ids.tenantA = a?.id;
    ids.tenantB = b?.id;
    expect(ids.tenantA).toBeTruthy();
    expect(ids.tenantB).toBeTruthy();

    // Each staff gets a distinct synthetic internal auth account (what the
    // staff-create route now does).
    const { data: ua } = await svc.auth.admin.createUser({
      email: `staff.a${stamp}@staff.gustri.com`,
      password: 'pw-aaaa-1',
      email_confirm: true,
    });
    const { data: ub } = await svc.auth.admin.createUser({
      email: `staff.b${stamp}@staff.gustri.com`,
      password: 'pw-bbbb-2',
      email_confirm: true,
    });
    ids.userA = ua.user?.id ?? undefined;
    ids.userB = ub.user?.id ?? undefined;

    // Same display username in BOTH cafes — both inserts must succeed.
    const insA = await svc.from('staff').insert({
      email: sharedUsername,
      full_name: 'Waiter A',
      role: 'waiter',
      is_active: true,
      auth_user_id: ids.userA as string,
      tenant_id: ids.tenantA as string,
    });
    const insB = await svc.from('staff').insert({
      email: sharedUsername,
      full_name: 'Waiter B',
      role: 'waiter',
      is_active: true,
      auth_user_id: ids.userB as string,
      tenant_id: ids.tenantB as string,
    });
    expect(insA.error).toBeNull();
    expect(insB.error).toBeNull();
    expect(ids.userA).not.toEqual(ids.userB);

    // The login resolution (slug → tenant → staff by username) must map each
    // cafe's login to its OWN account, never the other's.
    const resolve = async (tenantId: string) => {
      const { data } = await svc
        .from('staff')
        .select('auth_user_id')
        .eq('tenant_id', tenantId)
        .ilike('email', sharedUsername)
        .maybeSingle();
      return data?.auth_user_id;
    };
    expect(await resolve(ids.tenantA as string)).toBe(ids.userA);
    expect(await resolve(ids.tenantB as string)).toBe(ids.userB);
  });
});

// L1 — only an `owner` may grant the `owner` role. The POST /api/v1/staff
// route guards the service-role create path, but staff edits go through the
// AUTHENTICATED client under RLS ("Admins can insert/update staff in tenant"),
// which carries no restriction on the target row's role. The
// `enforce_owner_grant_requires_owner` trigger (migration 20261010000003)
// closes that path at the database. These probes sign in as a plain admin
// (admin@test.com, tenant 1) and must be REJECTED.
describe('RLS — only an owner can grant the owner role (L1)', () => {
  let adminClient: ReturnType<typeof createClient<Database>>;
  let adminStaffId: string;

  beforeAll(async () => {
    const { data, error } = await createClient(SUPABASE_URL, ANON_KEY).auth.signInWithPassword({
      email: 'admin@test.com',
      password: 'test1234',
    });
    if (error || !data.session) {
      throw new Error(`admin sign-in failed: ${error?.message ?? 'no session'}`);
    }
    adminClient = createClient<Database>(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    });

    const { data: me } = await svc
      .from('staff')
      .select('id, role')
      .eq('email', 'admin@test.com')
      .maybeSingle();
    if (!me || me.role !== 'admin') {
      throw new Error(`fixture admin@test.com is not role 'admin' (got ${me?.role ?? 'none'})`);
    }
    adminStaffId = me.id as string;
  });

  test('admin CANNOT promote an existing staff member to owner (role unchanged)', async () => {
    const { error } = await adminClient
      .from('staff')
      .update({ role: 'owner' })
      .eq('id', adminStaffId);

    // Rejected by the trigger (insufficient_privilege → 42501) carrying the
    // localizable sentinel.
    expect(error).not.toBeNull();
    expect(`${error?.code ?? ''} ${error?.message ?? ''}`).toContain('owner_role_requires_owner');

    // The role on disk must be untouched.
    const { data: after } = await svc
      .from('staff')
      .select('role')
      .eq('id', adminStaffId)
      .maybeSingle();
    expect(after?.role).toBe('admin');
  });

  test('admin CANNOT insert a new owner staff row', async () => {
    const { data: me } = await svc
      .from('staff')
      .select('tenant_id')
      .eq('id', adminStaffId)
      .maybeSingle();

    const probeEmail = `l1-probe-${Date.now()}@test.com`;
    const { error } = await adminClient.from('staff').insert({
      email: probeEmail,
      full_name: 'L1 Probe Owner',
      role: 'owner',
      tenant_id: me!.tenant_id as string,
    });

    expect(error).not.toBeNull();
    expect(`${error?.code ?? ''} ${error?.message ?? ''}`).toContain('owner_role_requires_owner');

    // Nothing should have been written; clean up defensively if it leaked.
    const { data: leaked } = await svc.from('staff').select('id').eq('email', probeEmail);
    if (leaked && leaked.length > 0) {
      await svc.from('staff').delete().eq('email', probeEmail);
    }
    expect(leaked ?? []).toHaveLength(0);
  });

  test('admin CAN still edit a staff row without touching role', async () => {
    // Setting role to its current value must not trip the guard (the trigger
    // only blocks a transition INTO owner by a non-owner).
    const { error } = await adminClient
      .from('staff')
      .update({ role: 'admin' })
      .eq('id', adminStaffId);
    expect(error).toBeNull();
  });
});
