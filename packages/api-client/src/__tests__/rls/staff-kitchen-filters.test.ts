/**
 * Integration tests — staff_kitchen_filters table.
 *
 * Verifies the surfaces that the unit tests on `deriveKitchenView` cannot
 * cover: the wrapper's `replace()` semantics against a real DB, the RLS
 * policies, the cross-tenant trigger guard, the ON DELETE CASCADE on
 * categories, and the BEFORE INSERT snapshot trigger on order_items.
 *
 * Prerequisites:
 *   - Local Supabase running (supabase start)
 *   - Database seeded (pnpm db:reset)
 *   - admin@test.com / test1234 exists (created by db:reset)
 *
 * Run: pnpm test:rls
 */

import type { Database } from '@gustri/database';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { createSupabaseWrapper } from '../../wrapper';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Seeded fixtures (see supabase/seed.sql).
const TENANT_1 = '00000000-0000-0000-0000-000000000001';
const TENANT_2 = '00000000-0000-0000-0000-000000000002';
const ADMIN_STAFF_ID = '10000000-0000-0000-0000-000000000001'; // admin@test.com
const KITCHEN_STAFF_ID = '10000000-0000-0000-0000-000000000004'; // kitchen@cafe.com
const CATEGORY_HOT = '30000000-0000-0000-0000-000000000001'; // Hot Drinks
const CATEGORY_COLD = '30000000-0000-0000-0000-000000000002'; // Cold Drinks
const CATEGORY_RICE = '30000000-0000-0000-0000-000000000003'; // Rice & Noodles
const MENU_ITEM_HOT = '40000000-0000-0000-0000-000000000001'; // Matcha Latte (Hot Drinks)
const SEED_TABLE_ID = '20000000-0000-0000-0000-000000000008';

let svc: SupabaseClient<Database>;
let adminClient: SupabaseClient<Database>;

beforeAll(async () => {
  const auth = await createClient<Database>(SUPABASE_URL, ANON_KEY).auth.signInWithPassword({
    email: 'admin@test.com',
    password: 'test1234',
  });
  if (auth.error || !auth.data.session) {
    throw new Error(`admin sign-in failed: ${auth.error?.message ?? 'no session'}`);
  }
  adminClient = createClient<Database>(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${auth.data.session.access_token}` } },
  });
  svc = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY);
});

afterEach(async () => {
  // Reset all filter rows so tests are independent. Use service-role to
  // bypass RLS — leaves the production-shaped data untouched, only our
  // own per-test filter writes.
  await svc
    .from('staff_kitchen_filters')
    .delete()
    .in('staff_id', [ADMIN_STAFF_ID, KITCHEN_STAFF_ID]);
});

afterAll(async () => {
  // Defensive cleanup of any rows our tests might have left behind on
  // tenant-2-side fixtures (the trigger-rejection probes).
  await svc.from('staff_kitchen_filters').delete().eq('tenant_id', TENANT_2);
});

// ─── Wrapper end-to-end ────────────────────────────────────────────────

describe('staff_kitchen_filters wrapper — replace()', () => {
  test('inserts the supplied category ids and findByStaffId returns them', async () => {
    const db = createSupabaseWrapper(adminClient, { tenantId: TENANT_1 });
    await db.staffKitchenFilters.replace(ADMIN_STAFF_ID, [CATEGORY_HOT, CATEGORY_COLD]);

    const result = await db.staffKitchenFilters.findByStaffId(ADMIN_STAFF_ID);
    expect(result.sort()).toEqual([CATEGORY_HOT, CATEGORY_COLD].sort());
  });

  test('overwrites the prior set atomically (delete-then-insert)', async () => {
    const db = createSupabaseWrapper(adminClient, { tenantId: TENANT_1 });
    await db.staffKitchenFilters.replace(ADMIN_STAFF_ID, [CATEGORY_HOT, CATEGORY_COLD]);
    // Replace with a different set — the previous rows must be gone.
    await db.staffKitchenFilters.replace(ADMIN_STAFF_ID, [CATEGORY_RICE]);

    const result = await db.staffKitchenFilters.findByStaffId(ADMIN_STAFF_ID);
    expect(result).toEqual([CATEGORY_RICE]);
  });

  test('empty array clears the filter (the "show all" semantic)', async () => {
    const db = createSupabaseWrapper(adminClient, { tenantId: TENANT_1 });
    await db.staffKitchenFilters.replace(ADMIN_STAFF_ID, [CATEGORY_HOT]);
    await db.staffKitchenFilters.replace(ADMIN_STAFF_ID, []);

    const result = await db.staffKitchenFilters.findByStaffId(ADMIN_STAFF_ID);
    expect(result).toEqual([]);
  });

  test('dedupes duplicates in the input array (PK is (staff, category))', async () => {
    const db = createSupabaseWrapper(adminClient, { tenantId: TENANT_1 });
    await db.staffKitchenFilters.replace(ADMIN_STAFF_ID, [
      CATEGORY_HOT,
      CATEGORY_COLD,
      CATEGORY_HOT,
    ]);

    const result = await db.staffKitchenFilters.findByStaffId(ADMIN_STAFF_ID);
    expect(result.sort()).toEqual([CATEGORY_HOT, CATEGORY_COLD].sort());
  });

  test('findByStaffId returns rows in created_at order (insertion order)', async () => {
    const db = createSupabaseWrapper(adminClient, { tenantId: TENANT_1 });
    // Seed rows with deterministic created_at via service-role so we can
    // assert ordering without relying on insert microsecond timing.
    const now = Date.now();
    await svc.from('staff_kitchen_filters').insert([
      {
        staff_id: ADMIN_STAFF_ID,
        category_id: CATEGORY_RICE,
        tenant_id: TENANT_1,
        created_at: new Date(now).toISOString(),
      },
      {
        staff_id: ADMIN_STAFF_ID,
        category_id: CATEGORY_HOT,
        tenant_id: TENANT_1,
        created_at: new Date(now + 1000).toISOString(),
      },
      {
        staff_id: ADMIN_STAFF_ID,
        category_id: CATEGORY_COLD,
        tenant_id: TENANT_1,
        created_at: new Date(now + 2000).toISOString(),
      },
    ]);

    const result = await db.staffKitchenFilters.findByStaffId(ADMIN_STAFF_ID);
    expect(result).toEqual([CATEGORY_RICE, CATEGORY_HOT, CATEGORY_COLD]);
  });

  test('replace requires a tenant context', async () => {
    const db = createSupabaseWrapper(adminClient); // no tenantId
    await expect(db.staffKitchenFilters.replace(ADMIN_STAFF_ID, [CATEGORY_HOT])).rejects.toThrow(
      /tenant context/i,
    );
  });
});

// ─── RLS ───────────────────────────────────────────────────────────────

describe('staff_kitchen_filters RLS', () => {
  test("admin can read another colleague's filter rows in the same tenant", async () => {
    // Seed a filter for the kitchen staff via service-role.
    await svc.from('staff_kitchen_filters').insert({
      staff_id: KITCHEN_STAFF_ID,
      category_id: CATEGORY_HOT,
      tenant_id: TENANT_1,
    });

    const db = createSupabaseWrapper(adminClient, { tenantId: TENANT_1 });
    const result = await db.staffKitchenFilters.findByStaffId(KITCHEN_STAFF_ID);
    expect(result).toEqual([CATEGORY_HOT]);
  });

  test('admin can write a filter for a colleague (manager pre-configures a station)', async () => {
    const db = createSupabaseWrapper(adminClient, { tenantId: TENANT_1 });
    await db.staffKitchenFilters.replace(KITCHEN_STAFF_ID, [CATEGORY_HOT, CATEGORY_RICE]);

    const result = await db.staffKitchenFilters.findByStaffId(KITCHEN_STAFF_ID);
    expect(result.sort()).toEqual([CATEGORY_HOT, CATEGORY_RICE].sort());
  });

  test('insert with tenant_id != current tenant is rejected', async () => {
    // Admin@tenant1 attempting to write a row stamped with tenant 2.
    // RLS WITH CHECK on the row's `tenant_id = current_tenant_id()`
    // predicate must reject.
    const { error } = await adminClient.from('staff_kitchen_filters').insert({
      staff_id: ADMIN_STAFF_ID,
      category_id: CATEGORY_HOT,
      tenant_id: TENANT_2,
    });
    expect(error).not.toBeNull();
  });
});

// ─── Cross-tenant trigger guard ────────────────────────────────────────

describe('staff_kitchen_filters cross-tenant trigger', () => {
  test('rejects when category belongs to a different tenant than the row', async () => {
    // Seed a tenant-2 category via service-role so it exists.
    const t2CategoryId = '99000000-0000-0000-0000-000000099001';
    await svc
      .from('categories')
      .insert({ id: t2CategoryId, tenant_id: TENANT_2, name: 'T2 cat for trigger probe' });

    try {
      // Service-role bypasses RLS but NOT the BEFORE INSERT trigger.
      // The trigger compares row.tenant_id to staff.tenant_id and
      // category.tenant_id and raises on mismatch.
      const { error } = await svc.from('staff_kitchen_filters').insert({
        staff_id: ADMIN_STAFF_ID, // tenant 1
        category_id: t2CategoryId, // tenant 2
        tenant_id: TENANT_1,
      });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/tenant mismatch/i);
    } finally {
      await svc.from('categories').delete().eq('id', t2CategoryId);
    }
  });

  test('rejects when staff belongs to a different tenant than the row', async () => {
    // Seed a tenant-2 staff via service-role.
    const t2StaffId = '99000000-0000-0000-0000-000000099002';
    await svc.from('staff').insert({
      id: t2StaffId,
      tenant_id: TENANT_2,
      email: 'trigger-probe@t2.example',
      full_name: 'T2 Trigger Probe',
      role: 'kitchen',
      is_active: true,
    });

    try {
      const { error } = await svc.from('staff_kitchen_filters').insert({
        staff_id: t2StaffId, // tenant 2
        category_id: CATEGORY_HOT, // tenant 1
        tenant_id: TENANT_1,
      });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/tenant mismatch/i);
    } finally {
      await svc.from('staff').delete().eq('id', t2StaffId);
    }
  });
});

// ─── Cascade behavior ──────────────────────────────────────────────────

describe('staff_kitchen_filters cascade', () => {
  test('hard-deleting a category removes the filter rows that reference it', async () => {
    // Make a throwaway category so the test doesn't need to delete a
    // seeded one (which the rest of the suite depends on).
    const tempCategoryId = '99000000-0000-0000-0000-000000099003';
    await svc
      .from('categories')
      .insert({ id: tempCategoryId, tenant_id: TENANT_1, name: 'Cascade probe' });

    try {
      await svc.from('staff_kitchen_filters').insert({
        staff_id: ADMIN_STAFF_ID,
        category_id: tempCategoryId,
        tenant_id: TENANT_1,
      });

      // Sanity: row is there.
      const before = await svc
        .from('staff_kitchen_filters')
        .select('category_id')
        .eq('staff_id', ADMIN_STAFF_ID)
        .eq('category_id', tempCategoryId);
      expect(before.data ?? []).toHaveLength(1);

      await svc.from('categories').delete().eq('id', tempCategoryId);

      const after = await svc
        .from('staff_kitchen_filters')
        .select('category_id')
        .eq('staff_id', ADMIN_STAFF_ID)
        .eq('category_id', tempCategoryId);
      expect(after.data ?? []).toHaveLength(0);
    } finally {
      // Best-effort cleanup if the cascade didn't fire (test failed mid-way).
      await svc.from('categories').delete().eq('id', tempCategoryId);
    }
  });
});

// ─── Snapshot trigger on order_items.category_id ───────────────────────

describe('order_items.category_id snapshot trigger', () => {
  // Track inserted order ids for cleanup. The financial_audit_log FK on
  // orders means we have to peel that off before deleting the order.
  const createdOrderIds: string[] = [];

  afterAll(async () => {
    if (createdOrderIds.length === 0) return;
    await svc.from('financial_audit_log').delete().in('order_id', createdOrderIds);
    await svc.from('order_items').delete().in('order_id', createdOrderIds);
    await svc.from('orders').delete().in('id', createdOrderIds);
  });

  async function seedEmptyOrder(): Promise<string> {
    const orderNumber = `KFT${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)
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
      })
      .select('id')
      .single();
    if (error || !data) throw new Error(`seed order failed: ${error?.message}`);
    createdOrderIds.push(data.id);
    return data.id;
  }

  test('auto-populates category_id from menu_items when caller omits it', async () => {
    const orderId = await seedEmptyOrder();
    const { data: itemRow, error } = await svc
      .from('order_items')
      .insert({
        tenant_id: TENANT_1,
        order_id: orderId,
        menu_item_id: MENU_ITEM_HOT,
        item_name: 'Matcha Latte',
        item_price: 550,
        quantity: 1,
        status: 'pending',
        // category_id intentionally omitted — the trigger should fill it.
      })
      .select('category_id')
      .single();

    expect(error).toBeNull();
    expect(itemRow?.category_id).toBe(CATEGORY_HOT);
  });

  test('preserves a caller-supplied category_id (no overwrite)', async () => {
    const orderId = await seedEmptyOrder();
    // Force a non-default — pretend the caller deliberately stamped a
    // different category. The trigger must NOT overwrite a non-null value.
    const { data: itemRow, error } = await svc
      .from('order_items')
      .insert({
        tenant_id: TENANT_1,
        order_id: orderId,
        menu_item_id: MENU_ITEM_HOT, // would imply CATEGORY_HOT
        category_id: CATEGORY_COLD, // caller override
        item_name: 'Matcha Latte',
        item_price: 550,
        quantity: 1,
        status: 'pending',
      })
      .select('category_id')
      .single();

    expect(error).toBeNull();
    expect(itemRow?.category_id).toBe(CATEGORY_COLD);
  });
});
