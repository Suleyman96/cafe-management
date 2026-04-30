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

import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, test } from 'vitest';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// Anonymous client — no auth
const anonClient = createClient(SUPABASE_URL, ANON_KEY);

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
