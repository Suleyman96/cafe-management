# Scaling & Architecture Fix Plan

> Generated: 2026-04-23
> Target: 100 cafes, 50 orders/day each (5K orders/day, 1.8M/year)
> Scope: 14 architecture issues + multi-tenant scaling requirements

---

## Execution Order & Rationale

The plan is split into 6 phases. Each phase unlocks the next — do not skip ahead.

| Phase | Focus | Issues Covered | Effort |
|-------|-------|---------------|--------|
| 1 | Data layer — stop fetching everything | #1, #2 | 3-4 days |
| 2 | Data integrity — fix race conditions & silent failures | #3, #4, #12 | 2-3 days |
| 3 | Multi-tenant correctness & security | #13, #14 | 1-2 days |
| 4 | Performance at scale | Middleware, connection pooling, caching (#9) | 2-3 days |
| 5 | Resilience & observability | #10, #11 | 2-3 days |
| 6 | Frontend architecture & test quality | #5, #6, #7, #8 | 5-7 days |
| 7 | Hardening & operational | CSP, error boundaries, monitoring, images, retention, flags, mobile | 13-17 days |

**Total: 34 items across 7 phases, ~30-42 days of focused work**

---

## Phase 1: Data Layer (MUST DO FIRST)

These are the issues that will crash the app under real load. Everything else
is pointless if the app OOMs when a cafe owner opens reports.

### SCALE-1: Server-side aggregation for reports (Issue #1)

**Problem:** `apps/staff-web/src/app/(staff)/reports/page.tsx` fetches ALL
orders, expenses, waste logs, and staff into browser memory. Filters with
`useMemo()`. A single cafe with 6 months of data (~9K orders) will freeze
the browser tab.

**Why first:** This is the single most visible failure. Every cafe owner will
open reports. It will break within weeks of real usage.

**Files to create:**
- `supabase/migrations/YYYYMMDD_report_aggregation_functions.sql`

**Files to change:**
- `packages/api-client/src/wrapper/` — add report-specific query methods
- `packages/queries/src/hooks/` — add report query hooks
- `apps/staff-web/src/app/(staff)/reports/page.tsx` — consume aggregated data

**Plan:**

Step 1 — Create database functions for each report type:

```sql
-- Daily revenue summary
CREATE OR REPLACE FUNCTION get_revenue_summary(
  p_tenant_id UUID,
  p_from DATE,
  p_to DATE
) RETURNS TABLE(
  report_date DATE,
  total_revenue NUMERIC,
  order_count INT,
  avg_ticket NUMERIC,
  payment_method_breakdown JSONB
) AS $$
  SELECT
    DATE(created_at) as report_date,
    SUM(total) as total_revenue,
    COUNT(*)::INT as order_count,
    AVG(total) as avg_ticket,
    jsonb_object_agg(
      COALESCE(payment_method, 'unpaid'),
      method_count
    ) as payment_method_breakdown
  FROM orders_decrypted
  WHERE tenant_id = p_tenant_id
    AND DATE(created_at) BETWEEN p_from AND p_to
    AND status NOT IN ('cancelled')
  GROUP BY DATE(created_at)
  ORDER BY report_date DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Expense summary by category
CREATE OR REPLACE FUNCTION get_expense_summary(
  p_tenant_id UUID,
  p_from DATE,
  p_to DATE
) RETURNS TABLE(
  category_name TEXT,
  total_amount NUMERIC,
  entry_count INT
) AS $$
  SELECT
    ec.name as category_name,
    SUM(e.amount) as total_amount,
    COUNT(*)::INT as entry_count
  FROM expenses e
  JOIN expense_categories ec ON ec.id = e.category_id
  WHERE e.tenant_id = p_tenant_id
    AND DATE(e.created_at) BETWEEN p_from AND p_to
  GROUP BY ec.name
  ORDER BY total_amount DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Waste summary
CREATE OR REPLACE FUNCTION get_waste_summary(
  p_tenant_id UUID,
  p_from DATE,
  p_to DATE
) RETURNS TABLE(
  waste_reason TEXT,
  item_name TEXT,
  total_quantity NUMERIC,
  total_cost NUMERIC,
  entry_count INT
) AS $$
  SELECT
    wl.reason::TEXT as waste_reason,
    si.name as item_name,
    SUM(wl.quantity) as total_quantity,
    SUM(wl.cost) as total_cost,
    COUNT(*)::INT as entry_count
  FROM waste_logs wl
  JOIN stock_items si ON si.id = wl.stock_item_id
  WHERE wl.tenant_id = p_tenant_id
    AND DATE(wl.created_at) BETWEEN p_from AND p_to
  GROUP BY wl.reason, si.name
  ORDER BY total_cost DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Z-report (end of day summary)
CREATE OR REPLACE FUNCTION get_z_report(
  p_tenant_id UUID,
  p_date DATE
) RETURNS TABLE(
  total_revenue NUMERIC,
  total_orders INT,
  total_refunds NUMERIC,
  total_discounts NUMERIC,
  net_revenue NUMERIC,
  cash_total NUMERIC,
  card_total NUMERIC,
  digital_total NUMERIC,
  avg_ticket NUMERIC,
  busiest_hour INT
) AS $$
  WITH order_data AS (
    SELECT * FROM orders_decrypted
    WHERE tenant_id = p_tenant_id
      AND DATE(created_at) = p_date
      AND status NOT IN ('cancelled')
  )
  SELECT
    COALESCE(SUM(total), 0) as total_revenue,
    COUNT(*)::INT as total_orders,
    COALESCE(SUM(CASE WHEN refund_amount > 0 THEN refund_amount ELSE 0 END), 0),
    COALESCE(SUM(discount_amount), 0),
    COALESCE(SUM(total) - SUM(COALESCE(refund_amount, 0)), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'digital' THEN total ELSE 0 END), 0),
    COALESCE(AVG(total), 0),
    (SELECT EXTRACT(HOUR FROM created_at)::INT
     FROM order_data GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 1)
  FROM order_data;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

Step 2 — Add wrapper methods in `packages/api-client/`:

```typescript
// New file: packages/api-client/src/wrapper/reports.ts
export function createReportsWrapper(ctx: WrapperContext) {
  return {
    getRevenueSummary: async (from: string, to: string) => {
      const { data, error } = await ctx.anyClient
        .rpc('get_revenue_summary', {
          p_tenant_id: ctx.tenantId,
          p_from: from,
          p_to: to,
        });
      if (error) throw handleSupabaseError(error);
      return data;
    },
    // ... same pattern for expense, waste, z-report
  };
}
```

Step 3 — Add React Query hooks in `packages/queries/`:

```typescript
// packages/queries/src/hooks/use-reports.ts
export function useRevenueSummary(from: string, to: string) {
  const db = useSupabaseWrapper();
  return useQuery({
    queryKey: ['reports', 'revenue', from, to],
    queryFn: () => db.reports.getRevenueSummary(from, to),
    staleTime: 5 * 60 * 1000, // reports can be 5min stale
  });
}
```

Step 4 — Rewrite `reports/page.tsx` to consume aggregated data:
- Remove `useOrders()`, `useExpenses()`, `useStaff()`, `useWasteLogs()`
- Replace with `useRevenueSummary()`, `useExpenseSummary()`, `useWasteSummary()`
- Remove all `useMemo()` filtering — the database does the work now
- Keep the chart components, just feed them pre-aggregated data

**Verification:**
- Reports page loads in <1s with 10K+ orders in database
- `EXPLAIN ANALYZE` on each function shows index usage
- Charts display identical data to current implementation (compare visually)

---

### SCALE-2: Pagination on all unbounded queries (Issue #2)

**Problem:** Multiple data wrappers fetch everything without limits:
- Menu items: `.limit(500)` hard cap — `packages/api-client/src/wrapper/menu.ts:28`
- Delivery customers: no limit — `packages/api-client/src/wrapper/delivery-customers.ts:10`
- Staff: no limit — `packages/api-client/src/wrapper/staff.ts`
- Tables: no limit — `packages/api-client/src/wrapper/tables.ts`

**Why second:** After reports, these are the next queries that will grow unbounded.
Delivery customers especially — a cafe doing 10 deliveries/day accumulates
3,600 customer records/year.

**Files to change:**
- `packages/api-client/src/wrapper/delivery-customers.ts`
- `packages/api-client/src/wrapper/menu.ts`
- `packages/queries/src/hooks/use-delivery-customers.ts` (or equivalent)
- `packages/queries/src/hooks/use-menu.ts` (or equivalent)

**Plan:**

Step 1 — Add cursor-based pagination to delivery customers:

```typescript
// packages/api-client/src/wrapper/delivery-customers.ts
async findAllPaginated(options?: { page?: number; pageSize?: number; search?: string }) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = ctx.anyClient
    .from('delivery_customers')
    .select('*', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (options?.search) {
    query = query.or(`name.ilike.%${options.search}%,phone.ilike.%${options.search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw handleSupabaseError(error);
  return { data: data ?? [], total: count ?? 0, page, pageSize };
}
```

Step 2 — Add pagination to menu items (increase limit, add proper pagination):

```typescript
// packages/api-client/src/wrapper/menu.ts
async findAllPaginated(options?: { page?: number; pageSize?: number; categoryId?: string }) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 100;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = ctx.anyClient
    .from('menu_items')
    .select('*, categories(*)', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .order('sort_order', { ascending: true })
    .range(from, to);

  if (options?.categoryId) {
    query = query.eq('category_id', options.categoryId);
  }

  const { data, error, count } = await query;
  if (error) throw handleSupabaseError(error);
  return { data: data ?? [], total: count ?? 0, page, pageSize };
}
```

Step 3 — Keep `findAll()` for backward compat but add deprecation comment.
Update hooks to use paginated versions.

Step 4 — Staff and tables are fine at 100 cafes (each cafe has <50 staff,
<30 tables). Add `.limit(200)` as a safety net but don't over-engineer.

**Verification:**
- Delivery customer list renders with pagination controls
- Menu page loads correctly with paginated data
- Search still works across paginated results
- `pnpm test` passes

---

## Phase 2: Data Integrity

These bugs silently corrupt data. A cafe owner won't notice until a table is
stuck "occupied" for hours or an order status is wrong.

### SCALE-3: Atomic order status transitions (Issue #3)

**Problem:** `apps/staff-web/src/app/(staff)/orders/[id]/page.tsx:296-327`
updates item status, then calculates order status from **local state** (which
may already be stale from another user's changes), then fires a second mutation.
Two staff members updating items simultaneously can produce an incorrect order
status.

**Why this order:** Data integrity must be fixed before adding more load.
At 100 cafes, concurrent edits are guaranteed.

**Files to create:**
- `supabase/migrations/YYYYMMDD_atomic_order_status_sync.sql`

**Files to change:**
- `apps/staff-web/src/app/(staff)/orders/[id]/page.tsx`

**Plan:**

Step 1 — Move order status calculation to a database trigger:

```sql
CREATE OR REPLACE FUNCTION sync_order_status_from_items()
RETURNS TRIGGER AS $$
DECLARE
  v_all_served BOOLEAN;
  v_all_ready BOOLEAN;
  v_any_preparing BOOLEAN;
  v_current_status TEXT;
BEGIN
  SELECT status INTO v_current_status
  FROM orders WHERE id = NEW.order_id;

  -- Don't sync if order is in terminal state
  IF v_current_status IN ('closed', 'cancelled', 'delivered') THEN
    RETURN NEW;
  END IF;

  SELECT
    BOOL_AND(status = 'served') FILTER (WHERE status != 'cancelled'),
    BOOL_AND(status IN ('ready', 'served')) FILTER (WHERE status != 'cancelled'),
    BOOL_OR(status = 'preparing') FILTER (WHERE status != 'cancelled')
  INTO v_all_served, v_all_ready, v_any_preparing
  FROM order_items
  WHERE order_id = NEW.order_id;

  IF v_all_served THEN
    UPDATE orders SET status = 'served' WHERE id = NEW.order_id AND status != 'served';
  ELSIF v_all_ready THEN
    UPDATE orders SET status = 'ready' WHERE id = NEW.order_id AND status != 'ready';
  ELSIF v_any_preparing THEN
    UPDATE orders SET status = 'preparing' WHERE id = NEW.order_id AND status != 'preparing';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_order_status
  AFTER UPDATE OF status ON order_items
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION sync_order_status_from_items();
```

Step 2 — Remove client-side order status calculation from the page component.
The item status mutation alone is sufficient — the trigger handles the rest.

```typescript
// BEFORE (lines 296-327):
await updateItemStatus.mutateAsync({ itemId, status: newStatus });
// ... 30 lines of local status calculation ...
await updateOrderStatus.mutateAsync({ orderId, status: targetStatus });

// AFTER:
await updateItemStatus.mutateAsync({ itemId, status: newStatus });
// Trigger handles order status. Realtime subscription picks up the change.
await queryClient.invalidateQueries({ queryKey: ['order', orderId] });
```

Step 3 — Verify the existing `cascade_order_status_to_items` trigger doesn't
conflict with this new trigger (check `supabase/migrations/00000000000000_baseline.sql`).

**Verification:**
- Open same order in two browser tabs
- Update item status simultaneously from both
- Order status should always be consistent
- Run `pnpm test` — update any tests that mock order status sync

---

### SCALE-4: Fix silent failures that orphan data (Issue #4)

**Problem:** `packages/api-client/src/wrapper/orders.ts:535-585`
(`cleanupEmptyOrders`) cancels orders then tries to free tables. If the table
update fails, the order is cancelled but the table stays "occupied" forever.
Also: `apps/staff-web/src/hooks/use-auth.ts:17-28` uses `.catch(console.warn)`
for post-login side effects.

**Files to change:**
- `packages/api-client/src/wrapper/orders.ts` (cleanupEmptyOrders)
- `apps/staff-web/src/hooks/use-auth.ts` (post-login side effects)

**Plan:**

Step 1 — Wrap cleanup in a database function for atomicity:

```sql
CREATE OR REPLACE FUNCTION cleanup_empty_orders(p_tenant_id UUID)
RETURNS TABLE(cancelled_order_id UUID, freed_table_id UUID) AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT o.id as order_id, o.table_id
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.tenant_id = p_tenant_id
      AND o.status = 'pending_approval'
      AND o.created_at < NOW() - INTERVAL '30 minutes'
      AND oi.id IS NULL
  LOOP
    UPDATE orders SET status = 'cancelled' WHERE id = r.order_id;
    IF r.table_id IS NOT NULL THEN
      UPDATE tables SET status = 'free', occupied_at = NULL
      WHERE id = r.table_id AND status = 'occupied';
    END IF;
    cancelled_order_id := r.order_id;
    freed_table_id := r.table_id;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

This runs as a single transaction — if the table update fails, the order
cancellation rolls back too.

Step 2 — Replace the JS loop in `orders.ts` with an RPC call to this function.

Step 3 — Fix post-login side effects — log to Sentry instead of console:

```typescript
// BEFORE:
db.staff.updateLastLogin(staffId).catch(console.warn);

// AFTER:
db.staff.updateLastLogin(staffId).catch((err) => {
  Sentry.captureException(err, { tags: { context: 'post-login' } });
});
```

**Verification:**
- Simulate table update failure (temporarily add a constraint), verify
  order is NOT cancelled when table can't be freed
- Check Sentry receives post-login errors

---

### SCALE-5: Make mutation error handlers mandatory (Issue #12)

**Problem:** All mutation hooks in `packages/queries/src/mutations/` accept
`onError` as optional. Many call sites don't provide one. Failed mutations
disappear silently.

**Files to change:**
- `packages/queries/src/mutations/use-menu-mutations.ts`
- `packages/queries/src/mutations/use-order-mutations.ts`
- `packages/queries/src/mutations/use-staff-mutations.ts`
- `packages/queries/src/mutations/use-table-mutations.ts`
- (and all other mutation files in this directory)

**Plan:**

Step 1 — Add a global mutation error handler in React Query config:

```typescript
// apps/staff-web/src/app/providers.tsx
new QueryClient({
  defaultOptions: {
    mutations: {
      onError: (error) => {
        Sentry.captureException(error);
        toast.error(
          error instanceof AppError ? error.message : 'Operation failed'
        );
      },
    },
  },
})
```

This ensures every mutation that doesn't provide its own `onError` still
shows a toast and reports to Sentry.

Step 2 — Keep per-mutation `onError` as optional override for custom behavior
(e.g., specific error messages). The global handler acts as a safety net.

Step 3 — Audit all mutation call sites and remove any bare `.catch(console.error)`
patterns — they're now redundant.

**Verification:**
- Temporarily break an API endpoint, trigger a mutation, verify toast appears
- Verify Sentry receives the error
- `pnpm test` passes

---

## Phase 3: Multi-Tenant Correctness

These won't crash at 1 cafe but will cause real problems as you onboard
multiple tenants.

### SCALE-6: Delivery order IDOR vulnerability (Issue #13)

**Problem:** `get_delivery_order(p_order_id)` RPC function returns any order
by UUID. No validation that the caller has access to that order. While UUIDs
are hard to guess, this is an information disclosure vulnerability.

**Files to change:**
- `supabase/migrations/` — new migration to add access control

**Plan:**

Step 1 — Add a short-lived access token to delivery orders:

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS
  delivery_access_token TEXT DEFAULT encode(gen_random_bytes(16), 'hex');

CREATE OR REPLACE FUNCTION get_delivery_order(
  p_order_id UUID,
  p_access_token TEXT
) RETURNS SETOF orders_decrypted AS $$
  SELECT * FROM orders_decrypted
  WHERE id = p_order_id
    AND delivery_access_token = p_access_token
    AND order_type = 'delivery';
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

Step 2 — Update customer-web to pass the access token (received at order
creation time and stored in URL hash or localStorage).

Step 3 — Update `apps/customer-web/src/hooks/use-delivery.ts` to pass the token.

**Verification:**
- Call `get_delivery_order` with correct token — returns order
- Call with wrong token — returns empty
- Call without token — returns empty

---

### SCALE-7: Staff email uniqueness per tenant (Issue #14)

**Problem:** Staff email has `UNIQUE("email")` globally. Two cafes can't
register the same email. This breaks multi-tenancy.

**Files to create:**
- `supabase/migrations/YYYYMMDD_fix_staff_email_tenant_unique.sql`

**Plan:**

Step 1 — Replace global unique with composite:

```sql
-- Drop global unique
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_email_key;

-- Add tenant-scoped unique
CREATE UNIQUE INDEX idx_staff_email_tenant
  ON staff (LOWER(email), tenant_id);
```

Step 2 — Verify staff creation API still validates email uniqueness (it should
now be scoped to tenant). Check `apps/staff-web/src/app/api/staff/route.ts`.

Step 3 — Verify login flow works — Supabase auth users are global, but staff
records are per-tenant. The auth user might exist but staff record lookup
must be tenant-scoped.

**Verification:**
- Create staff with `test@example.com` in tenant A — succeeds
- Create staff with `test@example.com` in tenant B — succeeds
- Create staff with `test@example.com` in tenant A again — fails (duplicate)
- Login flow works for both users

---

## Phase 4: Performance at Scale

With 300-500 concurrent staff users (100 cafes x 3-5 staff each), these
optimizations prevent the database from being the bottleneck.

### SCALE-8: JWT custom claims instead of middleware DB lookup

**Problem:** `apps/staff-web/src/middleware.ts:91-96` queries the staff table
on every HTTP request to verify the user is active. With 500 concurrent
users navigating, this is thousands of unnecessary queries per minute.

**Files to create:**
- `supabase/migrations/YYYYMMDD_jwt_custom_claims.sql`

**Files to change:**
- `apps/staff-web/src/middleware.ts`

**Plan:**

Step 1 — Create a Supabase auth hook that injects custom claims into the JWT:

```sql
-- Function called by Supabase Auth on token generation
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
  v_staff RECORD;
  claims JSONB;
BEGIN
  SELECT id, tenant_id, role, status
  INTO v_staff
  FROM staff
  WHERE user_id = (event->>'user_id')::UUID
    AND status = 'active'
  LIMIT 1;

  claims := event->'claims';

  IF v_staff IS NOT NULL THEN
    claims := jsonb_set(claims, '{staff_id}', to_jsonb(v_staff.id));
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_staff.tenant_id));
    claims := jsonb_set(claims, '{role}', to_jsonb(v_staff.role));
    claims := jsonb_set(claims, '{is_active}', 'true'::jsonb);
  ELSE
    claims := jsonb_set(claims, '{is_active}', 'false'::jsonb);
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$ LANGUAGE plpgsql;
```

Step 2 — Enable the hook in Supabase Dashboard > Auth > Hooks.

Step 3 — Update middleware to read claims from the JWT instead of querying:

```typescript
// BEFORE:
const { data: staff } = await supabase
  .from('staff')
  .select('id, tenant_id, role, status')
  .eq('user_id', user.id)
  .single();

// AFTER:
const claims = user.app_metadata;
if (!claims?.is_active) {
  return NextResponse.redirect(loginUrl);
}
// claims.tenant_id, claims.role, claims.staff_id are available
```

Step 4 — Force token refresh when staff role/status changes (call
`supabase.auth.refreshSession()` from the admin action that modifies staff).

**Verification:**
- Login works, middleware no longer queries staff table
- Deactivating a staff member prevents access after token refresh
- Role change reflected in JWT after refresh

---

### SCALE-9: Connection pooling and statement timeouts

**Problem:** 100 tenants with concurrent API calls + realtime + middleware
queries will exhaust the PostgreSQL connection pool. One slow query from
tenant A can block tenant B.

**Files to change:**
- Supabase Dashboard configuration (not code)
- `supabase/migrations/YYYYMMDD_statement_timeouts.sql`

**Plan:**

Step 1 — Configure PgBouncer for transaction mode (Supabase Dashboard >
Database > Connection Pooling). This is critical — session mode holds
connections open for the entire session.

Step 2 — Add statement timeout as a safety net:

```sql
-- Prevent any single query from running more than 10 seconds
ALTER DATABASE postgres SET statement_timeout = '10s';

-- Tighter timeout for the anon role (customer-facing)
ALTER ROLE anon SET statement_timeout = '5s';
```

Step 3 — Monitor connection usage:

```sql
-- Add to a health check or monitoring query
SELECT count(*) as active_connections,
       state,
       usename
FROM pg_stat_activity
GROUP BY state, usename;
```

Step 4 — Ensure all app code uses the pooled connection string (port 6543),
not the direct connection string (port 5432). Check `.env` files.

**Verification:**
- `pg_stat_activity` shows connections being reused
- A slow query gets killed after 10s instead of blocking the pool
- Normal operations complete well under the timeout

---

### SCALE-10: HTTP and edge caching (Issue #9)

**Problem:** No caching layer beyond React Query. Every request hits Supabase
directly. Menu items, categories, and cafe settings rarely change but are
fetched on every page load across all users.

**Files to change:**
- `apps/staff-web/src/app/providers.tsx` (React Query defaults)
- `apps/customer-web/src/app/providers.tsx` (or equivalent)
- API route handlers (add Cache-Control headers)

**Plan:**

Step 1 — Tune React Query stale times by data type:

```typescript
// Static data — rarely changes
useQuery({ queryKey: ['categories'], staleTime: 10 * 60 * 1000 }); // 10 min
useQuery({ queryKey: ['menu-items'], staleTime: 5 * 60 * 1000 });  // 5 min
useQuery({ queryKey: ['cafe-settings'], staleTime: 15 * 60 * 1000 }); // 15 min

// Dynamic data — keep current defaults
useQuery({ queryKey: ['orders'], staleTime: 60 * 1000 }); // 1 min (already set)
```

Step 2 — Add Cache-Control headers to customer-facing API routes:

```typescript
// Menu data (changes rarely)
response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600');

// Order data (changes constantly)
response.headers.set('Cache-Control', 'private, no-cache');
```

Step 3 — Invalidate caches proactively via Realtime subscriptions (already
partially in place via `useRealtimeSync`).

**Verification:**
- Browser DevTools shows Cache-Control headers on responses
- Menu page doesn't refetch on every navigation
- Cafe settings survive page refreshes from cache

---

## Phase 5: Resilience

At 100 cafes, things WILL go wrong. The app needs to handle failures
gracefully instead of just breaking.

### SCALE-11: Notification subscription fallback (Issue #10)

**Problem:** `apps/staff-web/src/components/providers/notification-provider.tsx:182-184`
has three realtime subscriptions with no error recovery. If WebSocket drops,
staff stop getting audio alerts for new orders. Unlike data queries (which
fall back to polling via `useRealtimeSync`), notifications have no fallback.

**Files to change:**
- `apps/staff-web/src/components/providers/notification-provider.tsx`

**Plan:**

Step 1 — Add error recovery matching the pattern in `useRealtimeSync`:

```typescript
.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    retryCount.current = 0;
  }
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    Sentry.captureMessage(`Notification channel ${channelName}: ${status}`);
    if (retryCount.current < MAX_RETRIES) {
      retryCount.current++;
      const delay = Math.min(1000 * 2 ** retryCount.current, 30000);
      setTimeout(() => {
        supabase.removeChannel(channel);
        // Re-subscribe
        setupChannel();
      }, delay);
    } else {
      // Fallback: poll for recent notifications every 2 minutes
      startNotificationPolling();
    }
  }
});
```

Step 2 — Add a visual indicator when realtime is disconnected:

```typescript
// Show a small banner: "Live updates paused — checking periodically"
const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);
```

Step 3 — Implement `startNotificationPolling()` that queries recent
waiter_calls and orders every 2 minutes and plays sounds for new ones.

**Verification:**
- Block WebSocket in DevTools Network tab
- Verify banner appears after retry exhaustion
- Verify polling picks up new orders (with sound)
- Reconnect — verify banner disappears and realtime resumes

---

### SCALE-12: Circuit breaker and connection status (Issue #11)

**Problem:** No global "we're having trouble connecting" state. Each component
independently errors. If Supabase goes down, the entire app shows scattered
error states with no unified recovery.

**Files to create:**
- `apps/staff-web/src/components/providers/connection-provider.tsx`

**Files to change:**
- `apps/staff-web/src/app/providers.tsx` (wrap with connection provider)

**Plan:**

Step 1 — Create a connection health provider:

```typescript
// Track consecutive API failures
const ConnectionProvider = ({ children }) => {
  const [status, setStatus] = useState<'connected' | 'degraded' | 'disconnected'>('connected');
  const failureCount = useRef(0);

  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.type === 'updated' && event.query.state.status === 'error') {
        failureCount.current++;
        if (failureCount.current >= 5) setStatus('disconnected');
        else if (failureCount.current >= 3) setStatus('degraded');
      }
      if (event?.type === 'updated' && event.query.state.status === 'success') {
        failureCount.current = Math.max(0, failureCount.current - 1);
        if (failureCount.current === 0) setStatus('connected');
      }
    });
    return unsubscribe;
  }, []);

  return (
    <ConnectionContext.Provider value={status}>
      {status !== 'connected' && <ConnectionBanner status={status} />}
      {children}
    </ConnectionContext.Provider>
  );
};
```

Step 2 — Show a persistent banner when degraded/disconnected:
- Degraded: "Some features may be slow. Retrying..."
- Disconnected: "Connection lost. Working offline. Changes will sync when reconnected."

Step 3 — When disconnected, disable mutation buttons (prevent data loss from
failed writes).

**Verification:**
- Stop Supabase locally, verify banner appears after a few failed queries
- Restart Supabase, verify banner disappears
- Mutation buttons are disabled while disconnected

---

## Phase 6: Frontend Architecture & Test Quality

These are important but lower urgency — they improve long-term maintainability,
not immediate reliability.

### SCALE-13: SSR for key pages (Issue #5)

**Problem:** 31 of 34 pages use `'use client'`. All data fetching happens in
client components. This means larger JS bundles, slower first paint, and no
SEO for customer-web.

**Why last:** This is the largest refactor. It's only worth doing after the
data layer is fixed (Phases 1-2). SSR without server-side aggregation just
moves the same bad queries to the server.

**Files to change:**
- `apps/customer-web/src/app/` pages (priority — public-facing)
- `apps/staff-web/src/app/(staff)/` pages (lower priority — internal tool)

**Plan:**

Step 1 — Start with customer-web (public-facing, benefits most from SSR):
- `/menu/[tenantId]/[tableId]` — SSR the menu with server-side data fetching
- `/order/[orderId]` — SSR the order status page

```typescript
// BEFORE (client component):
'use client';
export default function MenuPage() {
  const { data: menu } = useMenuItems();
  // ...
}

// AFTER (server component with client islands):
export default async function MenuPage({ params }) {
  const supabase = createServerClient();
  const menu = await supabase.rpc('get_menu_for_table', {
    p_tenant_id: params.tenantId,
    p_table_id: params.tableId,
  });

  return <MenuScreen initialData={menu} />;
}
```

Step 2 — For staff-web, convert read-heavy pages that don't need realtime
on first render:
- `/reports` — server-rendered with aggregated data (from SCALE-1)
- `/menu` — server-rendered menu list, client-side editing
- `/staff` — server-rendered staff list

Step 3 — Keep realtime-heavy pages as client components:
- `/orders` — needs live updates
- `/tables` — needs live updates
- Dashboard — needs live updates

**Verification:**
- Customer-web menu page renders without JavaScript (check with JS disabled)
- Lighthouse score improves (FCP, LCP)
- `pnpm build` succeeds with no hydration mismatch warnings

---

### SCALE-14: Real E2E tests (Issue #6)

**Status (2026-05-02): ✅ shipped.** All seven `*.spec.ts` files now exist
under `apps/staff-web/e2e/` and `apps/customer-web/e2e/` with real
assertions, plus a `fixtures.ts` helper. CI runs both Playwright suites
in `.github/workflows/ci.yml`. Closed by f25a30f, de8314c, 4293206,
b6464f2, ab792dd.

**Problem:** Current e2e tests assert `page.locator('body').toBeVisible()`.
They pass even if the app is completely broken. No actual user flows are
tested.

**Files to change:**
- `apps/staff-web/e2e/order-lifecycle.spec.ts`
- `apps/staff-web/e2e/orders.spec.ts`
- `apps/customer-web/e2e/order-flow.spec.ts`

**Plan:**

Step 1 — Write a full order lifecycle e2e test:

```typescript
test('complete order flow: create -> prepare -> ready -> serve -> pay -> close', async ({ page }) => {
  // Login as waiter
  await page.goto('/login');
  await page.fill('[name=email]', 'admin@test.com');
  await page.fill('[name=password]', 'test1234');
  await page.click('button[type=submit]');
  await page.waitForURL('/orders');

  // Create order for table 1
  await page.click('[data-testid="new-order"]');
  await page.click('[data-testid="table-1"]');
  await page.click('[data-testid="menu-item-0"]'); // Add first menu item
  await page.click('[data-testid="submit-order"]');

  // Verify order appears
  await expect(page.locator('[data-testid="order-status"]')).toHaveText('pending_approval');

  // Approve and prepare
  await page.click('[data-testid="approve-order"]');
  await expect(page.locator('[data-testid="order-status"]')).toHaveText('new');

  // ... continue through full lifecycle
  // Process payment
  await page.click('[data-testid="process-payment"]');
  await page.fill('[data-testid="payment-amount"]', '25.00');
  await page.click('[data-testid="confirm-payment"]');

  // Verify order closed
  await expect(page.locator('[data-testid="order-status"]')).toHaveText('closed');
});
```

Step 2 — Write customer-web order flow test (QR code → menu → cart → order).

Step 3 — Write payment edge case tests (split, partial, refund).

Step 4 — Add `data-testid` attributes to components as needed (don't use
CSS selectors for e2e tests — they break on style changes).

**Verification:**
- Tests fail when real bugs are introduced (intentionally break something)
- Tests pass in CI against local Supabase
- Each test cleans up its data (use per-test transactions or API cleanup)

---

### SCALE-15: Fix `as any` in tests (Issue #7)

**Problem:** 250+ `as any` casts in test files. Tests don't validate types,
and refactors can silently break test contracts.

**Files to change:**
- `packages/api-client/src/__tests__/` (all test files)
- `apps/customer-web/src/__tests__/` (all test files)
- `apps/staff-web/src/__tests__/` (all test files)

**Plan:**

Step 1 — Create properly typed test factories:

```typescript
// packages/api-client/src/__tests__/helpers/factories.ts
import type { Order, OrderItem, Staff } from '@gustri/database';

export function buildOrder(overrides?: Partial<Order>): Order {
  return {
    id: crypto.randomUUID(),
    tenant_id: 'test-tenant-id',
    status: 'new',
    order_type: 'dine_in',
    total: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
```

Step 2 — Create a typed mock Supabase builder:

```typescript
// Replace `return client as any` with a properly typed mock
export function createTypedMockClient(): MockSupabaseClient {
  // ... return object matching SupabaseClient interface
}
```

Step 3 — Replace `as any` usage file by file, starting with the most-changed
test files (orders, payments, staff).

**Verification:**
- `pnpm type-check` passes
- `pnpm test` passes
- Intentionally rename a field in a type — tests that use factories should
  fail at compile time, not silently pass

---

### SCALE-16: Align React versions (Issue #8)

**Problem:** Web apps use React 18, mobile uses React 19. Shared packages
serve both. This will eventually cause incompatible API usage.

**Files to change:**
- `apps/mobile/package.json`
- `packages/ui/package.json` (peer dep range)

**Plan:**

Step 1 — Determine target: stay on React 18 or upgrade everything to 19.

Recommendation: **Stay on React 18** until Next.js 15 migration. React 19
in mobile is premature and adds risk.

Step 2 — Pin mobile to React 18:

```json
// apps/mobile/package.json
"react": "^18.3.0",
"react-native": "0.74.x"
```

Verify React Native 0.74 supports React 18 (it does).

Step 3 — Set peer dependency range in shared packages:

```json
// packages/ui/package.json
"peerDependencies": {
  "react": "^18.0.0"
}
```

**Verification:**
- `pnpm install` succeeds with no peer dep warnings
- Mobile app builds and runs
- Web apps build and run

---

## Phase 7: Hardening & Operational

These items won't crash the app, but they represent security gaps, missing
observability, and operational debt that compounds over time. Address after
Phases 1-6 or interleave as time allows.

### SCALE-17: Remove CSP `unsafe-inline` for scripts

**Status (2026-05-02): ✅ shipped (no nonce needed).** Both apps' CSP
headers now use `script-src 'self'` with no `'unsafe-inline'` (see
`apps/staff-web/next.config.js:59` and customer-web's nonce-based
middleware from commit 6444b1c). `style-src` retains `'unsafe-inline'`
intentionally — Tailwind/inline styles require it; tracked separately.

**Problem:** Both apps set `script-src 'self' 'unsafe-inline'` in their CSP
header. This weakens XSS protection — if an attacker injects HTML, inline
scripts will execute.

- `apps/staff-web/next.config.js:49-50`
- `apps/customer-web/next.config.js:49-50`

**Files to change:**
- `apps/staff-web/next.config.js`
- `apps/customer-web/next.config.js`

**Plan:**

Step 1 — Audit all inline scripts in both apps. Search for `<script>` tags
in components and `dangerouslySetInnerHTML` usage.

Step 2 — Move any inline scripts to external files or use Next.js `<Script>`
component with `strategy="afterInteractive"`.

Step 3 — Replace `'unsafe-inline'` with nonce-based CSP:

```javascript
// next.config.js
{
  key: 'Content-Security-Policy',
  value: "script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline';"
}
```

Note: `style-src 'unsafe-inline'` is acceptable — Tailwind CSS requires it.
The priority is removing it from `script-src`.

Step 4 — If nonce-based CSP is too complex for now, at minimum add
`'strict-dynamic'` which is safer than bare `'unsafe-inline'`.

**Verification:**
- No inline scripts break after the change
- Browser console shows no CSP violations on normal navigation
- Intentionally inject `<img onerror="alert(1)">` — verify it's blocked

---

### SCALE-18: Add error boundaries to remaining pages

**Status (2026-05-02): ✅ shipped.** Closed by PR #78. Added
`error.tsx` re-exports for `reports`, `menu`, `delivery`, `settings`
under `apps/staff-web/src/app/(staff)/`, all pointing at the existing
shared `@/components/ui/page-error` component used by `cafe-settings`,
`feedback`, `schedules`, `staff`.

**Problem:** Four staff-web pages have no section-level error boundary. They
rely on the global `(staff)/error.tsx` which replaces the entire page layout.
A query failure in feedback shouldn't blow away the entire navigation.

Missing `error.tsx` in:
- `apps/staff-web/src/app/(staff)/feedback/`
- `apps/staff-web/src/app/(staff)/schedules/`
- `apps/staff-web/src/app/(staff)/cafe-settings/`
- `apps/staff-web/src/app/(staff)/staff/`

**Files to create:**
- `apps/staff-web/src/app/(staff)/feedback/error.tsx`
- `apps/staff-web/src/app/(staff)/schedules/error.tsx`
- `apps/staff-web/src/app/(staff)/cafe-settings/error.tsx`
- `apps/staff-web/src/app/(staff)/staff/error.tsx`

**Plan:**

Step 1 — Create a reusable error component:

```typescript
// apps/staff-web/src/components/ui/page-error.tsx
'use client';

export function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground mt-2">{error.message}</p>
      <button onClick={reset} className="mt-4 btn btn-primary">
        Try again
      </button>
    </div>
  );
}
```

Step 2 — Create `error.tsx` in each directory, re-exporting PageError:

```typescript
'use client';
export { PageError as default } from '@/components/ui/page-error';
```

**Verification:**
- Temporarily throw an error in each page's data hook
- Verify the error UI renders within the page layout (sidebar stays visible)
- Verify "Try again" button re-fetches data

---

### SCALE-19: Fix discount trigger race condition

**Problem:** `packages/api-client/src/wrapper/orders.ts:371-394` —
`applyDiscount()` deliberately avoids `.select().single()` because the
database trigger `recalculate_on_discount_change` updates the same row,
causing a PostgREST "Cannot coerce" error. This means:
- No immediate feedback on discount success
- UI must manually refetch
- Window where stale discount data is displayed

**Files to change:**
- `packages/api-client/src/wrapper/orders.ts` (applyDiscount method)
- Potentially `supabase/migrations/` (if trigger needs adjustment)

**Plan:**

Step 1 — Refetch the order after discount application instead of relying
on the update response:

```typescript
async applyDiscount(orderId: string, params: DiscountParams) {
  const { error } = await ctx.anyClient
    .from('orders')
    .update({
      discount_type: params.discount_type,
      discount_value: params.discount_value,
      discount_reason: params.discount_reason,
      discount_applied_by: params.discount_applied_by,
    })
    .eq('id', orderId);

  if (error) throw handleSupabaseError(error);

  // Wait briefly for trigger to complete, then fetch fresh data
  const { data: updated, error: fetchError } = await ctx.anyClient
    .from('orders_decrypted')
    .select('*')
    .eq('id', orderId)
    .single();

  if (fetchError) throw handleSupabaseError(fetchError);
  return updated;
}
```

Step 2 — Update the mutation hook to use the returned data for optimistic
update instead of requiring a separate `invalidateQueries`.

**Verification:**
- Apply discount — UI updates immediately with correct total
- No "Cannot coerce" errors in logs
- Discount + recalculated total are consistent

---

### SCALE-20: Reduce trigger contention on orders table

**Problem:** The orders table has 6+ triggers that fire on various operations:
- `set_order_number_trigger` (BEFORE INSERT)
- `update_orders_updated_at` (BEFORE UPDATE)
- `recalculate_on_item_insert/update/delete` (AFTER on order_items)
- `update_table_on_order` (AFTER INSERT/UPDATE)
- `recalculate_on_discount_change` (AFTER UPDATE)
- `cascade_order_status_to_items` (potential, from baseline)
- Plus the new `sync_order_status_from_items` from SCALE-3

At 5K orders/day, trigger cascades on hot rows (active orders being updated
frequently) can cause lock contention and slow writes.

**Files to change:**
- `supabase/migrations/` — new migration to consolidate triggers

**Plan:**

Step 1 — Audit which triggers fire on each operation. Map out the cascade:
- Item status update → recalculate total → update order updated_at →
  sync order status → cascade to items → ...

Step 2 — Consolidate related triggers into a single function where possible:

```sql
-- Instead of 3 separate triggers on order_items changes,
-- combine into one:
CREATE OR REPLACE FUNCTION handle_order_item_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate total
  PERFORM recalculate_order_total(COALESCE(NEW.order_id, OLD.order_id));
  -- Sync order status
  PERFORM sync_order_status(COALESCE(NEW.order_id, OLD.order_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

Step 3 — Add `pg_stat_user_tables` monitoring to track trigger execution
time per table:

```sql
SELECT relname, n_tup_ins, n_tup_upd, n_tup_del
FROM pg_stat_user_tables
WHERE relname = 'orders';
```

Step 4 — If contention is measured (not just theoretical), consider moving
total recalculation to an async job instead of a synchronous trigger.

**Verification:**
- Run a load test: 100 concurrent order item updates
- Measure avg write latency before and after consolidation
- Verify no deadlocks in `pg_locks` during concurrent updates

---

### SCALE-21: Server-side file upload validation

**Status (2026-05-02): ✅ shipped (Option C — client validator + RLS
tightening).** Closed by PR #80. Premise was partly stale — uploads are
client-side via Supabase Storage SDK, not via a `/api/v1/uploads/*`
route. Added a shared `validateImageFile` helper at
`apps/staff-web/src/lib/uploads/validate-image.ts` (size cap, MIME
allowlist of jpeg/png/webp only, magic-byte check on first 12 bytes)
wired into both call sites (`image-upload.tsx`, `menu-item-modal.tsx`).
Migration `20260502000002_drop_svg_from_branding_uploads.sql` removed
SVG from the branding bucket RLS allowlist. Residual gap (a tenant
owner uploading non-image bytes claiming a valid mime type) is
bounded by Storage RLS path-scoping to their own tenant — not an
attack on others. A full server-route fix is filed under future work
if customer-web ever accepts uploads.

**Problem:** Image upload validation (file type, file size) only happens in
the browser (`apps/staff-web/src/components/settings/image-upload.tsx:44-54`).
A malicious user can bypass client-side checks and upload arbitrary files
directly to the Supabase Storage API using the anon key.

**Files to change:**
- Supabase Storage bucket configuration (Dashboard or config)
- Optionally: create an API route for upload proxying

**Plan:**

Step 1 — Configure Supabase Storage policies to restrict uploads:

```sql
-- Only allow image MIME types in menu-images bucket
CREATE POLICY "Only images in menu-images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND (storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp'))
  );

-- Enforce max file size (5MB) via Supabase Dashboard:
-- Storage > menu-images > Policies > File size limit: 5242880
```

Step 2 — Alternatively, proxy uploads through a staff-web API route that
validates server-side before forwarding to storage:

```typescript
// apps/staff-web/src/app/api/v1/upload/route.ts
export async function POST(request: NextRequest) {
  const { staff } = await verifyStaff(request);
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large' }, { status: 413 });
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 415 });
  }

  // Upload using service role (server-side)
  const { data, error } = await adminClient.storage
    .from('menu-images')
    .upload(generateFilename(file.name), file);

  // ...
}
```

**Verification:**
- Try uploading a `.html` file renamed to `.jpg` — should be rejected
- Try uploading a 10MB file via curl directly to storage API — should be rejected
- Normal image upload from UI still works

---

### SCALE-22: Add Sentry to mobile app

**Problem:** Staff-web and customer-web both have `@sentry/nextjs` for error
tracking. The mobile app has no Sentry integration. Crashes and errors in
the mobile app are invisible.

**Files to change:**
- `apps/mobile/package.json` (add dependency)
- `apps/mobile/app.config.ts` or `app.json` (Sentry plugin config)
- `apps/mobile/src/app/_layout.tsx` (or root layout — initialize Sentry)

**Plan:**

Step 1 — Install Sentry for Expo:

```bash
cd apps/mobile && pnpm add @sentry/react-native
```

Step 2 — Initialize in root layout:

```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: 0.2,
});
```

Step 3 — Wrap the root component:

```typescript
export default Sentry.wrap(RootLayout);
```

Step 4 — Add `EXPO_PUBLIC_SENTRY_DSN` to `.env.example` and CI secrets.

**Verification:**
- Throw a test error in mobile — verify it appears in Sentry dashboard
- Verify source maps upload for readable stack traces
- Verify no performance impact in dev mode

---

### SCALE-23: CI coverage thresholds and bundle analysis

**Problem:** CI runs `pnpm test` but not `pnpm test:coverage`. Coverage can
silently regress. There's also no bundle size tracking — a single bad import
can add 500KB to the client bundle and nobody notices.

**Files to change:**
- `.github/workflows/ci.yml`
- Root `package.json` (add bundle analysis script)
- `apps/staff-web/package.json` (add bundle analyzer)
- `apps/customer-web/package.json` (add bundle analyzer)

**Plan:**

Step 1 — Switch CI test step to coverage mode with threshold:

```yaml
- name: Run tests with coverage
  run: pnpm test:coverage

- name: Check coverage thresholds
  run: |
    # Fail if coverage drops below thresholds
    # Configure in vitest.config.ts:
    # coverage: { thresholds: { lines: 60, branches: 50, functions: 55 } }
    echo "Coverage report generated"
```

Step 2 — Add coverage thresholds to `vitest.config.ts`:

```typescript
coverage: {
  provider: 'v8',
  thresholds: {
    lines: 60,    // Start realistic, increase over time
    branches: 50,
    functions: 55,
    statements: 60,
  },
}
```

Step 3 — Add bundle size tracking:

```bash
pnpm add -Dw @next/bundle-analyzer
```

Add a CI step that builds and reports bundle sizes:

```yaml
- name: Bundle size check
  run: |
    ANALYZE=true pnpm build --filter=@gustri/staff-web --filter=@gustri/customer-web
    # Output bundle sizes for PR comment
```

Step 4 — Optionally integrate with a GitHub Action that comments bundle
sizes on PRs (e.g., `preactjs/compressed-size-action`).

**Verification:**
- Intentionally lower coverage — CI fails
- Add a large unused import — bundle size increases visibly in CI output
- Normal PR workflow unaffected

---

### SCALE-24: Image optimization pipeline

**Problem:** Uploaded images are served as-is from Supabase Storage. No WebP
conversion, no resizing, no responsive images. A 4MB DSLR photo of a menu
item will be served to every customer on mobile.

**Files to change:**
- `apps/staff-web/src/components/settings/image-upload.tsx`
- Customer-web components that render menu item images

**Plan:**

Step 1 — Add client-side image compression before upload:

```bash
pnpm add browser-image-compression --filter=@gustri/staff-web
```

```typescript
import imageCompression from 'browser-image-compression';

async function handleFile(file: File) {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.5,         // Max 500KB
    maxWidthOrHeight: 1200,  // Max 1200px
    useWebWorker: true,
    fileType: 'image/webp',  // Convert to WebP
  });
  // Upload compressed file
}
```

Step 2 — Use Next.js `<Image>` component in customer-web for automatic
responsive sizing and lazy loading:

```typescript
<Image
  src={menuItem.image_url}
  alt={menuItem.name}
  width={400}
  height={300}
  sizes="(max-width: 768px) 100vw, 400px"
  loading="lazy"
/>
```

Step 3 — Configure Next.js image optimization to use Supabase storage domain:

```javascript
// next.config.js
images: {
  remotePatterns: [
    { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/**' },
  ],
}
```

**Verification:**
- Upload a 3MB JPEG — stored as ~400KB WebP
- Customer-web menu page serves responsive images (check DevTools)
- Lighthouse image audit passes

---

### SCALE-25: Data retention and archival

**Problem:** No data retention policy. Orders, audit logs, and customer PII
accumulate indefinitely. At 1.8M orders/year, the orders table will grow
to 10M+ rows within 5 years. Also relevant for GDPR/KVKK compliance.

**Files to create:**
- `supabase/migrations/YYYYMMDD_data_retention.sql`

**Plan:**

Step 1 — Define retention periods (confirm with business stakeholders):

| Data | Retention | Action |
|------|-----------|--------|
| Orders (closed/cancelled) | 24 months | Archive to cold table |
| Order items (of archived orders) | 24 months | Archive with orders |
| Customer PII (delivery names/phones) | 12 months | Anonymize |
| Financial audit log | 7 years | Keep (legal requirement) |
| Waste logs | 24 months | Delete |
| Waiter calls | 6 months | Delete |
| Customer feedback | 24 months | Anonymize |

Step 2 — Create an archive schema and retention function:

```sql
CREATE SCHEMA IF NOT EXISTS archive;

CREATE TABLE archive.orders (LIKE public.orders INCLUDING ALL);

CREATE OR REPLACE FUNCTION run_data_retention()
RETURNS void AS $$
BEGIN
  -- Move old closed orders to archive
  WITH moved AS (
    DELETE FROM public.orders
    WHERE status IN ('closed', 'cancelled')
      AND created_at < NOW() - INTERVAL '24 months'
    RETURNING *
  )
  INSERT INTO archive.orders SELECT * FROM moved;

  -- Anonymize old delivery customer PII
  UPDATE orders
  SET customer_name = 'REDACTED',
      customer_phone = 'REDACTED',
      delivery_address = 'REDACTED'
  WHERE order_type = 'delivery'
    AND created_at < NOW() - INTERVAL '12 months'
    AND customer_name != 'REDACTED';

  -- Delete old waiter calls
  DELETE FROM waiter_calls
  WHERE created_at < NOW() - INTERVAL '6 months';

  -- Delete old waste logs
  DELETE FROM waste_logs
  WHERE created_at < NOW() - INTERVAL '24 months';
END;
$$ LANGUAGE plpgsql;
```

Step 3 — Schedule the function to run weekly via Supabase pg_cron:

```sql
SELECT cron.schedule(
  'data-retention',
  '0 3 * * 0', -- Every Sunday at 3 AM
  $$ SELECT run_data_retention(); $$
);
```

Step 4 — Add an admin API endpoint to trigger manual retention runs and
view retention stats.

**Verification:**
- Insert test data older than retention period
- Run `SELECT run_data_retention();` manually
- Verify data moved to archive / anonymized / deleted
- Verify recent data is untouched

---

### SCALE-26: Database monitoring with pg_stat_statements

**Problem:** No visibility into query performance. Slow queries won't be
detected until users complain. At 100 tenants, one badly indexed query
pattern from a single tenant can degrade the entire database.

**Files to change:**
- Supabase Dashboard configuration
- Optionally: health check API route

**Plan:**

Step 1 — Enable `pg_stat_statements` extension:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

Step 2 — Create a monitoring query for the health check:

```sql
-- Top 10 slowest queries
SELECT
  calls,
  round(total_exec_time::numeric, 2) as total_ms,
  round(mean_exec_time::numeric, 2) as avg_ms,
  round(max_exec_time::numeric, 2) as max_ms,
  left(query, 100) as query_preview
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

Step 3 — Add a protected admin endpoint that surfaces this data:

```typescript
// apps/staff-web/src/app/api/v1/admin/db-stats/route.ts
export async function GET(request: NextRequest) {
  const { staff } = await verifyAdmin(request);
  const { data } = await adminClient.rpc('get_slow_queries');
  return NextResponse.json(data);
}
```

Step 4 — Set up Sentry performance monitoring to track API route latencies.
Alert when p95 exceeds 2s.

**Verification:**
- Query `pg_stat_statements` — populated with real query data
- Admin endpoint returns query stats
- Sentry performance dashboard shows API latency distribution

---

### SCALE-27: Feature flags via cafe_settings

**Problem:** No way to enable/disable features per tenant or environment.
Rolling out a risky feature (new payment flow, delivery changes) is
all-or-nothing across all 100 cafes.

**Files to change:**
- `supabase/migrations/` — add feature flags columns to cafe_settings
- `packages/api-client/src/wrapper/settings.ts`
- `apps/staff-web/src/hooks/` (or equivalent settings hook)

**Plan:**

Step 1 — Add a JSONB feature flags column to cafe_settings:

```sql
ALTER TABLE cafe_settings
ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN cafe_settings.feature_flags IS
'Per-tenant feature toggles. Keys: feature name, values: boolean or config object.';
```

Step 2 — Create a helper function and hook:

```typescript
// packages/queries/src/hooks/use-feature-flag.ts
export function useFeatureFlag(flag: string): boolean {
  const { data: settings } = useCafeSettings();
  return settings?.feature_flags?.[flag] === true;
}

// Usage in components:
const deliveryEnabled = useFeatureFlag('delivery_v2');
if (!deliveryEnabled) return <OldDeliveryFlow />;
return <NewDeliveryFlow />;
```

Step 3 — Add an admin UI to toggle flags per cafe in the cafe-settings page.

Step 4 — Support environment-level defaults via env var:

```typescript
const GLOBAL_FLAGS = JSON.parse(process.env.FEATURE_FLAGS || '{}');
// Tenant flags override global defaults
const effectiveFlags = { ...GLOBAL_FLAGS, ...settings.feature_flags };
```

**Verification:**
- Set `delivery_v2: true` for one cafe — only that cafe sees new flow
- Set via env var — all cafes see it unless overridden
- Toggle off — feature disappears immediately (no deploy needed)

---

### SCALE-28: Remote push notifications for mobile (FCM/APNs)

**Problem:** The mobile app only uses local notifications triggered by
Realtime WebSocket events (`apps/mobile/src/lib/notifications.ts`). When the
app is backgrounded or killed, no notifications are received. A waiter won't
know about new orders or waiter calls unless the app is in the foreground.
At 100 cafes, this is a core reliability gap — staff rely on audio alerts.

**Files to change:**
- `apps/mobile/src/lib/notifications.ts`
- `apps/mobile/app.json` (FCM/APNs config)
- Supabase: Database webhook or Edge Function for push delivery

**Plan:**

Step 1 — Set up Expo push notifications with EAS:

```typescript
// Already partially set up in notifications.ts lines 16-67
// registerForPushNotifications() gets an Expo push token
// BUT the token is never sent to the server
```

After getting the push token, store it in the staff record:

```typescript
const token = (await Notifications.getExpoPushTokenAsync()).data;
await db.staff.update(staffId, { push_token: token });
```

Step 2 — Add `push_token` column to staff table:

```sql
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS push_token TEXT;
```

Step 3 — Create a Supabase Database Webhook or Edge Function that fires
on order/waiter_call INSERT and sends push notifications to relevant staff:

```typescript
// Supabase Edge Function: send-push-notification
const staff = await supabase
  .from('staff')
  .select('push_token')
  .eq('tenant_id', order.tenant_id)
  .not('push_token', 'is', null);

await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  body: JSON.stringify(staff.map(s => ({
    to: s.push_token,
    title: 'New Order',
    body: `Order #${order.order_number}`,
    data: { orderId: order.id },
  }))),
});
```

Step 4 — For production at scale, consider migrating from Expo Push to
direct FCM/APNs for better reliability and delivery guarantees.

**Verification:**
- Background the app, create an order → push notification appears
- Kill the app, create a waiter call → push notification appears
- Tap notification → app opens to relevant screen

---

### SCALE-29: Mobile offline cache size management

**Problem:** The mobile app uses AsyncStorage for React Query persistence
(`apps/mobile/src/lib/query-persister.ts`) with 24-hour GC time. AsyncStorage
has a ~6MB limit on some Android devices. At 50 orders/day, the cached order
data (with order_items, menu_items) can grow to several MB within days,
causing silent cache failures.

**Files to change:**
- `apps/mobile/src/lib/query-persister.ts`
- `apps/mobile/App.tsx` (gcTime configuration)

**Plan:**

Step 1 — Reduce `OFFLINE_GC_TIME` from 24 hours to 4 hours for volatile data:

```typescript
// App.tsx — current: gcTime: 24 * 60 * 60 * 1000
// Change to: shorter gcTime for large datasets
gcTime: 4 * 60 * 60 * 1000, // 4 hours
```

Step 2 — Add cache size monitoring:

```typescript
// query-persister.ts
async function getCacheSize(): Promise<number> {
  const keys = await AsyncStorage.getAllKeys();
  const queryKeys = keys.filter(k => k.startsWith('REACT_QUERY'));
  let totalSize = 0;
  for (const key of queryKeys) {
    const value = await AsyncStorage.getItem(key);
    totalSize += value?.length ?? 0;
  }
  return totalSize;
}
```

Step 3 — Consider migrating from AsyncStorage to MMKV for better
performance and no size limits:

```bash
pnpm add react-native-mmkv --filter=@gustri/mobile
```

MMKV is synchronous, has no size limit, and is 30x faster than AsyncStorage.

**Verification:**
- Run the app for 24h with simulated orders → no AsyncStorage errors
- Check cache size stays under 4MB
- Offline mode still works after cache reduction

---

### SCALE-30: Mobile sound cleanup memory leak

**Problem:** `apps/mobile/src/lib/sound.ts` exports `cleanupSounds()` but
it's never called. Audio objects persist in memory for the entire app
lifecycle. On low-memory Android devices with long sessions, this can cause
the app to be killed by the OS.

**Files to change:**
- `apps/mobile/App.tsx` (or root component)
- `apps/mobile/src/lib/sound.ts`

**Plan:**

Step 1 — Call `cleanupSounds()` on app background/unmount:

```typescript
// App.tsx — add AppState listener
import { AppState } from 'react-native';

useEffect(() => {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'background') {
      cleanupSounds();
    }
  });
  return () => subscription.remove();
}, []);
```

Step 2 — Reload sounds when app returns to foreground:

```typescript
if (state === 'active') {
  setupSounds();
}
```

**Verification:**
- Background app → sounds cleaned
- Foreground app → new order sound plays correctly
- No memory growth over extended usage (use React Native performance monitor)

---

### SCALE-31: Mobile Realtime channel cleanup on logout

**Problem:** Realtime channels are created in hooks (`use-orders.ts`,
`use-waiter-calls.ts`) and cleaned up on component unmount. But if a user
logs out while these components are still mounted, the channels may persist
with stale auth credentials, causing ghost subscriptions.

**Files to change:**
- `apps/mobile/src/lib/auth.ts` (logout function)

**Plan:**

Step 1 — Remove all Realtime channels on logout:

```typescript
// auth.ts — logout function
export async function logout() {
  // Clean up all realtime channels before sign out
  const channels = supabase.getChannels();
  for (const channel of channels) {
    await supabase.removeChannel(channel);
  }
  await supabase.auth.signOut();
  useAuthStore.getState().clearAuth();
}
```

Step 2 — Also clean up on auth state change (token expiry):

```typescript
// App.tsx — onAuthStateChange listener
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
    if (event === 'SIGNED_OUT') {
      supabase.getChannels().forEach(ch => supabase.removeChannel(ch));
    }
  }
});
```

**Verification:**
- Login → verify channels created (check `supabase.getChannels().length`)
- Logout → verify channels removed (length === 0)
- Login as different user → verify clean channels for new tenant

---

### SCALE-32: Mobile FlatList to FlashList migration

**Problem:** All list screens use React Native's `FlatList`. At busy
restaurants with 50+ active orders, FlatList's non-recycling architecture
causes jank and memory bloat. `FlashList` from Shopify is a drop-in
replacement with 5-10x better scroll performance.

**Files to change:**
- `apps/mobile/src/screens/orders/OrdersListScreen.tsx`
- `apps/mobile/src/screens/tables/TablesListScreen.tsx`
- `apps/mobile/src/screens/kitchen/KitchenDisplayScreen.tsx`
- `apps/mobile/src/screens/calls/WaiterCallsScreen.tsx`
- Any other screen using `FlatList`

**Plan:**

Step 1 — Install FlashList:

```bash
pnpm add @shopify/flash-list --filter=@gustri/mobile
```

Step 2 — Replace FlatList imports:

```typescript
// BEFORE:
import { FlatList } from 'react-native';

// AFTER:
import { FlashList } from '@shopify/flash-list';
```

Step 3 — Add `estimatedItemSize` prop (required by FlashList):

```typescript
<FlashList
  data={orders}
  renderItem={renderOrder}
  estimatedItemSize={120} // estimate based on order card height
  refreshControl={...}
/>
```

Step 4 — Migrate screen by screen, testing each one for visual parity.

**Verification:**
- Open orders list with 50+ items → smooth scrolling, no jank
- Pull-to-refresh still works
- Memory usage lower than FlatList version (check React Native perf monitor)

---

### SCALE-33: Mobile sync handler Sentry integration

**Problem:** `apps/mobile/src/lib/sync-handler.ts` catches offline mutation
sync failures but only logs to `console.warn` (line 25). At 100 cafes with
waiters on flaky WiFi, sync failures are expected — but invisible without
monitoring.

**Files to change:**
- `apps/mobile/src/lib/sync-handler.ts`

**Plan:**

Step 1 — After SCALE-22 (Sentry setup) is done, add Sentry to sync handler:

```typescript
import * as Sentry from '@sentry/react-native';

export function setupSyncErrorHandler(mutationCache: MutationCache) {
  mutationCache.subscribe((event) => {
    if (event.type === 'updated' && event.mutation.state.status === 'error') {
      const error = event.mutation.state.error;
      Sentry.captureException(error, {
        tags: {
          context: 'offline-sync',
          mutationKey: JSON.stringify(event.mutation.options.mutationKey),
        },
      });
    }
  });
}
```

**Verification:**
- Go offline, trigger a mutation, go online → sync fails → Sentry receives error
- Normal online mutations don't trigger extra Sentry events

---

### SCALE-34: Mobile E2E tests

**Problem:** Mobile app has 22 unit tests but zero E2E tests. Critical
flows (login, order viewing, waiter call) are untested on actual device
interactions.

**Files to create:**
- `apps/mobile/e2e/` directory
- `apps/mobile/maestro/` (if using Maestro) or `apps/mobile/e2e/` (if Detox)

**Plan:**

Step 1 — Choose a framework. Recommendation: **Maestro** — simpler setup
than Detox, better Expo support:

```yaml
# apps/mobile/maestro/login-flow.yaml
appId: com.gustri.mobile
---
- launchApp
- tapOn: "Email"
- inputText: "admin@test.com"
- tapOn: "Password"
- inputText: "test1234"
- tapOn: "Sign In"
- assertVisible: "Dashboard"
```

Step 2 — Write flows for critical paths:
- Login → Dashboard
- View orders → Order detail
- Waiter call → Confirm call sent
- Menu browsing → Item detail

Step 3 — Add to CI (runs on EAS build or separate mobile CI job):

```yaml
- name: Mobile E2E
  run: |
    maestro test apps/mobile/maestro/
```

**Verification:**
- Tests pass locally on simulator
- Tests pass in CI
- Intentionally break login — test fails

---

## Dependency Graph

```
Phase 1 (Data Layer)
  SCALE-1 (reports aggregation) ─────┐
  SCALE-2 (pagination)               ├── Phase 4 (Performance)
                                     │     SCALE-8 (JWT claims)
Phase 2 (Data Integrity)             │     SCALE-9 (connection pooling)
  SCALE-3 (atomic order status)      │     SCALE-10 (caching)
  SCALE-4 (silent failures)          │
  SCALE-5 (mutation error handlers)  ├── Phase 5 (Resilience)
                                     │     SCALE-11 (notification fallback)
Phase 3 (Multi-Tenant)               │     SCALE-12 (circuit breaker)
  SCALE-6 (delivery IDOR)            │
  SCALE-7 (email uniqueness)         └── Phase 6 (Frontend & Tests)
                                           SCALE-13 (SSR) — depends on SCALE-1
                                           SCALE-14 (E2E tests)
                                           SCALE-15 (typed tests)
                                           SCALE-16 (React alignment)

                                     Phase 7 (Hardening & Operational)
                                       SCALE-17 (CSP unsafe-inline)
                                       SCALE-18 (error boundaries)
                                       SCALE-19 (discount race condition)
                                       SCALE-20 (trigger contention)
                                       SCALE-21 (server-side upload validation)
                                       SCALE-22 (mobile Sentry) ──► SCALE-33 (sync Sentry)
                                       SCALE-23 (CI coverage + bundle analysis)
                                       SCALE-24 (image optimization)
                                       SCALE-25 (data retention)
                                       SCALE-26 (database monitoring)
                                       SCALE-27 (feature flags)
                                       SCALE-28 (remote push notifications)
                                       SCALE-29 (mobile cache size)
                                       SCALE-30 (sound cleanup)
                                       SCALE-31 (channel cleanup on logout)
                                       SCALE-32 (FlatList → FlashList)
                                       SCALE-33 (sync handler Sentry) — depends on SCALE-22
                                       SCALE-34 (mobile E2E tests)
```

```
Phase 1 (Data Layer)
  SCALE-1 (reports aggregation) ─────┐
  SCALE-2 (pagination)               ├── Phase 4 (Performance)
                                     │     SCALE-8 (JWT claims)
Phase 2 (Data Integrity)             │     SCALE-9 (connection pooling)
  SCALE-3 (atomic order status)      │     SCALE-10 (caching)
  SCALE-4 (silent failures)          │
  SCALE-5 (mutation error handlers)  ├── Phase 5 (Resilience)
                                     │     SCALE-11 (notification fallback)
Phase 3 (Multi-Tenant)               │     SCALE-12 (circuit breaker)
  SCALE-6 (delivery IDOR)            │
  SCALE-7 (email uniqueness)         └── Phase 6 (Frontend & Tests)
                                           SCALE-13 (SSR) — depends on SCALE-1
                                           SCALE-14 (E2E tests)
                                           SCALE-15 (typed tests)
                                           SCALE-16 (React alignment)
```

Phases 1-3 can have some internal parallelism (e.g., SCALE-1 and SCALE-2
can run simultaneously). But don't start Phase 4+ until Phases 1-3 are
merged and tested. Phase 7 items are independent — interleave as time allows.

---

## Summary

| # | Issue | Phase | Effort | Impact |
|---|-------|-------|--------|--------|
| SCALE-1 | Reports server-side aggregation | 1 | 2 days | Prevents OOM crashes |
| SCALE-2 | Pagination on all queries | 1 | 1-2 days | Prevents unbounded growth |
| SCALE-3 | Atomic order status sync | 2 | 1 day | Prevents data corruption |
| SCALE-4 | Fix silent failures | 2 | 1 day | Prevents orphaned tables |
| SCALE-5 | Mandatory mutation error handlers | 2 | 0.5 day | Surfaces all errors |
| SCALE-6 | Delivery order access control | 3 | 0.5 day | Fixes IDOR vulnerability |
| SCALE-7 | Email uniqueness per tenant | 3 | 0.5 day | Fixes multi-tenancy |
| SCALE-8 | JWT custom claims | 4 | 1 day | Eliminates per-request DB query |
| SCALE-9 | Connection pooling + timeouts | 4 | 0.5 day | Prevents pool exhaustion |
| SCALE-10 | HTTP and edge caching | 4 | 1 day | Reduces DB load |
| SCALE-11 | Notification fallback | 5 | 1 day | Prevents missed orders |
| SCALE-12 | Circuit breaker / connection status | 5 | 1-2 days | Graceful degradation |
| SCALE-13 | SSR for key pages | 6 | 3-4 days | Better performance + SEO |
| SCALE-14 | Real E2E tests | 6 | 2-3 days | Actual test coverage |
| SCALE-15 | Typed test factories | 6 | 1-2 days | Type-safe tests |
| SCALE-16 | React version alignment | 6 | 0.5 day | Ecosystem consistency |
| SCALE-17 | Remove CSP unsafe-inline | 7 | 0.5 day | XSS protection |
| SCALE-18 | Error boundaries for 4 pages | 7 | 0.5 day | Graceful page errors |
| SCALE-19 | Discount trigger race condition | 7 | 0.5 day | Consistent discount UI |
| SCALE-20 | Trigger contention on orders | 7 | 1 day | Write performance at scale |
| SCALE-21 | Server-side upload validation | 7 | 0.5 day | Prevents malicious uploads |
| SCALE-22 | Mobile Sentry integration | 7 | 0.5 day | Mobile error visibility |
| SCALE-23 | CI coverage + bundle analysis | 7 | 1 day | Prevents silent regressions |
| SCALE-24 | Image optimization pipeline | 7 | 1 day | Faster image loading |
| SCALE-25 | Data retention and archival | 7 | 1-2 days | Compliance + DB performance |
| SCALE-26 | Database monitoring | 7 | 0.5 day | Slow query visibility |
| SCALE-27 | Feature flags via cafe_settings | 7 | 1 day | Safe rollouts |
| SCALE-28 | Remote push notifications (FCM) | 7 | 2-3 days | Background order alerts |
| SCALE-29 | Mobile offline cache size mgmt | 7 | 0.5 day | Prevents cache overflow |
| SCALE-30 | Mobile sound cleanup memory leak | 7 | 0.5 day | Prevents OOM on Android |
| SCALE-31 | Realtime channel cleanup on logout | 7 | 0.5 day | Prevents ghost subscriptions |
| SCALE-32 | FlatList to FlashList migration | 7 | 1 day | Smooth scrolling at 50+ orders |
| SCALE-33 | Mobile sync handler Sentry | 7 | 0.5 day | Offline sync error visibility |
| SCALE-34 | Mobile E2E tests | 7 | 1-2 days | Mobile test coverage |

**Total: 34 items across 7 phases, ~30-42 days of focused work**
