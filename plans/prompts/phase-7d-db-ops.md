# Phase 7d Prompt: Database Operations (SCALE-25 + SCALE-26 + SCALE-27)

Copy everything below the line and paste it as the prompt for a new Claude Code session.

---

## Task

Implement 3 database operation items from Phase 7 of `plans/07-SCALING-AND-ARCHITECTURE-fixes.md`. All are migrations + optional API routes. Total effort: ~2-3 days.

---

## SCALE-25: Data retention and archival

### Problem
Orders, audit logs, and customer PII accumulate indefinitely. At 1.8M orders/year across 100 cafes, the `orders` table will grow to 10M+ rows within 5 years.

### Current state (verified)
- No `pg_cron` extension enabled
- No archive schema or tables
- Only `cleanup_empty_orders()` exists (from Phase 2) — manual, for empty orders only
- Statement timeouts are configured (from Phase 4)

**Foreign keys pointing to `orders` (verified from baseline.sql):**

| Constraint | Table | On Delete |
|-----------|-------|-----------|
| `order_items_order_id_fkey` | order_items | CASCADE |
| `order_payments_order_id_fkey` | order_payments | CASCADE |
| `refunds_order_id_fkey` | refunds | CASCADE |
| `table_transfers_order_id_fkey` | table_transfers | CASCADE |
| `customer_feedback_order_id_fkey` | customer_feedback | SET NULL |

Since `order_items`, `order_payments`, `refunds`, and `table_transfers` all use `ON DELETE CASCADE`, deleting from `orders` will automatically delete related rows. `customer_feedback` uses `SET NULL` (order_id becomes null, feedback kept). This means we can DELETE from `orders` directly — cascades handle child rows.

However, for archival purposes we should archive child rows BEFORE deleting the parent, otherwise the cascaded deletes happen before we can copy them.

### Implementation

**Step 1** — Create migration `supabase/migrations/YYYYMMDD_data_retention.sql`:

```sql
-- Data retention: archive old orders, anonymize PII, purge old logs
-- Run periodically via admin API or pg_cron if available.

CREATE SCHEMA IF NOT EXISTS archive;

-- Archive tables mirror public tables
CREATE TABLE IF NOT EXISTS archive.orders (LIKE public.orders INCLUDING ALL);
CREATE TABLE IF NOT EXISTS archive.order_items (LIKE public.order_items INCLUDING ALL);
CREATE TABLE IF NOT EXISTS archive.order_payments (LIKE public.order_payments INCLUDING ALL);

CREATE OR REPLACE FUNCTION public.run_data_retention(
  p_order_retention_months INT DEFAULT 24,
  p_pii_retention_months INT DEFAULT 12,
  p_waiter_call_retention_months INT DEFAULT 6,
  p_waste_retention_months INT DEFAULT 24
)
RETURNS TABLE(
  orders_archived INT,
  items_archived INT,
  payments_archived INT,
  pii_anonymized INT,
  waiter_calls_deleted INT,
  waste_logs_deleted INT
) AS $$
DECLARE
  v_order_cutoff TIMESTAMPTZ;
  v_pii_cutoff TIMESTAMPTZ;
  v_call_cutoff TIMESTAMPTZ;
  v_waste_cutoff TIMESTAMPTZ;
  v_orders_archived INT := 0;
  v_items_archived INT := 0;
  v_payments_archived INT := 0;
  v_pii_anonymized INT := 0;
  v_calls_deleted INT := 0;
  v_waste_deleted INT := 0;
  v_order_ids UUID[];
BEGIN
  v_order_cutoff := NOW() - (p_order_retention_months || ' months')::INTERVAL;
  v_pii_cutoff := NOW() - (p_pii_retention_months || ' months')::INTERVAL;
  v_call_cutoff := NOW() - (p_waiter_call_retention_months || ' months')::INTERVAL;
  v_waste_cutoff := NOW() - (p_waste_retention_months || ' months')::INTERVAL;

  -- 1. Identify orders to archive
  SELECT ARRAY_AGG(id) INTO v_order_ids
  FROM public.orders
  WHERE status IN ('closed', 'cancelled')
    AND created_at < v_order_cutoff;

  IF v_order_ids IS NOT NULL AND array_length(v_order_ids, 1) > 0 THEN
    -- 2. Archive child rows FIRST (before CASCADE deletes them)
    INSERT INTO archive.order_items
    SELECT * FROM public.order_items WHERE order_id = ANY(v_order_ids);
    GET DIAGNOSTICS v_items_archived = ROW_COUNT;

    INSERT INTO archive.order_payments
    SELECT * FROM public.order_payments WHERE order_id = ANY(v_order_ids);
    GET DIAGNOSTICS v_payments_archived = ROW_COUNT;

    -- 3. Archive and delete orders (CASCADE handles remaining child rows)
    INSERT INTO archive.orders
    SELECT * FROM public.orders WHERE id = ANY(v_order_ids);

    DELETE FROM public.orders WHERE id = ANY(v_order_ids);
    GET DIAGNOSTICS v_orders_archived = ROW_COUNT;
  END IF;

  -- 4. Anonymize delivery PII on non-archived orders
  UPDATE public.orders
  SET customer_name = 'REDACTED',
      customer_phone = 'REDACTED',
      delivery_address = 'REDACTED'
  WHERE order_type = 'delivery'
    AND created_at < v_pii_cutoff
    AND customer_name IS NOT NULL
    AND customer_name != 'REDACTED';
  GET DIAGNOSTICS v_pii_anonymized = ROW_COUNT;

  -- 5. Delete old waiter calls
  DELETE FROM public.waiter_calls WHERE created_at < v_call_cutoff;
  GET DIAGNOSTICS v_calls_deleted = ROW_COUNT;

  -- 6. Delete old waste logs
  DELETE FROM public.waste_logs WHERE created_at < v_waste_cutoff;
  GET DIAGNOSTICS v_waste_deleted = ROW_COUNT;

  orders_archived := v_orders_archived;
  items_archived := v_items_archived;
  payments_archived := v_payments_archived;
  pii_anonymized := v_pii_anonymized;
  waiter_calls_deleted := v_calls_deleted;
  waste_logs_deleted := v_waste_deleted;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Only service_role can run retention (admin operation)
GRANT USAGE ON SCHEMA archive TO service_role;
GRANT ALL ON archive.orders TO service_role;
GRANT ALL ON archive.order_items TO service_role;
GRANT ALL ON archive.order_payments TO service_role;
GRANT EXECUTE ON FUNCTION public.run_data_retention(INT, INT, INT, INT) TO service_role;

-- SCHEDULING (choose one when ready):
-- pg_cron:  SELECT cron.schedule('retention', '0 3 * * 0', $$ SELECT run_data_retention(); $$);
-- External: POST /api/v1/admin/retention via cron-job.org or GitHub Actions schedule
-- Manual:   Run in Supabase SQL Editor when needed
```

**Step 2** — Create admin API route `apps/staff-web/src/app/api/v1/admin/retention/route.ts`:

```typescript
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getSupabaseAdmin, verifyAdmin } from '@/lib/api/verify-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const adminOrError = await verifyAdmin(request);
    if (adminOrError instanceof NextResponse) return adminOrError;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('run_data_retention');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: 'completed', results: data });
  } catch (err) {
    return handleRouteError(err);
  }
}
```

### Verification
- Insert test orders/items/payments dated 3 years ago → run `SELECT * FROM run_data_retention()` → verify moved to `archive.*`
- Verify `archive.order_items` and `archive.order_payments` populated
- Insert delivery order 18 months old → PII anonymized to 'REDACTED'
- Recent data untouched
- `POST /api/v1/admin/retention` with admin auth → returns results
- `POST /api/v1/admin/retention` without auth → 401
- Run `pnpm test && pnpm type-check && pnpm check`

---

## SCALE-26: Database monitoring with pg_stat_statements

### Problem
No visibility into query performance. `pg_stat_statements` is enabled (baseline.sql line 35) but unused. Health check route (`apps/staff-web/src/app/api/health/route.ts`) only checks DB connectivity.

### Current state (verified)
- `pg_stat_statements` extension exists in `extensions` schema
- Health check: 22 lines, pings `cafe_settings` table, returns ok/degraded/error
- No monitoring functions, no admin stats endpoint

### Implementation

**Step 1** — Create migration `supabase/migrations/YYYYMMDD_monitoring_functions.sql`:

```sql
-- Database monitoring functions for operational visibility

CREATE OR REPLACE FUNCTION public.get_slow_queries(p_limit INT DEFAULT 10)
RETURNS TABLE(
  query_preview TEXT,
  calls BIGINT,
  avg_ms NUMERIC,
  max_ms NUMERIC,
  total_ms NUMERIC,
  rows_per_call NUMERIC
) AS $$
  SELECT
    LEFT(query, 120) AS query_preview,
    calls,
    ROUND(mean_exec_time::NUMERIC, 2) AS avg_ms,
    ROUND(max_exec_time::NUMERIC, 2) AS max_ms,
    ROUND(total_exec_time::NUMERIC, 2) AS total_ms,
    ROUND(rows::NUMERIC / NULLIF(calls, 0), 1) AS rows_per_call
  FROM extensions.pg_stat_statements
  WHERE calls > 5
    AND query NOT LIKE '%pg_stat%'
  ORDER BY mean_exec_time DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '';

CREATE OR REPLACE FUNCTION public.get_connection_stats()
RETURNS TABLE(
  state TEXT,
  connection_count BIGINT,
  oldest_query_seconds NUMERIC
) AS $$
  SELECT
    COALESCE(state, 'unknown') AS state,
    COUNT(*) AS connection_count,
    ROUND(EXTRACT(EPOCH FROM MAX(NOW() - query_start))::NUMERIC, 1) AS oldest_query_seconds
  FROM pg_stat_activity
  WHERE pid != pg_backend_pid()
  GROUP BY state;
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '';

CREATE OR REPLACE FUNCTION public.get_table_stats()
RETURNS TABLE(
  table_name TEXT,
  estimated_rows BIGINT,
  total_size TEXT,
  index_size TEXT
) AS $$
  SELECT
    relname::TEXT AS table_name,
    reltuples::BIGINT AS estimated_rows,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
    pg_size_pretty(pg_indexes_size(c.oid)) AS index_size
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND reltuples > 0
  ORDER BY pg_total_relation_size(c.oid) DESC
  LIMIT 20;
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '';

GRANT EXECUTE ON FUNCTION public.get_slow_queries(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_connection_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_table_stats() TO service_role;
```

**Step 2** — Enhance health check at `apps/staff-web/src/app/api/health/route.ts`. Replace the current 22-line file:

```typescript
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const supabase = getSupabaseAdmin();
    const { error: dbError } = await supabase.from('cafe_settings').select('id').limit(1);

    if (dbError) {
      return NextResponse.json({ status: 'degraded', timestamp, db: 'unreachable' });
    }

    const { data: connStats } = await supabase.rpc('get_connection_stats');
    const activeConnections = (connStats || []).reduce(
      (sum: number, row: { connection_count: number }) => sum + Number(row.connection_count),
      0,
    );

    return NextResponse.json({
      status: 'ok',
      timestamp,
      db: 'connected',
      connections: activeConnections,
    });
  } catch {
    return NextResponse.json({ status: 'error', timestamp, db: 'unreachable' }, { status: 503 });
  }
}
```

**Step 3** — Create admin stats endpoint at `apps/staff-web/src/app/api/v1/admin/db-stats/route.ts`:

```typescript
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getSupabaseAdmin, verifyAdmin } from '@/lib/api/verify-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const adminOrError = await verifyAdmin(request);
    if (adminOrError instanceof NextResponse) return adminOrError;

    const supabase = getSupabaseAdmin();
    const [slowQueries, connStats, tableStats] = await Promise.all([
      supabase.rpc('get_slow_queries', { p_limit: 10 }),
      supabase.rpc('get_connection_stats'),
      supabase.rpc('get_table_stats'),
    ]);

    return NextResponse.json({
      slow_queries: slowQueries.data || [],
      connections: connStats.data || [],
      tables: tableStats.data || [],
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
```

### Verification
- `GET /api/health` → `{ status: 'ok', db: 'connected', connections: N }`
- `GET /api/v1/admin/db-stats` without auth → 401
- `GET /api/v1/admin/db-stats` with admin Bearer token → returns slow_queries, connections, tables
- `tables` array includes `orders`, `order_items` with row counts
- Run `pnpm test && pnpm type-check && pnpm check`

---

## SCALE-27: Feature flags via cafe_settings

### Problem
No way to enable/disable features per tenant. Rolling out risky changes is all-or-nothing across 100 cafes.

### Current state (verified)
`cafe_settings` table (baseline.sql lines 998-1028) has many config columns (`tax_enabled`, `qr_ordering_enabled`, `delivery_enabled`, `tips_enabled`, etc.) but no generic feature flags column. No `useFeatureFlag` hook exists.

### Implementation

**Step 1** — Create migration `supabase/migrations/YYYYMMDD_feature_flags.sql`:

```sql
-- Add generic feature flags column to cafe_settings
ALTER TABLE public.cafe_settings
ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}'::JSONB;

COMMENT ON COLUMN public.cafe_settings.feature_flags IS
  'Per-tenant feature toggles. Keys: feature name (string), values: boolean or config object.';
```

**Step 2** — Create `packages/queries/src/hooks/use-feature-flag.ts`:

```typescript
import { useCafeSettings } from './use-cafe-settings';

export function useFeatureFlag(flag: string, defaultValue = false): boolean {
  const { data: settings } = useCafeSettings();
  if (!settings) return defaultValue;
  const flags = (settings as any).feature_flags;
  if (!flags || typeof flags !== 'object') return defaultValue;
  return flags[flag] === true;
}
```

Note: `feature_flags` is typed as `Json` in the generated database types (since it's JSONB). The `(settings as any).feature_flags` cast is needed because the generated `CafeSettings` type may not include the new column until types are regenerated. After running `supabase gen types`, the cast can be removed.

**Step 3** — Export from `packages/queries/src/hooks/index.ts`. Check the file and add:

```typescript
export { useFeatureFlag } from './use-feature-flag';
```

**Step 4** — Also export from the app-level hooks barrel file if one exists. Check `apps/staff-web/src/hooks/index.ts` for re-exports from `@gustri/queries`.

**Step 5** — Add feature flags to the settings API. Read `apps/staff-web/src/app/api/v1/settings/route.ts` and check if the PUT handler already accepts arbitrary fields or has a fixed schema. If it uses Zod validation, add `feature_flags` to the schema:

```typescript
// Add to the existing settings Zod schema:
feature_flags: z.record(z.string(), z.boolean()).optional(),
```

**Step 6** — Usage example (do NOT implement — just document in a code comment in the hook file):

```typescript
// Usage:
// const deliveryV2 = useFeatureFlag('delivery_v2');
// if (!deliveryV2) return <OldDeliveryFlow />;
```

### Verification
- Manually set `feature_flags` on a cafe_settings row: `UPDATE cafe_settings SET feature_flags = '{"test_feature": true}'`
- `useFeatureFlag('test_feature')` → returns `true`
- `useFeatureFlag('nonexistent')` → returns `false`
- Settings API accepts `feature_flags` in PUT request
- Run `pnpm test && pnpm type-check && pnpm check`

---

## Execution order
1. **SCALE-27** (feature flags) — simplest migration + hook
2. **SCALE-26** (monitoring) — migration + 2 API routes
3. **SCALE-25** (retention) — most complex, touches FKs and archival

## General rules
- Biome formatting: 2-space indent, single quotes, trailing commas. Run `pnpm check:fix`
- Migration filenames: `YYYYMMDD000001_description.sql`, check latest date
- All monitoring/retention functions use `SECURITY DEFINER` + `SET search_path = ''`
- All admin endpoints use `verifyAdmin` — never expose to unauthenticated users
- Run `pnpm test && pnpm type-check && pnpm check` at the end
