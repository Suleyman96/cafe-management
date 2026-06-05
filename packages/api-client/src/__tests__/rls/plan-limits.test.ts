/**
 * plan_limits() ↔ PLAN_LIMITS sync test.
 *
 * Migration 20260515000002 introduced `plan_limits(plan text)` as the
 * single SQL source of truth for the plan matrix. This test asserts
 * that the SQL function returns the same caps + feature flags as
 * `PLAN_LIMITS` in `@gustri/core/constants.ts` for every plan tier.
 *
 * Why integration test, not unit test: the whole point of the helper
 * is to lock SQL and TS together. Mocking the SQL side would defeat
 * the purpose — we want the test to run against a real Postgres
 * instance with the migration applied.
 *
 * Prerequisites: same as rls-policies.test.ts. Run: pnpm test:rls.
 *
 * Note: the `as never` casts on the .rpc() calls drop once the
 * Database types are regenerated (`pnpm db:types:generate`) — the
 * generated types don't yet know about `plan_limits` because the
 * migration has not been applied to the type-generation source DB.
 */

import { PLAN_LIMITS, type PlanName } from '@gustri/core';
import type { Database } from '@gustri/database/types';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, test } from 'vitest';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const anonClient = createClient<Database>(SUPABASE_URL, ANON_KEY);

const PLANS: PlanName[] = ['free', 'standard', 'pro', 'business'];

/**
 * Map TS PLAN_LIMITS keys (camelCase) to SQL plan_limits_t fields
 * (snake_case). Adding a new field to the matrix requires updating
 * this map AND PLAN_LIMITS AND the SQL function — the test fails
 * loudly if any of the three drift.
 */
const FIELD_MAP: Array<{ ts: keyof (typeof PLAN_LIMITS)[PlanName]; sql: string }> = [
  { ts: 'maxTables', sql: 'max_tables' },
  { ts: 'maxOrdersPerMonth', sql: 'max_orders_per_month' },
  { ts: 'qrOrdering', sql: 'qr_ordering' },
  { ts: 'kitchenDisplay', sql: 'kitchen_display' },
  { ts: 'inventory', sql: 'inventory' },
  { ts: 'waste', sql: 'waste' },
  { ts: 'scheduling', sql: 'scheduling' },
  { ts: 'tasks', sql: 'tasks' },
  { ts: 'customBranding', sql: 'custom_branding' },
  { ts: 'analytics', sql: 'analytics' },
];

async function fetchPlanLimits(plan: string | null): Promise<Record<string, unknown>> {
  const { data, error } = await anonClient.rpc('plan_limits' as never, { plan } as never);
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  return data as unknown as Record<string, unknown>;
}

describe('plan_limits() SQL ↔ PLAN_LIMITS TS sync', () => {
  test.each(PLANS)('%s plan: SQL matches TS row-by-row', async (plan) => {
    const sqlRow = await fetchPlanLimits(plan);
    const tsRow = PLAN_LIMITS[plan];

    for (const { ts, sql } of FIELD_MAP) {
      expect({ field: ts, value: sqlRow[sql] }).toEqual({ field: ts, value: tsRow[ts] });
    }
  });

  test('unknown plan name defaults to free caps (fail-closed)', async () => {
    const sqlRow = await fetchPlanLimits('enterprise_unknown');
    expect(sqlRow.max_tables).toBe(PLAN_LIMITS.free.maxTables);
    expect(sqlRow.qr_ordering).toBe(PLAN_LIMITS.free.qrOrdering);
    expect(sqlRow.inventory).toBe(PLAN_LIMITS.free.inventory);
  });

  test('null plan defaults to free caps (fail-closed)', async () => {
    const sqlRow = await fetchPlanLimits(null);
    expect(sqlRow.max_tables).toBe(PLAN_LIMITS.free.maxTables);
    expect(sqlRow.qr_ordering).toBe(PLAN_LIMITS.free.qrOrdering);
  });
});
