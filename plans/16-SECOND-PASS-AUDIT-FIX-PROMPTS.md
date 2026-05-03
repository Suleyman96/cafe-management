# Staff-Web Second-Pass Audit — Implementation Prompts

One self-contained prompt per agent. Copy each block into a fresh agent in the
listed order — later prompts assume earlier fixes are merged.

Each prompt assumes:
- Repo root: `/Users/kamilhajilov/Documents/github/cafe-idare`
- Monorepo structure documented in `CLAUDE.md`
- After every change: `pnpm check`, `pnpm type-check`, `pnpm test --filter=<touched-package>`
- DB changes: new migration files only — never edit merged ones. Run `pnpm db:types:generate` and commit `packages/database/src/types/generated.ts` in the same PR.
- One PR per agent. Do not bundle.

Execution order: **Agent 1 → Agent 2 → Agent 3 → Agent 4**.
Agent 3 (DB-only) may run in parallel with Agent 2 if a separate reviewer is available.

---

## Findings index (mapped to second-pass audit)

| # | Severity | Title | Owner |
|---|---|---|---|
| 1 | 🔴 CRIT | QueryClient survives logout — cross-tenant cache bleed | Agent 1 |
| 2 | 🔴 CRIT | Query keys not tenant-scoped | Agent 1 |
| 3 | 🔴 CRIT | Discount endpoint privilege gap (verifyStaff + cap, UI is admin-only) | Agent 2 |
| 4 | 🔴 CRIT | `assignWaiter` has no role gate | Agent 2 |
| 5 | 🟠 HIGH | Order item partial-cancel non-atomic (lost-update race) | Agent 3 |
| 6 | 🟠 HIGH | Payment trigger doesn't reject closed/cancelled orders | Agent 3 |
| 7 | 🟠 HIGH | Realtime reconnect has no catch-up (`lastEventAtRef` unused) | Agent 4 |
| 8 | 🟠 HIGH | `-safe` hook bloat — 7 thin re-exports | Agent 1 |
| 9 | 🟠 HIGH | Idempotency / dedupe applied selectively across `/api/v1/*` | Agent 4 |
| 10 | 🟠 HIGH | `isClientRequestIdConflict` is dead code | Agent 1 |
| 12 | 🟡 MED | Missing composite index `(tenant_id, created_at)` on orders | Agent 3 |
| 13 | 🟡 MED | Kitchen page force-rerender every 60s | Agent 4 |
| 14 | 🟡 MED | `useCanMutate` is misnamed (checks connection, not auth) | Agent 2 |

Findings #11 (orders 30-day over-fetch) and #15 (PDF export on main thread) are deferred — they need product-side decisions before code changes.

---

## Agent 1 — Cache identity & dead-code cleanup

```
You are closing the highest-impact integrity finding from the second-pass
staff-web audit: TanStack Query cache survives logout and query keys are not
scoped by tenant. Combined, these allow tenant A's cached data to be served to
tenant B if both authenticate in the same browser tab within `gcTime` (5 min).

While the surface is open, also delete dead `-safe` wrappers and unused exports.

## Scope (one PR)

### 1. Clear QueryClient on auth boundary changes
File: `apps/staff-web/src/app/providers.tsx`
- In the `RealtimeAuthBridge` (or wherever `supabase.auth.onAuthStateChange` is
  handled), on `SIGNED_OUT` call `queryClient.clear()` BEFORE the navigation
  push to `/login`.
- On `SIGNED_IN`, compare the new staff's `tenant_id` against the previously
  cached one (store the prior tenantId in a ref or a top-level singleton). If
  different, call `queryClient.clear()` before the first refetch fires.

File: `apps/staff-web/src/hooks/use-auth.ts` (`stableLogout` at lines ~152-157)
- After `clearAuth()` and BEFORE `router.push('/login')`, also call
  `queryClient.clear()`. If the bridge already covers this, leave a one-line
  comment explaining the redundancy is intentional belt-and-braces.

Test: `apps/staff-web/src/__tests__/providers.test.tsx` (new) — mount provider,
seed cache, fire SIGNED_OUT, assert cache is empty.

### 2. Tenant-prefix every query key
File: `packages/queries/src/keys.ts`
- Add a helper:
  `export const tenantKey = (tenantId: string | null | undefined, key: string, ...rest: unknown[]) => [key, tenantId ?? '__no_tenant__', ...rest] as const;`
- Update every `QUERY_KEYS` consumer in `packages/queries/src/hooks/*` and
  `packages/queries/src/mutations/*` to use `tenantKey(tenantId, …)`. Source
  the tenantId from `useAuthStore` (web) — for shared package, accept it via
  hook parameter and require call sites to pass it.
- For staff-web call sites, `useAuthStore((s) => s.staff?.tenant_id)` is the
  source of truth. For mobile, the existing tenant-context selector.

File: `packages/queries/src/invalidation.ts`
- Update every helper to accept `tenantId` and scope invalidations to it.
- Audit every existing call site and pass tenantId explicitly. Do NOT default
  to `''` or `null` — that re-introduces the cross-tenant key collision.

Test: `packages/queries/src/__tests__/keys.test.ts` (new) — assert two
different tenantIds produce non-overlapping keys for the same logical query.

### 3. Delete thin `-safe` wrappers
Files to DELETE entirely (each is a thin re-export of the shared hook with no
plan-gate, no API-route mutation, no app-specific UI state):
- `apps/staff-web/src/hooks/use-menu-safe.ts`
- `apps/staff-web/src/hooks/use-reports-safe.ts`
- `apps/staff-web/src/hooks/use-expenses-safe.ts`
- `apps/staff-web/src/hooks/use-waste-safe.ts`
- `apps/staff-web/src/hooks/use-delivery-safe.ts`
- `apps/staff-web/src/hooks/use-delivery-customers-safe.ts`
- `apps/staff-web/src/hooks/use-takeout-safe.ts`

For each, before deleting:
1. Read the file. If it adds ANY logic beyond re-export, STOP and report — do
   not delete blindly.
2. Update `apps/staff-web/src/hooks/index.ts` to drop the export.
3. Replace every import in `apps/staff-web/src/app/**` and
   `apps/staff-web/src/components/**` with the equivalent import from
   `@gustri/queries`.

### 4. Delete dead exports
File: `apps/staff-web/src/lib/api/dedupe.ts`
- `isClientRequestIdConflict` is exported but unused. Confirm with grep across
  apps/ and packages/, then delete the function and the export.

## Out of scope (do NOT do here)
- Authorization changes (Agent 2)
- DB migrations (Agent 3)
- Realtime / kitchen rerender (Agent 4)

## Acceptance
- New unit tests pass.
- `pnpm check`, `pnpm type-check`, `pnpm test` green for `packages/queries` and `apps/staff-web`.
- Manual verification (in dev): log in as Tenant A, navigate to orders, sign
  out, sign in as Tenant B — Tenant A's orders MUST NOT flash on screen.
- `git grep -n "isClientRequestIdConflict"` returns nothing.
- `git grep -nE "use-(menu|reports|expenses|waste|delivery|delivery-customers|takeout)-safe"` returns nothing.
```

---

## Agent 2 — Authorization tightening

```
You are closing two privilege-boundary defects identified in the second-pass
staff-web audit:
- Discount endpoint accepts any active staff and "caps" the value by role
  instead of blocking, while the UI hides the button from non-admins.
- `orders.assignWaiter` is a direct wrapper write; RLS allows any active staff
  to reassign any other waiter's open order.

Also rename the misleading `useCanMutate` (which only checks connection state,
not authorization).

DO NOT TOUCH cache or query keys (Agent 1's PR). DO NOT TOUCH DB triggers or
indexes (Agent 3's PR). Coordinate with mobile owner before merge — both fixes
have call sites in `apps/mobile/`.

## Scope (one PR)

### 1. Discount route — admin-only + audit every discount
File: `apps/staff-web/src/app/api/v1/orders/[id]/discount/route.ts`
- Replace `verifyStaff(request)` with `verifyAdmin(request)` (line ~29).
- Update the `applyDiscount(...)` call to drop `callerRole` (the role-cap
  branch is going away).

File: `apps/staff-web/src/lib/services/discount-service.ts`
- Remove `getDiscountCapForRole` and the role-based cap branch (~lines 86-91).
- Remove the threshold check that currently gates audit-log writes. EVERY
  discount must write to `financial_audit_log` (admin/owner only can apply
  them now, but the trail is still required for finance reconciliation).
- Keep server-side absolute caps (e.g., max 100% for percentage, max
  order_total for fixed). These are sanity guards, not authorization.

File: `apps/staff-web/src/__tests__/discount-route.test.ts` (new or extend)
- waiter POST → 403
- kitchen POST → 403
- admin POST below previous threshold → 200 AND audit row written
- admin POST above 100% → 400

### 2. `assignWaiter` — route + role check
Currently a direct wrapper call: `db.orders.assignWaiter(orderId, waiterId)`.
- Add new route: `apps/staff-web/src/app/api/v1/orders/[id]/assign/route.ts`
  - `POST` body: `{ waiter_id: string | null }` (validated with Zod)
  - `verifyAdmin(request)` — only admin/owner can reassign
  - Use `getSupabaseAdmin()` to perform the UPDATE under elevated privileges
  - Return updated order via `jsonOk`
  - Use `handleRouteError` for error path
- Update the mutation: `packages/queries/src/mutations/use-order-mutations.ts`
  `useAssignWaiter` — replace the direct `db.orders.assignWaiter` call with
  `apiFetch('POST', \`/api/v1/orders/${orderId}/assign\`, { waiter_id })`.
  - For the staff-web web client: use the existing `apiRoutes`-style helper.
  - For mobile: update `apps/mobile/src/lib/api-routes.ts` to expose the new
    route. Confirm mobile builds.
- DELETE the `assignWaiter` method from `packages/api-client/src/wrapper/orders.ts`.
  No code outside the new route should access this path.

File: tests
- `apps/staff-web/src/__tests__/assign-waiter-route.test.ts` (new):
  waiter → 403, admin → 200, missing waiter_id field → 400.

### 3. Rename `useCanMutate` → `useIsOnline` + add real authz hook
File: `apps/staff-web/src/hooks/use-can-mutate.ts`
- Rename file to `apps/staff-web/src/hooks/use-is-online.ts`.
- Rename the export to `useIsOnline`.
- Update every consumer (grep `useCanMutate`).
- Add NEW file `apps/staff-web/src/hooks/use-can-perform.ts`:
  ```ts
  export type Action = 'edit_menu' | 'apply_discount' | 'issue_refund'
    | 'assign_waiter' | 'edit_settings' | 'manage_staff' | 'manage_tables'
    | 'manage_tasks' | 'manage_stock' | 'manage_expenses';
  const ADMIN_ONLY: Action[] = [
    'edit_menu','apply_discount','issue_refund','assign_waiter',
    'edit_settings','manage_staff','manage_tables','manage_stock','manage_expenses',
  ];
  export function useCanPerform(action: Action): boolean {
    const role = useAuthStore((s) => s.staff?.role);
    if (!role) return false;
    if (ADMIN_ONLY.includes(action)) return role === 'admin' || role === 'owner';
    return true;
  }
  ```
- Replace the inline `staff?.role === 'admin' || staff?.role === 'owner'`
  expressions in:
  - `apps/staff-web/src/app/(staff)/tables/page.tsx`
  - `apps/staff-web/src/app/(staff)/tasks/page.tsx`
  - `apps/staff-web/src/app/(staff)/expenses/page.tsx`
  - `apps/staff-web/src/app/(staff)/stock/page.tsx`
  - `apps/staff-web/src/app/(staff)/cafe-settings/page.tsx`
  …with `useCanPerform('manage_<x>')`.
- Document in CLAUDE.md (Hooks section): `useIsOnline` for connectivity gates,
  `useCanPerform(action)` for authz gates. Inline `role === 'admin'` checks
  are forbidden going forward.

## Out of scope
- Cache work (Agent 1)
- Migrations / triggers / indexes (Agent 3)
- Realtime + kitchen rerenders (Agent 4)

## Acceptance
- `pnpm check`, `pnpm type-check`, `pnpm test --filter=staff-web --filter=@gustri/queries` green.
- Mobile build still passes (`pnpm --filter mobile type-check`).
- E2E: waiter cannot apply a discount via DevTools `fetch` (returns 403).
- `git grep -nE "useCanMutate|staff\\?\\.role === 'admin'"` returns no live code.
- `git grep -n "db\\.orders\\.assignWaiter"` returns nothing.
```

---

## Agent 3 — Database hardening

```
You are landing three database fixes from the second-pass staff-web audit:
1. Payment trigger must reject inserts on closed/cancelled orders.
2. Order-item partial cancel must be atomic (RPC, not client-side
   read-modify-write).
3. Missing composite index on `orders(tenant_id, created_at DESC)` for the
   30-day dashboard query.

DO NOT TOUCH frontend code or authorization (other agents own those). Stay in
`supabase/migrations/` and the relevant wrapper file. Mobile uses the same
wrapper, so verify mobile build at the end.

## Scope (one PR)

### 1. Payment trigger — reject closed/cancelled orders
Migration name: `supabase/migrations/<TODAY>_payment_reject_closed_orders.sql`
(use today's date in `YYYYMMDDNNNNNN_` format per CLAUDE.md Migration Rule).

- Locate the existing `validate_payment_amount` trigger function (added in
  `20260503000003_*.sql`). Do NOT edit that migration.
- New migration: `CREATE OR REPLACE FUNCTION validate_payment_amount()` with
  the same lock semantics PLUS:
  ```sql
  IF v_order_status IN ('closed','cancelled') THEN
    RAISE EXCEPTION 'Cannot record payment for order in status %', v_order_status
      USING ERRCODE = 'check_violation';
  END IF;
  ```
  Place this check AFTER the `SELECT ... FOR UPDATE` lock, BEFORE the
  total-paid recompute.
- The trigger binding stays the same — `CREATE OR REPLACE` is enough.

Test: `packages/api-client/src/__tests__/payment-on-closed-order.test.ts` (new)
- Create order, close it, attempt to insert order_payment → expect
  `ConflictError` (mapped from `check_violation`).
- Create order, leave open, attempt payment → succeeds.

### 2. Order-item partial cancel as RPC
Migration: `supabase/migrations/<TODAY>_cancel_order_item_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION cancel_order_item_qty(
  p_order_item_id uuid,
  p_cancel_qty integer
) RETURNS order_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row order_items;
BEGIN
  SELECT * INTO v_row FROM order_items
    WHERE id = p_order_item_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_item not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_row.status IN ('cancelled','served') THEN
    RAISE EXCEPTION 'cannot cancel order_item in status %', v_row.status
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_cancel_qty <= 0 OR p_cancel_qty > v_row.quantity THEN
    RAISE EXCEPTION 'invalid cancel quantity' USING ERRCODE = 'check_violation';
  END IF;
  IF p_cancel_qty = v_row.quantity THEN
    UPDATE order_items SET status = 'cancelled', updated_at = now()
      WHERE id = p_order_item_id RETURNING * INTO v_row;
  ELSE
    UPDATE order_items
      SET quantity = quantity - p_cancel_qty, updated_at = now()
      WHERE id = p_order_item_id RETURNING * INTO v_row;
  END IF;
  RETURN v_row;
END;
$$;
-- Tenant isolation enforced by RLS on order_items + check that caller is
-- staff of the same tenant. Wrapper passes tenant context via auth.uid().
GRANT EXECUTE ON FUNCTION cancel_order_item_qty TO authenticated;
```

Wrapper change: `packages/api-client/src/wrapper/order-items.ts`
- Replace the SELECT → mutate-in-JS → UPDATE block (the existing `cancel`
  partial-cancel branch, ~lines 67-113) with a single RPC call:
  `await ctx.client.rpc('cancel_order_item_qty', { p_order_item_id, p_cancel_qty })`.
- Map errors via `handleSupabaseError`. Keep the full-cancel branch as-is if
  it's already a single UPDATE (review and consolidate if not).

Regenerate types: `pnpm db:types:generate` and commit
`packages/database/src/types/generated.ts`.

Test: `packages/api-client/src/__tests__/order-item-cancel.test.ts` (new or
extend) — concurrent partial-cancel + status update via Promise.all; assert
no lost updates.

### 3. Composite index for orders dashboard
Migration: `supabase/migrations/<TODAY>_orders_tenant_created_index.sql`

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_tenant_created_at
  ON orders (tenant_id, created_at DESC);
```

Note: `CREATE INDEX CONCURRENTLY` cannot run inside a transaction. Confirm
your migration runner supports it (Supabase CLI does; if not, split into a
non-transactional migration file).

No type regeneration needed (indexes don't affect types).

## Out of scope
- Cache / query keys (Agent 1)
- Authz routes (Agent 2)
- Realtime catch-up (Agent 4)

## Acceptance
- `pnpm db:reset` succeeds with new migrations.
- `pnpm db:types:check` clean (committed types match live schema).
- `pnpm test --filter=@gustri/api-client` green.
- Manual probe: `EXPLAIN ANALYZE SELECT * FROM orders WHERE tenant_id = '<uuid>' AND created_at >= now() - interval '30 days';` uses `idx_orders_tenant_created_at`.
- Mobile typecheck still green: `pnpm --filter mobile type-check`.
```

---

## Agent 4 — Realtime catch-up, kitchen rerenders, dedupe coverage

```
You are landing three operational-resilience fixes from the second-pass
staff-web audit:
1. Realtime reconnect drops events emitted during the gap; the unused
   `lastEventAtRef` should be consumed on resubscribe.
2. Kitchen page force-rerenders the entire screen every 60s for elapsed-time
   refresh — push the timer into a leaf component.
3. `/api/v1/*` mutations have inconsistent dedupe / rate-limit coverage —
   apply the existing dedupe pattern uniformly.

DO NOT TOUCH cache, authz, or DB schema. This PR is purely staff-web frontend
+ minor route additions.

## Scope (one PR)

### 1. Realtime catch-up on reconnect
File: `apps/staff-web/src/hooks/use-realtime-sync.ts`

Currently `lastEventAtRef` is updated at line ~90 but never read.

- On successful resubscribe (status === 'SUBSCRIBED' AND
  `retryCountRef.current > 0` — i.e., this is a reconnect, not a fresh
  subscribe), fire `invalidateAll()` immediately to refetch the affected
  query keys. Reset `retryCountRef.current` to 0 AFTER calling invalidate so
  the path is taken exactly once per reconnect.
- Keep `lastEventAtRef` updates as-is. We use the reconnect signal, not the
  timestamp itself, so the ref is now informational only — leave a one-line
  comment explaining why we still maintain it (future: per-table `since=`
  filtering when Supabase exposes it).

Test: `apps/staff-web/src/__tests__/hooks/use-realtime-sync.test.ts`
- Extend with: subscribe → fire CHANNEL_ERROR → reconnect → assert
  `queryClient.invalidateQueries` called for every queryKey in `tables`.

### 2. Kitchen elapsed-time leaf component
File: `apps/staff-web/src/app/(staff)/kitchen/page.tsx`
- Remove the `useReducer` force-rerender at line ~48 and the `setInterval`
  at lines ~52-56.
- Identify where elapsed-time is rendered (likely inside `OrderListCard` or
  a sibling component).
- Add a new component
  `apps/staff-web/src/components/kitchen/elapsed-time.tsx`:
  ```tsx
  'use client';
  import { useEffect, useState } from 'react';
  import { formatDistanceToNow } from 'date-fns';
  export function ElapsedTime({ since }: { since: string | Date }) {
    const sinceDate = typeof since === 'string' ? new Date(since) : since;
    const [, tick] = useState(0);
    useEffect(() => {
      const id = setInterval(() => tick((n) => n + 1), 30_000);
      return () => clearInterval(id);
    }, []);
    return <>{formatDistanceToNow(sinceDate, { addSuffix: true })}</>;
  }
  ```
- Replace inline elapsed-time rendering in the kitchen tree with `<ElapsedTime since={order.created_at} />`. Now only the leaf re-renders, not the whole page.

### 3. Dedupe coverage audit on `/api/v1/*`
For each POST/PATCH route under `apps/staff-web/src/app/api/v1/**/route.ts`,
check whether it uses the `dedupe` helper from
`apps/staff-web/src/lib/api/dedupe.ts`. Apply the dedupe pattern to:
- `apps/staff-web/src/app/api/v1/orders/[id]/discount/route.ts` (after
  Agent 2 lands `verifyAdmin`)
- `apps/staff-web/src/app/api/v1/stock/**` (any mutation route)
- Any other route that performs a mutation but does not currently dedupe

For routes that legitimately should NOT dedupe (idempotent reads, GET, status
probes), add a one-line comment explaining why.

Update `apps/mobile/src/lib/api-routes.ts` to send `client_request_id` for
the newly-deduped endpoints (mirror the orders pattern).

Test: `apps/staff-web/src/__tests__/dedupe-coverage.test.ts` (new) — for
each mutation route, replay the request twice with the same
`client_request_id` and assert the same row id is returned, no duplicate
inserted.

## Out of scope
- Cache (Agent 1)
- Authz route changes other than dedupe layering (Agent 2)
- DB triggers / indexes (Agent 3)

## Acceptance
- `pnpm check`, `pnpm type-check`, `pnpm test --filter=staff-web` green.
- Manual: kitchen page open with React DevTools Profiler — only `ElapsedTime`
  leaves re-render every 30s, not the order cards.
- Manual: stop the local Supabase Realtime container for 10s, restart;
  observe an explicit refetch on reconnect (network tab or console log).
- Replay test for every covered mutation route returns the original row.
```

---

## Final notes for the implementing agent(s)

- After every prompt: `pnpm check`, `pnpm type-check`, `pnpm test --filter=<touched>`.
- DB changes (Agent 3): always `pnpm db:types:generate` and commit the regenerated file.
- One PR per agent. Do NOT bundle Agent 1 with Agent 2 — review focus differs (cache identity vs authorization).
- Before merging Agent 2 — coordinate with the mobile owner; both fixes touch `apps/mobile/src/lib/api-routes.ts`.
- After all four agents merge, re-run `/security-review` on `main` to verify no regressions, and re-run the second-pass audit prompt to confirm findings #1-#10, #12-#14 are closed.
- Findings #11 (orders 30-day window) and #15 (PDF export off main thread) are deferred to a product-side decision and a separate Web Worker spike, respectively.
