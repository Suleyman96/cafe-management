# MEDIUM Priority Fixes

> Issues that degrade performance, maintainability, or developer experience.
> Should be addressed in the next 1-2 sprints.
> Estimated effort: 5-8 days total

---

## MED-1: React 18/19 Split Across Apps

### Problem

Web apps (staff-web, customer-web, marketing) use React `^18.3.0` while mobile
uses React `19.1.0` (pinned). Shared packages have mixed `@types/react` versions:

| Package | React | @types/react |
|---------|-------|--------------|
| staff-web | ^18.3.0 | ^18.3.0 |
| customer-web | ^18.3.0 | ^18.3.0 |
| mobile | 19.1.0 | ~19.1.17 |
| packages/ui | peer: ^18.2.0 \|\| ^19.0.0 | ^18.2.45 |
| packages/queries | peer: ^18.2.0 \|\| ^19.0.0 | ^18.2.45 |

### Files to Change

- `packages/ui/package.json` (line 28: `@types/react`)
- `packages/queries/package.json` (line 28: `@types/react`)

### Fix Plan

**Step 1:** Update shared packages' `@types/react` devDependency to match the
range they already declare in peerDependencies:

```json
// packages/ui/package.json
"devDependencies": {
  "@types/react": "^18.3.0",
  "@types/react-dom": "^18.3.0"
}

// packages/queries/package.json
"devDependencies": {
  "@types/react": "^18.3.0"
}
```

**Step 2:** This is the correct approach because:
- The peer dependency `"react": "^18.2.0 || ^19.0.0"` already supports both
- devDeps are only used for building/testing the package itself
- pnpm isolates versions correctly per-consumer
- Using ^18.3.0 for building ensures API compatibility with the minimum target

**Step 3:** Do NOT try to unify React versions across web and mobile.
React Native 0.81.x requires React 19. This split is intentional and correct.
The peer dependency ranges in shared packages already handle it.

**Step 4:** Run `pnpm install` and verify no peer dependency warnings.

### Verification

- `pnpm install` has no peer dep warnings
- `pnpm build --filter='./packages/*'` succeeds
- `pnpm type-check` succeeds for all apps
- Mobile app builds successfully

---

## MED-2: No Health Check Endpoints

### Problem

Neither staff-web nor customer-web expose a `/api/health` endpoint. This prevents:
- Load balancer health probes
- Deployment readiness checks
- Uptime monitoring
- Kubernetes liveness/readiness probes (if containerized later)

### Files to Create

- `apps/staff-web/src/app/api/health/route.ts`
- `apps/customer-web/src/app/api/health/route.ts` (if API routes added to customer-web)

### Fix Plan

**Step 1:** Create `apps/staff-web/src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';  // Fast, no cold start

export function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
```

**Step 2:** Since customer-web has no API routes (mutations proxy through staff-web),
a health endpoint there is less critical. However, if the middleware from CRIT-2 is
added, consider adding a simple health route there too.

**Step 3:** Optionally extend the health check to verify Supabase connectivity:

```typescript
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Quick DB check — use a lightweight query
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('cafe_settings').select('id').limit(1);

    return NextResponse.json({
      status: error ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      db: error ? 'unreachable' : 'connected',
    });
  } catch {
    return NextResponse.json(
      { status: 'error', timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
```

**Step 4:** Update staff-web middleware to allow `/api/health` without auth:

In `apps/staff-web/src/middleware.ts`, the health endpoint is already covered
because it's under `/api/` — but it will require authentication. Add it to the
public API check:

```typescript
// Line 43: Add health check to public API paths
const isPublicApi = pathname.startsWith('/api/v1/customer/') || pathname === '/api/health';
```

### Verification

- `curl http://localhost:3001/api/health` returns `{"status":"ok",...}`
- No auth required for health endpoint
- Health endpoint works in production

---

## MED-3: Sentry Env Vars Missing in CI Build

### Problem

`apps/staff-web/next.config.js:65-71` uses `withSentryConfig()` which requires:
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN` (for source map uploads)

But `.github/workflows/ci.yml:124-126` only passes Supabase vars to the build step.
Source maps won't upload to Sentry, degrading production error tracking.

### Files to Change

- `.github/workflows/ci.yml` (line 124-126)

### Fix Plan

**Step 1:** Add Sentry secrets to the build job:

```yaml
      - name: Build apps
        run: pnpm build --filter=@gustri/staff-web --filter=@gustri/customer-web
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          NEXT_PUBLIC_SENTRY_DSN: ${{ secrets.NEXT_PUBLIC_SENTRY_DSN }}
```

**Step 2:** Ensure these secrets are configured in GitHub repository settings.
If Sentry isn't set up yet, add `silent: true` or conditional checks in next.config.js
to prevent build failures when Sentry vars are missing:

```javascript
// In next.config.js, the existing `silent: !process.env.CI` already handles this
// for local builds. But verify it doesn't fail when SENTRY_ORG is undefined.
```

**Step 3:** Verify the Sentry config handles missing env vars gracefully.
The `withSentryConfig` wrapper should skip source map upload when credentials
are missing, not fail the build.

### Verification

- CI build passes with Sentry env vars
- Source maps appear in Sentry dashboard
- Build doesn't fail when Sentry vars are missing (graceful degradation)

---

## MED-4: No `pnpm audit` in CI

### Problem

No dependency vulnerability scanning in CI. Known CVEs in dependencies
could go unnoticed.

### Files to Change

- `.github/workflows/ci.yml` (add audit step)

### Fix Plan

**Step 1:** Add a non-blocking audit step to the lint job:

```yaml
      - name: Audit dependencies
        run: pnpm audit --prod || true
        # Non-blocking: we want visibility, not build failures for upstream CVEs
```

**Step 2:** For stricter enforcement, use `--audit-level=critical` to only
fail on critical vulnerabilities:

```yaml
      - name: Audit dependencies
        run: pnpm audit --prod --audit-level=critical
```

**Step 3:** Consider adding a weekly scheduled audit workflow that creates
an issue when new vulnerabilities are found:

```yaml
# .github/workflows/audit.yml
name: Security Audit
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday 9am UTC
  workflow_dispatch: {}
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --prod
```

### Verification

- Audit step runs and reports findings
- CI doesn't break on non-critical advisories
- Critical advisories fail the build

---

## MED-5: `packages/core` Missing `exports` Field

### Problem

All other packages (`database`, `api-client`, `i18n`, `queries`, `ui`) have
proper `exports` field in package.json. `packages/core` only has `main`/`module`/`types`.

This causes inconsistent module resolution, especially in stricter environments
or when using Node.js `--experimental-modules` or tools that prefer `exports`.

### Files to Change

- `packages/core/package.json`

### Fix Plan

**Step 1:** Add `exports` field matching the pattern of other packages:

```json
{
  "name": "@gustri/core",
  "version": "0.0.0",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.js",
      "import": "./dist/index.mjs"
    }
  },
  ...
}
```

### Verification

- `pnpm build --filter=@gustri/core` succeeds
- Consumers can still `import { AppError } from '@gustri/core'`
- `pnpm type-check` passes for all apps

---

## MED-6: Customer-Facing API Routes Have No Rate Limiting at Edge

### Problem

Customer API endpoints (`/api/v1/customer/orders/*`) are rate-limited per-IP
inside the route handler via Upstash Redis. This is good. However, the customer-web
app itself has no edge-level protection against:
- Rapid page loads / scraping
- Abuse of Supabase RPC calls (direct client-side calls)
- WebSocket connection flooding

The Supabase RPC calls from customer-web go directly to Supabase (not through
staff-web), so the rate limiter in staff-web doesn't cover those.

### Fix Plan

**Step 1:** This is partially addressed by CRIT-2 (customer-web middleware).
But true rate limiting for Supabase calls must happen at the Supabase level.

**Step 2:** Configure Supabase rate limiting in the dashboard:
- Set per-IP connection limits
- Set per-IP request limits for the REST API
- Configure realtime connection limits

**Step 3:** Optionally, add client-side throttling for RPC calls:

```typescript
// In customer-web's supabase.ts, add event rate limiting
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,  // Already present!
    },
  },
});
```

The `eventsPerSecond: 10` is already configured. The remaining concern is
REST API rate limiting, which should be configured at the Supabase infrastructure level.

### Verification

- Rapid-fire requests from customer-web get throttled
- Normal user flows are not affected

---

## MED-7: Large Components Need Splitting (400-550 lines)

**Status (2026-05-02): ✅ shipped (residue closed by PR #79).** Earlier
PRs split delivery/takeout pages. The two remaining 400+ line outliers
(`split-payment-modal.tsx` 477→369; `menu/page.tsx` 441→212) were
extracted into focused subcomponents under `components/modals/payment/`
and `components/menu/`. No new abstractions; each split is a verbatim
JSX move with prop drilling. Tests, type-check, biome all pass.

### Problem

Four components exceed 400 lines, making them hard to maintain, test, and review:

| File | Lines | Responsibility |
|------|-------|---------------|
| `delivery/page.tsx` | 554 | Order list + filters + status management |
| `takeout/page.tsx` | 517 | Order list + filters + status management |
| `split-payment-modal.tsx` | 472 | Payment modes + item selection + calculation |
| `menu/page.tsx` | 416 | Menu CRUD + categories + drag-drop |

### Fix Plan

**Step 1:** Extract shared order filtering logic (used in orders, delivery, takeout):

Create `apps/staff-web/src/hooks/use-order-filters.ts`:
```typescript
export function useOrderFilters(orders: OrderWithDetails[], allowedStatuses: OrderStatus[]) {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    let result = orders;
    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }
    if (searchQuery) {
      result = result.filter(o =>
        o.id.includes(searchQuery) ||
        o.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return result;
  }, [orders, statusFilter, searchQuery]);

  return { filtered, statusFilter, setStatusFilter, searchQuery, setSearchQuery };
}
```

**Step 2:** Split delivery/page.tsx into:
- `delivery/page.tsx` — page shell + data fetching (~100 lines)
- `delivery/delivery-order-list.tsx` — order list rendering (~150 lines)
- `delivery/delivery-order-card.tsx` — single order card (~100 lines)
- `delivery/delivery-filters.tsx` — filter controls (~80 lines)

**Step 3:** Apply same pattern to `takeout/page.tsx`.

**Step 4:** Split `split-payment-modal.tsx` into:
- `split-payment-modal.tsx` — modal shell + mode selection (~150 lines)
- `split-payment/item-payment-form.tsx` — per-item payment UI (~150 lines)
- `split-payment/partial-payment-form.tsx` — partial amount UI (~100 lines)

**Step 5:** Split `menu/page.tsx` into:
- `menu/page.tsx` — page shell + data fetching (~100 lines)
- `menu/menu-item-list.tsx` — item list rendering
- `menu/menu-item-form.tsx` — create/edit form
- `menu/category-sidebar.tsx` — category navigation

### Approach

Do NOT split all at once. One file per PR:
1. Extract `useOrderFilters` hook (shared benefit)
2. Split `delivery/page.tsx` (largest)
3. Split `takeout/page.tsx` (very similar to delivery)
4. Split `split-payment-modal.tsx`
5. Split `menu/page.tsx`

### Verification

- Each split maintains identical UI behavior
- Existing tests still pass
- New components have clear single-responsibility

---

## MED-8: Missing React Query `staleTime` Configuration

### Problem

Many `useQuery` calls in the `@gustri/queries` package (shared hooks) have
no `staleTime` set, defaulting to 0ms. Some apps already configure defaults:

**Already configured (good):**
- `apps/customer-web/src/components/providers.tsx:50` — global `staleTime: 60 * 1000`
- `apps/customer-web/src/hooks/use-table.ts:33` — `staleTime: STALE_TIMES.SHORT`
- `apps/customer-web/src/hooks/use-settings.ts:78` — `staleTime: STALE_TIMES.MEDIUM`
- `apps/staff-web/src/app/providers.tsx:35` — global `staleTime: 60 * 1000`
- `apps/staff-web/src/hooks/use-tenant-plan.ts:20` — `staleTime: 60_000`
- `packages/queries/src/hooks/use-cafe-settings.ts:13` — `staleTime: 5 * 60 * 1000`
- `apps/mobile/App.tsx:39` — global `staleTime: 60 * 1000`

**Missing (needs fix):**
- `packages/queries/src/hooks/use-orders.ts` — no staleTime (relies on app-level default)
- `apps/customer-web/src/hooks/use-delivery.ts:23` — explicitly `staleTime: 0`
- `apps/customer-web/src/hooks/use-order.ts:24` — explicitly `staleTime: 0`
- `apps/mobile/src/hooks/use-orders.ts:60` — explicitly `staleTime: 0`

The explicit `staleTime: 0` overrides the global default, causing excessive refetches.

### Files to Change

- `apps/staff-web/src/lib/query-client.ts` (or wherever QueryClient is configured)
- Or set defaults in the QueryClient provider

### Fix Plan

**Step 1:** Set sensible global defaults in the QueryClient configuration:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,       // 30 seconds — most data is fresh enough
      gcTime: 5 * 60 * 1000,      // 5 minutes garbage collection
      refetchOnWindowFocus: true,  // Still refetch, but only if stale
      retry: 1,
    },
  },
});
```

**Step 2:** Override for specific query types that need different behavior:

```typescript
// Real-time data (orders, waiter calls) — keep low staleTime
useQuery({
  queryKey: ['orders'],
  queryFn: ...,
  staleTime: 5 * 1000,  // 5 seconds, supplemented by realtime subscriptions
});

// Rarely changing data (menu items, categories, settings) — longer staleTime
useQuery({
  queryKey: ['menu-items'],
  queryFn: ...,
  staleTime: 2 * 60 * 1000,  // 2 minutes
});

// Static data (enums, translations) — very long staleTime
useQuery({
  queryKey: ['settings'],
  queryFn: ...,
  staleTime: 5 * 60 * 1000,  // 5 minutes
});
```

**Step 3:** This works well with the existing realtime subscriptions — data
gets invalidated by the realtime handler, not by polling.

### Verification

- Network tab shows fewer redundant requests
- Data still updates promptly via realtime + invalidation
- Window focus doesn't trigger 10+ simultaneous refetches

---

## MED-9: Turbo `type-check` Cache Disabled

### Problem

`turbo.json:20-24` has `"cache": false` for `type-check`. This means every
`pnpm type-check` re-runs even when no files changed.

### Files to Change

- `turbo.json` (line 23)

### Fix Plan

**Step 1:** Enable caching for type-check:

```json
"type-check": {
  "dependsOn": ["^build"],
  "outputs": [],
  "cache": true
}
```

**Step 2:** This is safe because:
- Turbo tracks input file hashes automatically
- `dependsOn: ["^build"]` ensures packages are built first
- `outputs: []` means nothing is cached to disk, just the pass/fail result
- If any source file changes, Turbo will re-run type-check

### Verification

- Run `pnpm type-check` twice — second run should be instant (cache hit)
- Modify a file — next run should re-check the affected packages

---

## MED-10: Supabase Peer Dependency Version Mismatch

### Problem

`packages/database/package.json:27` declares peer dependency
`"@supabase/supabase-js": "^2.39.0"` while all consumers use `^2.45.0`.

### Files to Change

- `packages/database/package.json` (lines 27, 30)

### Fix Plan

**Step 1:** Update peer and dev dependency to match consumers:

```json
"peerDependencies": {
  "@supabase/supabase-js": "^2.45.0"
},
"devDependencies": {
  "@supabase/supabase-js": "^2.45.0"
}
```

### Verification

- `pnpm install` has no peer dependency warnings
- `pnpm build --filter=@gustri/database` succeeds

---

## Execution Order

1. **MED-5** (core exports) — 5 min, zero risk
2. **MED-9** (turbo cache) — 5 min, immediate DX improvement
3. **MED-10** (supabase peer dep) — 5 min, consistency fix
4. **MED-1** (React types alignment) — 15 min, dependency hygiene
5. **MED-3** (Sentry CI vars) — 15 min, observability
6. **MED-4** (pnpm audit) — 30 min, security scanning
7. **MED-2** (health endpoints) — 30 min, operations
8. **MED-8** (staleTime) — 1 hour, performance
9. **MED-6** (customer rate limiting) — 1 hour, infrastructure
10. **MED-7** (component splitting) — 3-4 hours, maintainability

## Definition of Done

- [ ] Shared package types/deps are consistent
- [ ] Health check endpoints respond correctly
- [ ] Sentry source maps upload in CI
- [ ] Dependency audit runs in CI
- [ ] Core package has proper exports
- [ ] React Query staleTime configured globally
- [ ] Turbo caches type-check results
- [ ] Large components split into <200-line files
- [ ] All tests pass, all builds succeed
