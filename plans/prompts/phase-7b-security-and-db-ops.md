# Phase 7b Prompt: Security, DB Operations & Monitoring (SCALE-17 + SCALE-20 + SCALE-25 + SCALE-26)

Copy everything below the line and paste it as the prompt for a new Claude Code session.

---

## Task

Implement the second batch of Phase 7 from `plans/07-SCALING-AND-ARCHITECTURE-fixes.md`. This prompt covers security hardening, database operational improvements, and monitoring. Phases 1-6 and Phase 7a have already been implemented.

These items are independent. Total effort: ~3 days.

---

## SCALE-17: Remove CSP `unsafe-inline` for scripts

### Problem
Both apps set `script-src 'self' 'unsafe-inline'` in their Content-Security-Policy header. This weakens XSS protection — if an attacker injects HTML, inline scripts will execute. The `style-src 'unsafe-inline'` is acceptable (Tailwind CSS requires it), but `script-src 'unsafe-inline'` is not.

### Current state (verified)

**Both config files are identical in structure.**

`apps/staff-web/next.config.js` lines 46-57:
```javascript
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL || ''} wss://*.supabase.co https://*.sentry.io`,
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
},
```

`apps/customer-web/next.config.js` — identical CSP block at same line numbers.

**No inline scripts exist** — confirmed:
- Zero `dangerouslySetInnerHTML` usage in either app
- Zero inline `<script>` tags in components
- Zero `next/script` imports

**This means `'unsafe-inline'` for script-src is not needed at all.** The apps don't use any inline scripts. Next.js itself doesn't inject inline scripts in production builds (it uses external chunks).

### Implementation

**Step 1** — Remove `'unsafe-inline'` from `script-src` in both config files.

`apps/staff-web/next.config.js` line 49 — change from:
```javascript
`script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
```
to:
```javascript
`script-src 'self'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
```

`apps/customer-web/next.config.js` line 49 — same change.

**Step 2** — Keep `style-src 'self' 'unsafe-inline'` unchanged. Tailwind CSS generates styles at build time but some libraries (e.g., sonner toast, React rendering) may inject inline styles. Removing it would break styling.

**Step 3** — Keep `'unsafe-eval'` for development only. React hot reload and Next.js dev server require eval. The conditional `process.env.NODE_ENV === 'development'` is already correct.

**Step 4** — Test in production mode locally:

```bash
NODE_ENV=production pnpm build --filter=@gustri/staff-web
NODE_ENV=production pnpm start --filter=@gustri/staff-web
```

Open the app in the browser. Check the browser console for CSP violation reports. If any legitimate scripts are blocked, you'll see errors like:
```
Refused to execute inline script because it violates the following Content Security Policy directive: "script-src 'self'"
```

If this happens, there are two options:
- **Option A (recommended)**: Use nonce-based CSP with Next.js middleware to allow specific inline scripts
- **Option B (simpler)**: Add the hash of the specific inline script to the CSP directive

However, since we confirmed zero inline scripts exist, this should not happen.

**Potential issue**: Sentry's error tracking SDK may inject inline scripts for its replay/session functionality. If Sentry breaks after removing `'unsafe-inline'`, add Sentry's domain to the script-src:

```javascript
`script-src 'self' https://*.sentry.io${...}`,
```

Test Sentry error reporting after the change to verify it still works.

### Verification
- Both apps load correctly in production mode (no blank pages)
- Browser console shows no CSP violations during normal navigation
- Login flow works
- Sentry error capture still works (trigger a test error)
- Inject `<img onerror="alert(1)">` via browser DevTools → alert does NOT fire (CSP blocks it)
- Run `pnpm build` — both apps build successfully
- Run `pnpm check`

---

## SCALE-20: Reduce trigger contention on orders table

### Problem
The `orders` table has **7 triggers** and the `order_items` table has **5 triggers**. When a waiter updates an item status on a busy order, this cascade fires:

1. `update_order_items_updated_at` (BEFORE UPDATE) — sets `updated_at`
2. `trg_sync_order_status_from_items` (AFTER UPDATE of status) — may update `orders.status`
3. `recalculate_on_item_update` (AFTER UPDATE) — calls `calculate_order_total()` which updates `orders`
4. The orders update from step 2 or 3 fires `update_orders_updated_at` (BEFORE UPDATE)
5. Which may fire `cascade_order_status_trigger` (AFTER UPDATE of status)
6. Which updates order_items status, potentially re-firing triggers from step 1

At 100 cafes with concurrent item updates, this cascade can cause lock contention.

### Current state (verified)

**Triggers on orders table** (7 total):

| Trigger | Event | Function | Notes |
|---------|-------|----------|-------|
| `set_order_number_trigger` | BEFORE INSERT | `set_order_number()` | Safe — only on INSERT |
| `enforce_order_limit` | BEFORE INSERT | `check_order_limit()` | Safe — only on INSERT |
| `update_orders_updated_at` | BEFORE UPDATE | `update_updated_at_column()` | Runs on every UPDATE |
| `cascade_order_status_trigger` | AFTER UPDATE OF status | `cascade_order_status_to_items()` | May trigger item updates |
| `recalculate_on_discount_change` | AFTER UPDATE OF discount_type, discount_value | `recalculate_on_discount_change()` | Calls `calculate_order_total()` |
| `update_table_on_order` | AFTER INSERT OR UPDATE | `update_table_status_on_order()` | Runs on every INSERT/UPDATE |
| `trg_encrypt_order_pii` | BEFORE INSERT/UPDATE OF PII fields | `encrypt_order_pii()` | Only on PII field changes |

**Triggers on order_items table** (5 total):

| Trigger | Event | Function | Notes |
|---------|-------|----------|-------|
| `update_order_items_updated_at` | BEFORE UPDATE | `update_updated_at_column()` | Every UPDATE |
| `recalculate_on_item_insert` | AFTER INSERT | `recalculate_order_total()` | Calls `calculate_order_total()` |
| `recalculate_on_item_update` | AFTER UPDATE | `recalculate_order_total()` | Calls `calculate_order_total()` |
| `recalculate_on_item_delete` | AFTER DELETE | `recalculate_order_total()` | Calls `calculate_order_total()` |
| `trg_sync_order_status_from_items` | AFTER UPDATE OF status | `sync_order_status_from_items()` | From Phase 2 (SCALE-3) |

**Key issue**: `recalculate_on_item_update` fires on ANY column update of `order_items`, including `status` changes. But a status change doesn't affect the total — only `quantity` or `item_price` changes do. This means `calculate_order_total()` is called unnecessarily on every item status update.

**`calculate_order_total()`** (baseline.sql lines 90-132):
- Reads `cafe_settings` for tax config
- SUMs `item_price * quantity` from `order_items`
- Updates `subtotal`, `tax`, `total` on the `orders` row

### Implementation

**Step 1** — Create migration `supabase/migrations/YYYYMMDD_optimize_order_triggers.sql`:

```sql
-- ============================================================
-- Optimize order_items triggers to reduce unnecessary recalculations
-- ============================================================

-- 1. The recalculate_on_item_update trigger fires on ANY column update,
--    but only quantity and item_price changes affect the total.
--    Narrow the trigger to only fire when these columns change.

DROP TRIGGER IF EXISTS recalculate_on_item_update ON public.order_items;

CREATE TRIGGER recalculate_on_item_update
  AFTER UPDATE OF quantity, item_price ON public.order_items
  FOR EACH ROW
  WHEN (
    OLD.quantity IS DISTINCT FROM NEW.quantity
    OR OLD.item_price IS DISTINCT FROM NEW.item_price
  )
  EXECUTE FUNCTION public.recalculate_order_total();

-- 2. The update_table_on_order trigger fires on every INSERT OR UPDATE,
--    but table status only needs updating when order status or table_id changes.
--    Narrow to relevant columns only.

DROP TRIGGER IF EXISTS update_table_on_order ON public.orders;

CREATE TRIGGER update_table_on_order
  AFTER INSERT OR UPDATE OF status, table_id ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_table_status_on_order();
```

**Why these two optimizations matter most:**
- `recalculate_on_item_update`: Currently fires on status changes, which happen frequently (pending→preparing→ready→served for every item). The total never changes during status updates — this is pure waste. At 50 orders × 3 items × 4 status changes = 600 unnecessary `calculate_order_total()` calls per day per cafe.
- `update_table_on_order`: Currently fires on every order column update (notes, assigned_waiter, discount, etc.). Table status only depends on order status and table_id. This eliminates ~80% of unnecessary table status checks.

**Step 2** — Do NOT consolidate the three `order_items` recalculate triggers (insert/update/delete) into one. PostgreSQL doesn't support a single trigger for INSERT + UPDATE + DELETE with column-specific conditions. Keeping them separate is correct.

**Step 3** — Do NOT modify the `cascade_order_status_trigger` or `trg_sync_order_status_from_items` — they were carefully designed in Phase 2 to avoid infinite loops. Any change risks reintroducing the race condition.

**Step 4** — Do NOT modify `trg_encrypt_order_pii` — it already only fires on specific PII columns. It's optimized.

### Verification
- Update an item status (pending→preparing) → verify `calculate_order_total()` does NOT fire (check with `RAISE NOTICE` or query `pg_stat_user_functions` before/after)
- Update an item quantity → verify total IS recalculated
- Create a new order → verify table status updates correctly
- Update order notes → verify table status trigger does NOT fire
- Run all existing tests: `pnpm test`
- Run E2E tests to verify no behavioral regressions

---

## SCALE-25: Data retention and archival

### Problem
Orders, audit logs, and customer PII accumulate indefinitely. At 1.8M orders/year across 100 cafes, the `orders` table will grow to 10M+ rows within 5 years, degrading query performance. Also relevant for GDPR/KVKK compliance (right to erasure).

### Current state (verified)

- **No `pg_cron` extension** — not enabled in `supabase/config.toml`
- **No scheduled cleanup** — only `cleanup_empty_orders()` exists (from Phase 2), which is manual
- **No archive table or schema** exists
- **`pg_stat_statements`** is enabled (baseline.sql line 35) — useful for monitoring but not for retention
- Statement timeouts are configured (from Phase 4)

### Implementation

**Step 1** — Create migration `supabase/migrations/YYYYMMDD_data_retention.sql`:

```sql
-- ============================================================
-- Data retention: archive old orders, anonymize PII, purge logs
-- ============================================================

-- 1. Create archive schema for old completed orders
CREATE SCHEMA IF NOT EXISTS archive;

-- 2. Create archive table (same structure as orders)
CREATE TABLE IF NOT EXISTS archive.orders (LIKE public.orders INCLUDING ALL);
CREATE TABLE IF NOT EXISTS archive.order_items (LIKE public.order_items INCLUDING ALL);

-- 3. Data retention function
-- Moves closed/cancelled orders older than retention period to archive.
-- Anonymizes delivery customer PII older than PII retention period.
-- Deletes old waiter calls and waste logs.
--
-- Run periodically (weekly recommended).
-- Parameters use months for clarity.
CREATE OR REPLACE FUNCTION public.run_data_retention(
  p_order_retention_months INT DEFAULT 24,
  p_pii_retention_months INT DEFAULT 12,
  p_waiter_call_retention_months INT DEFAULT 6,
  p_waste_retention_months INT DEFAULT 24
)
RETURNS TABLE(
  orders_archived INT,
  items_archived INT,
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
  v_pii_anonymized INT := 0;
  v_calls_deleted INT := 0;
  v_waste_deleted INT := 0;
  v_archived_order_ids UUID[];
BEGIN
  v_order_cutoff := NOW() - (p_order_retention_months || ' months')::INTERVAL;
  v_pii_cutoff := NOW() - (p_pii_retention_months || ' months')::INTERVAL;
  v_call_cutoff := NOW() - (p_waiter_call_retention_months || ' months')::INTERVAL;
  v_waste_cutoff := NOW() - (p_waste_retention_months || ' months')::INTERVAL;

  -- Archive old closed/cancelled orders
  WITH moved_orders AS (
    DELETE FROM public.orders
    WHERE status IN ('closed', 'cancelled')
      AND created_at < v_order_cutoff
    RETURNING *
  )
  INSERT INTO archive.orders SELECT * FROM moved_orders;
  GET DIAGNOSTICS v_orders_archived = ROW_COUNT;

  -- Collect archived order IDs for item archival
  SELECT ARRAY_AGG(id) INTO v_archived_order_ids
  FROM archive.orders
  WHERE created_at < v_order_cutoff;

  -- Archive order items for archived orders
  IF v_archived_order_ids IS NOT NULL AND array_length(v_archived_order_ids, 1) > 0 THEN
    WITH moved_items AS (
      DELETE FROM public.order_items
      WHERE order_id = ANY(v_archived_order_ids)
      RETURNING *
    )
    INSERT INTO archive.order_items SELECT * FROM moved_items;
    GET DIAGNOSTICS v_items_archived = ROW_COUNT;
  END IF;

  -- Anonymize old delivery customer PII on non-archived orders
  UPDATE public.orders
  SET customer_name = 'REDACTED',
      customer_phone = 'REDACTED',
      delivery_address = 'REDACTED'
  WHERE order_type = 'delivery'
    AND created_at < v_pii_cutoff
    AND customer_name IS NOT NULL
    AND customer_name != 'REDACTED';
  GET DIAGNOSTICS v_pii_anonymized = ROW_COUNT;

  -- Delete old waiter calls
  DELETE FROM public.waiter_calls
  WHERE created_at < v_call_cutoff;
  GET DIAGNOSTICS v_calls_deleted = ROW_COUNT;

  -- Delete old waste logs
  DELETE FROM public.waste_logs
  WHERE created_at < v_waste_cutoff;
  GET DIAGNOSTICS v_waste_deleted = ROW_COUNT;

  orders_archived := v_orders_archived;
  items_archived := v_items_archived;
  pii_anonymized := v_pii_anonymized;
  waiter_calls_deleted := v_calls_deleted;
  waste_logs_deleted := v_waste_deleted;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Grant to service_role only (admin operation)
GRANT USAGE ON SCHEMA archive TO service_role;
GRANT ALL ON archive.orders TO service_role;
GRANT ALL ON archive.order_items TO service_role;
GRANT EXECUTE ON FUNCTION public.run_data_retention(INT, INT, INT, INT) TO service_role;
```

**Step 2** — Create an admin API endpoint to trigger retention manually. Create `apps/staff-web/src/app/api/v1/admin/retention/route.ts`:

```typescript
import type { NextRequest } from 'next/server';
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
      return NextResponse.json({ error: 'Retention failed' }, { status: 500 });
    }

    return NextResponse.json({ status: 'completed', results: data });
  } catch (err) {
    return handleRouteError(err);
  }
}
```

Add the `NextResponse` import at the top.

**Step 3** — For automated scheduling, document the recommended approach in a comment in the migration file:

```sql
-- SCHEDULING OPTIONS:
-- Option A (Supabase Pro): Enable pg_cron and schedule:
--   SELECT cron.schedule('data-retention', '0 3 * * 0', $$ SELECT run_data_retention(); $$);
--
-- Option B (External): Call the admin API endpoint via a cron service (e.g., cron-job.org, GitHub Actions scheduled workflow)
--
-- Option C (Manual): Run via Supabase Dashboard SQL editor when needed
```

Do NOT enable `pg_cron` in config.toml — it may not be available on all Supabase plans. The function works manually or via external scheduling.

**Step 4** — Important: the `DELETE FROM public.orders` will cascade-fail if there are foreign key constraints from `order_payments`, `refunds`, `customer_feedback`, etc. Check for foreign keys pointing to orders:

```sql
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE confrelid = 'public.orders'::regclass;
```

If there are FK constraints, you need to either:
- Archive the related tables too (payments, refunds) before deleting orders
- Add `ON DELETE CASCADE` to the FKs (dangerous — only if the data is also being archived)
- Delete from child tables first, then archive orders

Read the baseline migration to identify all FKs pointing to orders before implementing. The migration above may need to be extended to handle `order_payments`, `refunds`, and `table_transfers` rows for archived orders.

### Verification
- Insert test orders dated 3 years ago → run `SELECT * FROM run_data_retention()` → verify they move to `archive.orders`
- Verify `archive.order_items` also populated for archived orders
- Insert delivery order dated 18 months ago → verify PII anonymized to 'REDACTED'
- Insert waiter call dated 8 months ago → verify deleted
- Verify recent data (< retention period) is untouched
- Verify foreign key constraints don't cause failures
- Run `pnpm test && pnpm type-check && pnpm check`

---

## SCALE-26: Database monitoring with pg_stat_statements

### Problem
No visibility into query performance. Slow queries won't be detected until users complain. At 100 tenants, one badly-indexed query pattern from a single tenant can degrade the entire database.

### Current state (verified)

**`pg_stat_statements`** is already enabled (baseline.sql line 35):
```sql
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
```

**Health check** (`apps/staff-web/src/app/api/health/route.ts`, 22 lines):
- Only checks if `cafe_settings` table is reachable
- Returns `ok`, `degraded`, or `error`
- No performance metrics, no query stats, no connection count

**Statement timeouts** are configured (from Phase 4): 5s anon, 10s auth, 30s service_role.

### Implementation

**Step 1** — Create a database function to surface monitoring stats. Create migration `supabase/migrations/YYYYMMDD_monitoring_functions.sql`:

```sql
-- Monitoring functions for database health visibility

-- Top slow queries (average execution time)
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

-- Active connection summary
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

-- Table size and row estimates
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

-- Grant to service_role only (admin operation)
GRANT EXECUTE ON FUNCTION public.get_slow_queries(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_connection_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_table_stats() TO service_role;
```

**Step 2** — Enhance the health check API route. Replace `apps/staff-web/src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const supabase = getSupabaseAdmin();

    // Basic connectivity check
    const { error: dbError } = await supabase.from('cafe_settings').select('id').limit(1);

    if (dbError) {
      return NextResponse.json({
        status: 'degraded',
        timestamp,
        db: 'unreachable',
      });
    }

    // Connection stats (lightweight — no auth required for health checks)
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

**Step 3** — Create a protected admin endpoint for detailed stats. Create `apps/staff-web/src/app/api/v1/admin/db-stats/route.ts`:

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

**Step 4** — This endpoint is NOT meant for a UI dashboard (that can come later). It's for:
- Manual debugging: `curl -H "Authorization: Bearer $TOKEN" https://app.gustri.com/api/v1/admin/db-stats`
- External monitoring integration (Datadog, Grafana, etc.)
- On-call investigation during incidents

### Verification
- `GET /api/health` → returns `{ status: 'ok', db: 'connected', connections: N }`
- `GET /api/v1/admin/db-stats` without auth → 401
- `GET /api/v1/admin/db-stats` with admin auth → returns slow_queries, connections, tables
- `slow_queries` shows real query data (not empty — run some queries first)
- `tables` shows `orders`, `order_items`, etc. with row counts and sizes
- Run `pnpm test && pnpm type-check && pnpm check`

---

## Execution order

1. **SCALE-17** (CSP) — smallest change, highest security impact. One-line change per config file.
2. **SCALE-20** (triggers) — migration only, no app code. Test carefully.
3. **SCALE-26** (monitoring) — migration + 2 API routes. Independent of other items.
4. **SCALE-25** (retention) — most complex migration. Do last — verify FK constraints first.

## General rules

- Follow existing code patterns exactly
- Use Biome formatting: 2-space indent, single quotes, trailing commas. Run `pnpm check:fix` before considering done
- Migration filenames: use format `YYYYMMDD000001_description.sql`. Check existing migrations for latest date prefix
- For SCALE-20: do NOT modify triggers from Phase 2 (`trg_sync_order_status_from_items`) — they were carefully designed to avoid loops
- For SCALE-25: READ the baseline migration to find ALL foreign keys pointing to `orders` before implementing the DELETE. Missing a FK will cause the migration to fail in production with real data
- For SCALE-26: the monitoring functions use `SECURITY DEFINER` and are granted only to `service_role` — they should NOT be callable by anonymous or authenticated users
- Do NOT add comments, docstrings, or type annotations beyond what's needed
- Do NOT refactor surrounding code
- Run `pnpm test && pnpm type-check && pnpm check` at the end
