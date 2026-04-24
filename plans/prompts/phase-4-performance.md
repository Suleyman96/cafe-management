# Phase 4 Prompt: Performance at Scale (SCALE-8 + SCALE-9 + SCALE-10)

Copy everything below the line and paste it as the prompt for a new Claude Code session.

---

## Task

Implement Phase 4 (SCALE-8, SCALE-9, SCALE-10) from `plans/07-SCALING-AND-ARCHITECTURE-fixes.md`. Read that file for full context, but this prompt contains the verified details you need. Phases 1-3 have already been implemented.

## What you're fixing and why

With 100 cafes and 300-500 concurrent staff users, the database becomes the bottleneck. Three performance fixes:
1. **JWT custom claims** — eliminate a staff table query on EVERY request (middleware + API route verification)
2. **Connection pooling + timeouts** — prevent pool exhaustion and runaway queries
3. **HTTP caching + stale time tuning** — reduce redundant database hits for rarely-changing data

---

## SCALE-8: JWT custom claims instead of middleware DB lookup

### Goal
Encode `staff_id`, `tenant_id`, `role`, and `is_active` into the JWT via a Supabase Auth hook. Then read these claims in middleware and API route verifiers instead of querying the staff table.

### Current state (verified)

**THREE places** query the staff table per-request:

1. **Middleware** (`apps/staff-web/src/middleware.ts` lines 91-96):
```typescript
const { data: staff } = await supabase
  .from('staff')
  .select('id')
  .eq('auth_user_id', user.id)
  .eq('is_active', true)
  .single();
```
Runs on EVERY page navigation for authenticated users.

2. **verifyStaff** (`apps/staff-web/src/lib/api/verify-staff.ts` lines 28-33):
```typescript
const { data: staffData } = await supabaseAdmin
  .from('staff')
  .select('id, role, tenant_id')
  .eq('auth_user_id', user.id)
  .eq('is_active', true)
  .single();
```
Used by: orders API, payments API, discount API, stock adjust API.

3. **verifyAdmin** (`apps/staff-web/src/lib/api/verify-admin.ts` lines 39-44):
```typescript
const { data: staffData } = await supabaseAdmin
  .from('staff')
  .select('id, role, tenant_id')
  .eq('auth_user_id', user.id)
  .eq('is_active', true)
  .single();
```
Used by: staff management API, settings API, refunds API, password reset API.

**Supabase config** (`supabase/config.toml`):
- JWT expiry: 3600 seconds (1 hour)
- No auth hooks configured currently (confirmed: no `auth.hook` section in config.toml)

**No existing JWT custom claims** — confirmed by searching migrations.

### Implementation steps

**Step 1** — Create migration `supabase/migrations/YYYYMMDD_jwt_custom_claims_hook.sql`:

```sql
-- Auth hook: inject staff claims into JWT on token generation/refresh.
-- This eliminates per-request staff table lookups in middleware and API routes.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql STABLE
SET search_path = ''
AS $$
DECLARE
  v_staff RECORD;
  claims JSONB;
BEGIN
  claims := event->'claims';

  -- Look up the staff record for this auth user
  SELECT id, tenant_id, role, is_active
  INTO v_staff
  FROM public.staff
  WHERE auth_user_id = (event->>'user_id')::UUID
    AND is_active = true
  LIMIT 1;

  IF v_staff IS NOT NULL THEN
    claims := jsonb_set(claims, '{staff_id}', to_jsonb(v_staff.id::TEXT));
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_staff.tenant_id::TEXT));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(v_staff.role::TEXT));
    claims := jsonb_set(claims, '{is_active_staff}', 'true'::JSONB);
  ELSE
    claims := jsonb_set(claims, '{is_active_staff}', 'false'::JSONB);
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Grant execute to supabase_auth_admin (required for auth hooks)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(JSONB) TO supabase_auth_admin;

-- The hook also needs to read the staff table
GRANT SELECT ON public.staff TO supabase_auth_admin;
```

**Step 2** — Enable the hook in the Supabase config. Add to `supabase/config.toml`:

```toml
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"
```

**Important:** For local development with `supabase start`, this config takes effect immediately. For production (hosted Supabase), the hook must be enabled via Dashboard > Auth > Hooks > Custom Access Token. Document this in the migration file comments.

**Step 3** — Update middleware (`apps/staff-web/src/middleware.ts`).

Replace lines 90-102 (the staff DB lookup) with JWT claims check:

```typescript
// BEFORE (lines 90-102):
const { data: staff } = await supabase
  .from('staff')
  .select('id')
  .eq('auth_user_id', user.id)
  .eq('is_active', true)
  .single();

if (!staff) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('error', 'inactive');
  return NextResponse.redirect(loginUrl);
}

// AFTER:
// Read claims from the JWT (injected by custom_access_token_hook)
const isActiveStaff = user.app_metadata?.is_active_staff === true;

if (!isActiveStaff) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('error', 'inactive');
  return NextResponse.redirect(loginUrl);
}
```

Wait — **important detail about where claims appear in the Supabase JWT.** The `custom_access_token_hook` modifies the JWT `claims` object. In the decoded JWT:
- Custom claims appear at the TOP LEVEL of the JWT payload (alongside `sub`, `role`, `iss`, etc.)
- They are NOT inside `app_metadata` or `user_metadata`
- Access via `user` object from `supabase.auth.getUser()`: the custom claims are NOT directly on the `user` object — they're in the raw JWT

To access custom claims in middleware, you need to decode the JWT or use the session:

```typescript
const { data: { session } } = await supabase.auth.getSession();
// session.access_token is the raw JWT
// Decode it or use the user object

// Actually, for Supabase custom access token hooks, the claims
// ARE available on the user object's app_metadata in some versions,
// or you need to decode the JWT directly.
```

**The safest approach** is to get the session and decode the JWT:

```typescript
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  return NextResponse.redirect(loginUrl);
}

// Decode JWT payload (base64, no verification needed — already verified by Supabase)
const payload = JSON.parse(
  Buffer.from(session.access_token.split('.')[1], 'base64').toString()
);

const isActiveStaff = payload.is_active_staff === true;
if (!isActiveStaff) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('error', 'inactive');
  return NextResponse.redirect(loginUrl);
}
```

Actually, a cleaner approach — Supabase already provides `getUser()` which returns the user, and for middleware you already have the session cookie. Read the Supabase docs on custom access token hooks to determine the exact access pattern. The claims should be in the JWT payload which you can access via the session's `access_token`.

**Recommended approach**: Create a helper function:

```typescript
// apps/staff-web/src/lib/api/jwt-claims.ts
export interface StaffClaims {
  staff_id: string;
  tenant_id: string;
  user_role: string;
  is_active_staff: boolean;
}

export function getStaffClaims(accessToken: string): StaffClaims | null {
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64').toString()
    );
    if (!payload.is_active_staff) return null;
    return {
      staff_id: payload.staff_id,
      tenant_id: payload.tenant_id,
      user_role: payload.user_role,
      is_active_staff: payload.is_active_staff,
    };
  } catch {
    return null;
  }
}
```

Then use in middleware:

```typescript
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  return NextResponse.redirect(loginUrl);
}

const claims = getStaffClaims(session.access_token);
if (!claims) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('error', 'inactive');
  return NextResponse.redirect(loginUrl);
}
```

**Step 4** — Update `verifyStaff` (`apps/staff-web/src/lib/api/verify-staff.ts`).

Replace the staff DB lookup with JWT claims:

```typescript
import { getStaffClaims } from './jwt-claims';

export async function verifyStaff(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError('Unauthorized', 401);
  }

  const token = authHeader.slice(7);
  const supabaseAdmin = getSupabaseAdmin();

  // Still verify the token is valid with Supabase Auth
  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return jsonError('Unauthorized', 401);
  }

  // Read staff info from JWT claims instead of querying the DB
  const claims = getStaffClaims(token);
  if (!claims) {
    return jsonError('Forbidden: active staff required', 403);
  }

  return {
    id: claims.staff_id,
    role: claims.user_role,
    tenant_id: claims.tenant_id,
  };
}
```

**Step 5** — Update `verifyAdmin` (`apps/staff-web/src/lib/api/verify-admin.ts`).

Same pattern as verifyStaff, but also check the role:

```typescript
import { getStaffClaims } from './jwt-claims';

export async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const supabaseAdmin = getSupabaseAdmin();

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const claims = getStaffClaims(token);
  if (!claims || !['admin', 'owner'].includes(claims.user_role)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  return {
    id: claims.staff_id,
    role: claims.user_role,
    tenant_id: claims.tenant_id,
  };
}
```

**Step 6** — Force token refresh when staff data changes.

When an admin deactivates a staff member or changes their role, the JWT still contains the old claims until it expires (up to 1 hour). To handle this:

- In the staff update/deactivate API routes (`apps/staff-web/src/app/api/staff/route.ts`), after modifying the staff record, the change takes effect on next token refresh.
- For immediate effect: the Supabase client on the affected user's browser will auto-refresh the token (within minutes). For critical actions (deactivation), you may want to add `supabase.auth.admin.updateUserById(userId, { ban_duration: 'none' })` which forces a session invalidation.
- Document this limitation: "Role/status changes take effect within minutes (on next JWT refresh)."

**Step 7** — **Keep the `getSupabaseAdmin()` function and its imports.** It's still needed for:
- Creating auth users (staff API)
- DB operations that bypass RLS (admin actions)
- `auth.getUser(token)` — still needed to verify the token is valid (JWT decode alone doesn't verify expiry or revocation)

### Verification
- Login → verify JWT contains custom claims (decode in browser DevTools: `JSON.parse(atob(token.split('.')[1]))`)
- Navigate pages → verify no staff table queries in Supabase logs (only on login/refresh)
- API calls → verify verifyStaff/verifyAdmin use claims
- Deactivate a staff member → verify they can't access after token refresh
- Change a staff role → verify new role reflected after token refresh
- Run `pnpm test && pnpm type-check && pnpm check`
- Run `supabase start` locally → verify the auth hook works with local Supabase

---

## SCALE-9: Connection pooling and statement timeouts

### Goal
Configure PgBouncer transaction mode and add statement timeouts to prevent pool exhaustion and runaway queries.

### Current state (verified)

**Supabase config** (`supabase/config.toml`):
- `max_rows = 1000` (line 9 area)
- JWT expiry: 3600s
- No connection pooling configuration visible in config.toml

**Client configuration** (`apps/staff-web/src/lib/supabase/client.ts`):
- Uses `createBrowserClient` from `@supabase/ssr`
- Has a 15-second fetch timeout (lines 7-24)
- Connects via REST API (default for Supabase JS client) — this uses the pooled connection string automatically

**For local development**, Supabase local runs with default PostgreSQL settings (no PgBouncer). For production, PgBouncer is configured in the Supabase Dashboard.

### Implementation steps

**Step 1** — Create migration `supabase/migrations/YYYYMMDD_statement_timeouts.sql`:

```sql
-- Prevent any single query from running indefinitely.
-- This protects the connection pool from being blocked by runaway queries.

-- Default timeout for all roles (10 seconds)
ALTER DATABASE postgres SET statement_timeout = '10s';

-- Tighter timeout for the anon role (customer-facing, should be fast)
ALTER ROLE anon SET statement_timeout = '5s';

-- Authenticated role gets the default (10s)
ALTER ROLE authenticated SET statement_timeout = '10s';

-- Service role gets a longer timeout (admin operations, migrations)
ALTER ROLE service_role SET statement_timeout = '30s';
```

**Important:** These settings take effect on new connections only. Existing connections keep their old timeout until they disconnect and reconnect.

**Step 2** — Document the production PgBouncer configuration. Create or update a deployment doc. The key settings for production Supabase:

```
# Supabase Dashboard > Database > Connection Pooling
# Mode: Transaction (NOT Session)
# Pool size: Default (usually 15-20 for Pro plan)
# 
# Verify by checking the connection string:
# - Pooled: port 6543 (use this in app)
# - Direct: port 5432 (use only for migrations)
```

**Step 3** — Verify all app environment variables use the pooled connection string. Check `.env.example` files — `NEXT_PUBLIC_SUPABASE_URL` should point to the REST API endpoint (which uses pooling by default). The Supabase JS client uses REST, NOT direct PostgreSQL connections, so this is already correct. No code changes needed.

**Step 4** — Add a health check query that monitors connections:

```sql
-- Add to the health check API route or a monitoring query
-- apps/staff-web/src/app/api/health/route.ts

-- Query to check current connection count (for monitoring)
-- SELECT count(*) as active, state FROM pg_stat_activity GROUP BY state;
```

Read `apps/staff-web/src/app/api/health/route.ts` and consider adding connection pool monitoring to it. But this is optional — the statement timeouts are the critical fix.

### Verification
- Run a slow query (e.g., `SELECT pg_sleep(15)`) as anon role → should fail after 5s
- Run as authenticated → should fail after 10s
- Run as service_role → should fail after 30s
- Normal app operations complete well under timeouts
- Run `pnpm test` — tests should not be affected (test queries are fast)

---

## SCALE-10: HTTP caching and stale time tuning

### Goal
Reduce redundant database hits by tuning React Query stale times per data type and adding Cache-Control headers to API responses for customer-facing routes.

### Current state (verified)

**React Query defaults** (`apps/staff-web/src/app/providers.tsx` lines 48-56):
```typescript
queries: {
  staleTime: 60 * 1000,    // 1 minute for everything
  gcTime: 5 * 60 * 1000,   // 5 minutes
  refetchOnWindowFocus: false,
  refetchOnMount: true,
  refetchOnReconnect: true,
  retry: 1,
},
```

**Per-hook overrides already in place:**
- `useCafeSettings`: `staleTime: 5 * 60 * 1000` (5 min) — `packages/queries/src/hooks/use-cafe-settings.ts:13`
- `useRevenueSummary` and other report hooks: `staleTime: 5 * 60 * 1000` (5 min) — `packages/queries/src/hooks/use-reports.ts`
- All other hooks (orders, tables, menu items, categories, staff, etc.): inherit 1 minute default

**No Cache-Control headers** on any API route — confirmed by grep.

**No per-hook staleTime** on:
- `useMenuItems` — `packages/queries/src/hooks/use-menu-items.ts` (no staleTime)
- `useCategories` — `packages/queries/src/hooks/use-categories.ts` (no staleTime)
- `useStaff` — inherits 1 min default
- `useOrders` — inherits 1 min default (this is correct — orders change frequently)

### Implementation steps

**Step 1** — Add staleTime to hooks for data that changes infrequently.

Update `packages/queries/src/hooks/use-menu-items.ts`:
```typescript
export function useMenuItems(options?: { ... }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.MENU_ITEMS, options],
    queryFn: () => db.menuItems.findAll(options) as Promise<MenuItemWithCategory[]>,
    staleTime: 5 * 60 * 1000, // 5 min — menu changes rarely during service
  });
}
```

Update `packages/queries/src/hooks/use-categories.ts`:
```typescript
export function useCategories(options?: { isActive?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.CATEGORIES, options],
    queryFn: () => db.categories.findAll(options) as Promise<Category[]>,
    staleTime: 10 * 60 * 1000, // 10 min — categories almost never change during service
  });
}
```

**Do NOT change staleTime for:**
- `useOrders`, `useActiveOrders`, `useDeliveryOrders`, `useTakeoutOrders` — orders change constantly, 1 min is correct
- `useTables` — tables change frequently (status updates)
- `useWaiterCalls` — realtime-driven, 1 min is fine
- `usePayments` — changes during active orders

**Step 2** — Add Cache-Control headers to customer-facing API routes.

Update `apps/staff-web/src/app/api/v1/customer/orders/route.ts` — the customer order creation endpoint. This is a POST, so no caching needed. But if there are any GET endpoints for customers (menu, settings), add headers.

Check if there are customer-facing GET endpoints. Looking at the API routes:
- `POST /api/v1/customer/orders` — creates order (no cache)
- `POST /api/v1/customer/orders/[id]/items` — adds items (no cache)

Customer-web reads menu/settings data directly from Supabase (not through staff-web API), so Cache-Control headers on staff-web API routes won't help customer-web.

**However**, we can add Cache-Control to the health check:

```typescript
// apps/staff-web/src/app/api/health/route.ts
response.headers.set('Cache-Control', 'no-cache');
```

**Step 3** — The more impactful caching is in customer-web's Supabase queries. Customer-web has its own React Query setup. Check if it exists and add stale times there too.

Find and read the customer-web providers file:
- Look at `apps/customer-web/src/app/providers.tsx` or similar
- Check its React Query staleTime defaults
- Add the same per-hook staleTime pattern for menu items and categories

The customer-web hooks are in `apps/customer-web/src/hooks/` — they call Supabase directly (not through the shared `@gustri/queries` package for some hooks like `use-delivery.ts`). Check which hooks exist and add staleTime to the infrequently-changing ones.

**Step 4** — Add `staleTime` to the staff-web `useStaff` hook:

Check `packages/queries/src/hooks/use-staff.ts`:
```typescript
// Staff list rarely changes during a shift
staleTime: 5 * 60 * 1000, // 5 min
```

**Step 5** — Consider increasing the global `refetchOnMount` behavior. Currently it's `true`, meaning every time a component mounts, it refetches even if data is fresh. For frequently-mounted components (e.g., order cards), this causes unnecessary requests.

However, changing this globally is risky. Instead, the per-hook staleTime additions from Steps 1 and 4 are sufficient — if data is within its staleTime, `refetchOnMount: true` won't trigger a network request (it just uses the cached data).

### Verification
- Navigate between pages in staff-web → verify menu items and categories are NOT refetched on every page navigation (check Network tab)
- Verify orders and tables ARE still refetched normally (staleTime = 1 min default)
- Cafe settings should survive 5 minutes without refetch
- Realtime subscriptions still invalidate and refetch immediately on changes
- Run `pnpm test && pnpm type-check && pnpm check`

---

## General rules

- Follow existing code patterns exactly
- Use Biome formatting: 2-space indent, single quotes, trailing commas. Run `pnpm check:fix` before considering done
- Migration filenames: use format `YYYYMMDD000001_description.sql`. Check existing migrations for the latest date prefix to avoid collisions
- The JWT claims implementation is the most complex item — test thoroughly with local Supabase before considering it done
- Do NOT add comments, docstrings, or type annotations beyond what's needed
- Do NOT refactor surrounding code — only change what's needed for these three issues
- For SCALE-9, the primary change is a migration + documentation — most of the work is config, not code
- Run `pnpm test && pnpm type-check && pnpm check` at the end to verify everything passes
