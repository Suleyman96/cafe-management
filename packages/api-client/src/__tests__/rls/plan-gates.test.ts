/**
 * RLS plan-gate enforcement matrix.
 *
 * Asserts that the RESTRICTIVE `plan_*` policies introduced in
 * migration `20260429000002` actually reject INSERTs from tenants on
 * plans below the required tier. Complements
 * [`plan-limits.test.ts`](./plan-limits.test.ts) — that test checks
 * the SQL `plan_limits(plan)` function returns the right values per
 * plan (the *matrix mirror*); this test checks the RLS policies
 * *enforce* those values at insert time (the *enforcement wiring*).
 *
 * Prerequisites: same as `rls-policies.test.ts` — local Supabase + a
 * seeded admin user (`admin@test.com` / `test1234`). Run with
 * `pnpm test:rls`.
 *
 * Coverage:
 *   - 4 plans × 3 gated tables (stock_items, tasks, waste_logs) =
 *     12 cases. Each table's policy follows the identical
 *     `plan_<name>_insert RESTRICTIVE ... USING plan_allows_feature(<name>)`
 *     pattern, so a representative sample proves the wiring for the
 *     pattern. `stock_movements` and `staff_schedules` use the same
 *     policy shape but require FK setup (parent stock_item / staff
 *     row) — adding them is mechanical and a reasonable follow-up.
 *   - Table-cap RLS (numeric, not boolean) is exercised separately
 *     via the `enforce_table_cap_trigger` error-mapping test in
 *     `packages/api-client/src/__tests__/errors.test.ts` (`P0001
 *     plan_required` → AuthorizationError).
 *
 * Teardown: every successful insert is deleted by id via service
 * role so the test is idempotent. The original tenant plan is
 * restored in `afterAll` even if a test fails mid-run.
 */

import type { Database } from '@gustri/database/types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = 'test1234';

type Plan = 'free' | 'standard' | 'pro' | 'business';
const PLANS: Plan[] = ['free', 'standard', 'pro', 'business'];

/**
 * Each gated resource: which plans should be ALLOWED to insert, and a
 * factory for a fresh row payload (unique each call so a previous
 * test's row never collides on a unique index).
 */
const FEATURES: Array<{
  table: 'stock_items' | 'tasks' | 'waste_logs';
  feature: string;
  requires: Plan[];
  row: () => Record<string, unknown>;
}> = [
  {
    table: 'stock_items',
    feature: 'inventory',
    requires: ['pro', 'business'],
    row: () => ({ name: `rls-test-${crypto.randomUUID()}` }),
  },
  {
    table: 'tasks',
    feature: 'tasks',
    requires: ['pro', 'business'],
    row: () => ({ title: `rls-test-${crypto.randomUUID()}` }),
  },
  {
    table: 'waste_logs',
    feature: 'waste',
    requires: ['pro', 'business'],
    row: () => ({
      item_name: `rls-test-${crypto.randomUUID()}`,
      quantity: 1,
      reason: 'expired',
    }),
  },
];

let authedClient: SupabaseClient<Database>;
let serviceClient: SupabaseClient<Database>;
let tenantId: string;
let originalPlan: Plan;

async function setPlan(plan: Plan): Promise<void> {
  const { error } = await serviceClient.from('tenants').update({ plan }).eq('id', tenantId);
  if (error) throw new Error(`setPlan(${plan}) failed: ${error.message}`);
}

beforeAll(async () => {
  serviceClient = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY);
  authedClient = createClient<Database>(SUPABASE_URL, ANON_KEY);

  const { error: signInErr } = await authedClient.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (signInErr) {
    throw new Error(
      `Sign-in as ${ADMIN_EMAIL} failed: ${signInErr.message}. ` +
        'Did `./scripts/create-admin-user.sh` run?',
    );
  }

  // Resolve tenant_id from the staff row tied to this auth user.
  const { data: userRes } = await authedClient.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) throw new Error('No auth user after signInWithPassword');

  const { data: staff, error: staffErr } = await serviceClient
    .from('staff')
    .select('tenant_id')
    .eq('auth_user_id', userId)
    .single();
  if (staffErr || !staff) {
    throw new Error(`Failed to resolve staff for ${ADMIN_EMAIL}: ${staffErr?.message}`);
  }
  tenantId = staff.tenant_id;

  const { data: tenant, error: tenantErr } = await serviceClient
    .from('tenants')
    .select('plan')
    .eq('id', tenantId)
    .single();
  if (tenantErr || !tenant) {
    throw new Error(`Failed to read tenant plan: ${tenantErr?.message}`);
  }
  originalPlan = tenant.plan as Plan;
});

afterAll(async () => {
  // Restore original plan even if a test failed mid-run. Without this
  // the seed tenant could be left in a different state across runs.
  if (originalPlan && tenantId) {
    await serviceClient.from('tenants').update({ plan: originalPlan }).eq('id', tenantId);
  }
  await authedClient?.auth.signOut();
});

describe('RLS plan-gate enforcement matrix', () => {
  for (const plan of PLANS) {
    describe(`plan = ${plan}`, () => {
      beforeAll(() => setPlan(plan));

      for (const feature of FEATURES) {
        const allowed = feature.requires.includes(plan);
        const verdict = allowed ? 'allowed' : 'denied';

        test(`${feature.table} insert ${verdict} (plan_allows_feature('${feature.feature}') ${allowed})`, async () => {
          const row = feature.row();
          // Cast required because Database row types narrow union of table
          // names — the dynamic indexing in this loop loses type info, but
          // the test asserts on data/error shape, not row typing.
          const { data, error } = await (authedClient.from(feature.table) as any)
            .insert(row)
            .select('id')
            .maybeSingle();

          if (allowed) {
            expect(error, `${feature.table} insert should succeed on ${plan}`).toBeNull();
            expect(data?.id).toEqual(expect.any(String));
            // Cleanup: service role bypasses RLS so the delete always succeeds.
            if (data?.id) {
              await serviceClient.from(feature.table).delete().eq('id', data.id);
            }
          } else {
            expect(error?.code, `${feature.table} insert should be RLS-rejected on ${plan}`).toBe(
              '42501',
            );
            expect(data).toBeNull();
          }
        });
      }
    });
  }
});
