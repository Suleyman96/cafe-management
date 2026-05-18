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

import type { Database } from '@gustri/database';
import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, test } from 'vitest';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// Anonymous client — no auth. Typed with `<Database>` so PostgREST can
// infer column types on `.insert(...)`, `.update(...)`, etc; without it
// every column narrows to `never` and tests that probe specific fields
// fail to compile (the bug fixed alongside this file's RLS sweep).
const anonClient = createClient<Database>(SUPABASE_URL, ANON_KEY);

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
// Local-dev service-role JWT (default fixture key shipped with `supabase
// start`). Safe to commit because it's only valid against `localhost:54321`.
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

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
