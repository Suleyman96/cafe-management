  # Package architecture — implementation roadmap

> Companion to `10-PACKAGE-ARCHITECTURE-DEFERRED.md` (the *catalog* of
> findings). This file is the *plan* — what to ship, in what order, with
> concrete steps and success criteria. Update as items land.
>
> **Status:** single-tenant launch architecture fixes shipped on
> 2026-04-28 (C2, C3, C4-soft, H3, C1-CI-gate, H2, M2, L4). Remaining work
> is grouped into three PR-sized batches below.

---

## Status legend

- ✅ Done
- 🟡 Ready (specs locked, can be picked up)
- ⚪ Blocked / waiting on a trigger event

---

## Batch A — Tenant-#2 readiness PR (~1 week, hard gate)

**Trigger:** opened the moment tenant #2 onboarding is on the roadmap.
**Why bundled:** all four items touch the wrapper layer or DB types.
Doing them in separate PRs causes three rounds of conflict resolution in
`packages/api-client/src/wrapper/`.

### A1 (= H0). Replace hand-written `database.ts` with generator output ✅ Done 2026-05-01
`packages/database/src/types/database.ts` is now an overlay over
`./generated.ts`. The overlay preserves:

- CHECK-constraint narrowings (`orders.status`, `tables.status`,
  `payment_method`, etc.) the generator can't infer.
- Default-populated non-null assertions (`created_at`, `updated_at`,
  `is_active`) the wrapper layer and UI rely on. Documented inline.

The CI `db-types-check` gate has been flipped from `continue-on-error`
to required. Drift between the live schema and the committed types now
fails the PR.

---

### A2 (= H1). Domain `Subscription` interface for realtime ✅ Done 2026-04-30
**Why now:** every realtime caller currently imports `RealtimeChannel`
from `@supabase/supabase-js`. With tenant #2 the realtime channel filter
needs to be tenant-scoped *and* the public type stops being Supabase-y.

**Steps:**
1. In `packages/api-client/src/wrapper/realtime.ts`:
   ```ts
   export interface Subscription {
     unsubscribe(): void;
   }

   function toSubscription(channel: RealtimeChannel): Subscription {
     return { unsubscribe: () => { channel.unsubscribe(); } };
   }
   ```
2. Change every `subscribeTo*` return type from `RealtimeChannel` to
   `Subscription`. The internal channel stays for `.on(...)` chaining.
3. Search consumers for `removeChannel(...)` / `.unsubscribe()` and
   migrate to the new shape. Likely call sites:
   - `apps/staff-web/src/components/providers/notification-provider.tsx`
   - `apps/staff-web/src/components/orders/realtime-orders-provider.tsx`
     (if it exists — grep `subscribeToOrders`)
   - `apps/customer-web/` order-tracking screens
   - `apps/mobile/` waiter call & order screens
4. Remove the `RealtimeChannel` re-export from
   `packages/api-client/src/wrapper/realtime.ts`. The provider leak is
   now zero.
5. Delete the H1 entry from `plans/10-PACKAGE-ARCHITECTURE-DEFERRED.md`
   and the JSDoc warning at the top of `realtime.ts`.

**Success criteria:**
- `grep -rn "RealtimeChannel" apps/` returns zero hits.
- All realtime tests pass.
- Manual: subscribe → mutate → callback fires; unsubscribe → mutate → no
  callback.

**Estimate:** half day.

---

### A3 (= H5). Wrapper-level defense-in-depth tenant filter ✅ Done 2026-05-01
`WrapperContext` carries an optional `TenantContext` populated by each
app's auth flow. The shared helpers in
`packages/api-client/src/wrapper/_tenant-scope.ts`:

- `applyTenantScope(query, ctx, options?)` appends
  `.eq('tenant_id', tenantId)` when bound, or skips with a dev-only
  Sentry warning when null. `{ allowNull: true }` silences the warning
  on legitimate anon paths (QR menu browse, table lookup, customer
  feedback create, etc.).
- `assertInsertTenantMatches(payload, ctx)` throws
  `AuthorizationError` if the payload's `tenant_id` mismatches the
  bound context.

Tests: `packages/api-client/src/__tests__/tenant-context.test.ts`
(7 cases — read with bound tenant, read with null tenant + dev
warning, insert mismatch throws, insert match passes).

---

### A4 (= M6). Typed RPC bindings ✅ Done 2026-04-30
**Why now:** depends on A1 (generator output includes
`Database['public']['Functions']`). Bundle them.

**Steps:**
1. After A1, `Database['public']['Functions']` exists with full RPC arg
   and return types.
2. Create `packages/api-client/src/wrapper/rpc-typed.ts`:
   ```ts
   export type RpcName = keyof Database['public']['Functions'];
   export type RpcArgs<N extends RpcName> = Database['public']['Functions'][N]['Args'];
   export type RpcReturns<N extends RpcName> = Database['public']['Functions'][N]['Returns'];

   export async function rpc<N extends RpcName>(
     ctx: WrapperContext,
     name: N,
     args: RpcArgs<N>,
   ): Promise<RpcReturns<N>> {
     const { data, error } = await ctx.client.rpc(name, args);
     if (error) throw handleSupabaseError(error);
     return data as RpcReturns<N>;
   }
   ```
3. Replace `ctx.anyClient.rpc(...)` call sites in:
   - `orders.ts:cleanupEmptyOrders`
   - `rpc.ts:getRemainingBalance`
   - `views.ts` (any RPC-backed views)
   - `customer-web/src/lib/supabase.ts:setTableContext`
4. Remove `anyClient` from `WrapperContext` if no other call sites
   remain (likely a few view queries still need it — leave those, just
   audit).
5. Delete or trim `packages/api-client/src/wrapper/rpc.ts` if its
   wrapper methods become identical to `rpc(ctx, name, args)` calls.

**Success criteria:**
- Hovering over any `.rpc('name', { ... })` call shows full arg types.
- Passing wrong arg types fails at compile time, not runtime.
- All RPC tests pass.

**Estimate:** 1 day.

---

### Batch A landing checklist

- [x] A2 (Subscription interface) — 2026-04-30
- [x] A4 (typed RPC bindings) — 2026-04-30. Built on the existing
  `Database['public']['Functions']` shape rather than blocking on A1; the
  helper signature is correct in either case.
- [x] A1 (replace hand-written `database.ts`) — 2026-05-01. Shipped as
  an overlay (not naked re-export) that preserves CHECK-constraint
  narrowings and DB-default non-null assertions. CI gate now required.
  Original deferral rationale was: a naked `export * from './generated'` would weaken
  this needs its own focused PR with either: (a) an overlay layer that
  preserves narrowings on top of `generated.ts`, or (b) accepting the
  narrowing loss and patching consumers. Soft CI gate (`db-types-check`)
  already detects column drift today.
- [x] A3 (defense-in-depth tenant filter) — 2026-05-01. Helper +
  context plumbing applied across every wrapper that reads a
  tenant-scoped table. App-level factories bind the tenant after
  auth. Tests at `packages/api-client/src/__tests__/tenant-context.test.ts`.
- [ ] After all four: `pnpm check`, `pnpm test`, `pnpm type-check` all
  green; CI's `db-types-check` job is required (no `continue-on-error`).
- [ ] Update `plans/10` — move H0/H1/H5/M6 to "Quick reference — fixed".
  H1 and M6 already moved 2026-04-30.
- [ ] Add a CHANGELOG entry: "Tenant-#2 readiness — wrapper boundary
  hardening, typed RPCs, generated DB types."

---

## Batch B — Bundle-size pass (~3 days)

**Trigger:** measurable pain — Edge cold starts > 800ms, mobile bundle
> 50MB, or someone notices `@gustri/database` is in a server-only route.
**Why bundled:** all three items move imports without changing semantics.
One Biome pass fixes import sorting for the whole batch.

### B1 (= H4). Subpath exports for `@gustri/database` 🟡
**Steps:**
1. Update `packages/database/tsup.config.ts` to emit per-subpath bundles:
   - `dist/types/index.{js,mjs,d.ts}` — types only, zero zod
   - `dist/schemas/index.{js,mjs,d.ts}` — Zod schemas
   - `dist/enums/index.{js,mjs,d.ts}` — enum const objects
   - `dist/index.{js,mjs,d.ts}` — barrel (existing, kept for compat)
2. Update `packages/database/package.json`:
   ```json
   "exports": {
     "./types":   { "types": "./dist/types/index.d.ts",   "import": "./dist/types/index.mjs",   "require": "./dist/types/index.js" },
     "./schemas": { "types": "./dist/schemas/index.d.ts", "import": "./dist/schemas/index.mjs", "require": "./dist/schemas/index.js" },
     "./enums":   { "types": "./dist/enums/index.d.ts",   "import": "./dist/enums/index.mjs",   "require": "./dist/enums/index.js" },
     ".":         { ... existing ... }
   }
   ```
3. Migrate type-only consumers gradually:
   - Run `grep -rn "from '@gustri/database'" apps/` — for each hit, if it
     only uses types, change to `from '@gustri/database/types'`.
   - Server-only routes touching schemas: `from '@gustri/database/schemas'`.
4. Keep the barrel — don't break consumers that need both types + schemas.

**Success criteria:**
- Bundle analyzer (`pnpm analyze`) shows Zod is no longer pulled into
  routes that only import types.
- Type-only consumers' bundles shrink (measure on
  `apps/customer-web/.next/analyze/`).

**Estimate:** half day.

---

### B2 (= M4). Per-domain subpath exports for `@gustri/api-client` 🟡
**Steps:**
1. Update `packages/api-client/tsup.config.ts` to emit per-domain
   entrypoints (`orders`, `menu`, `payments`, …) plus the existing
   barrel. Use a `multipleEntrypoints` config.
2. Update `packages/api-client/package.json` `exports` similarly.
3. Apps that don't need the full surface (esp. `customer-web` and
   marketing) migrate to subpath imports.

**Success criteria:**
- `customer-web` no longer pulls `expensesWrapper`, `staffWrapper`, etc.
  Type graph reduction visible in `tsc --traceResolution`.

**Estimate:** half day. Mostly mechanical.

---

### B3. Capture bundle baselines 🟡
**Steps:**
1. Before B1/B2 land, capture bundle sizes:
   ```bash
   pnpm analyze
   du -sh apps/staff-web/.next apps/customer-web/.next
   ```
2. Save to `plans/baselines/bundle-sizes-pre-batch-b.txt`.
3. After B1/B2, capture again. Diff in PR description.

**Estimate:** 30 min.

---

## Batch C — Developer ergonomics (~3 days, opportunistic)

**Trigger:** team friction. Each item ships when its specific pain
shows up — no need to bundle.

### C1 (= M1). Per-hook policy overrides in `@gustri/queries` ⚪
**Trigger:** the second time a developer writes a `-safe` wrapper purely
to override `staleTime`/`enabled`/`select`.

**Design:**
- Each read hook accepts `options?: { staleTime?, enabled?, select?, retry? }`.
- Defaults come from a `QueryDefaultsProvider` at app root.

**Steps:**
1. Add `QueryDefaultsContext` in `packages/queries/src/provider.tsx`.
2. Refactor one hot hook (`useOrders`) as the pattern, then propagate.
3. Delete the `-safe` wrappers that exist *only* for this reason.

**Estimate:** 1 day.

---

### C2 (= M3). Optimistic updates on hot mutations ⚪
**Trigger:** staff complaint about UI lag at busy hours, or load test
showing realtime-driven refetches at >5/sec per session.

**Targets (in priority order):**
1. `useUpdateOrderItemStatus` — busiest mutation; kitchen-side updates
   feel instant after.
2. `useUpdateTableStatus` — table list re-renders are visible.
3. `useResolveWaiterCall` — single-row toggle, easy to roll back.

**Steps per mutation:**
1. Add `onMutate` that calls `queryClient.cancelQueries(...)` then
   `queryClient.setQueryData(...)` to apply the optimistic update.
2. Return `previousData` from `onMutate`.
3. Add `onError` that rolls back via `queryClient.setQueryData(..., previousData)`.
4. Keep `onSuccess` invalidation as the final reconciliation.
5. Test: assert that during `mutationFn` rejection, cache returns to
   `previousData`.

**Estimate:** 1 day for all three.

---

### C3 (= M5). `/api/v1/*` versioning consistency ✅ Done 2026-05-02 (PR #77)
All three legacy routes (`/api/staff`, `/api/staff/reset-password`,
`/api/schedules/clock`) moved under `/api/v1/`. Five internal callers
updated. No 308 stubs — auth-gated admin endpoints with no plausible
external caller. Mobile and customer-web don't reference these paths.

**Trigger:** before introducing `/v2/*`, OR when a new client has to
shim around the inconsistent prefix.

**Steps:**
1. Move under `/api/v1/`:
   - `apps/staff-web/src/app/api/staff/route.ts` →
     `apps/staff-web/src/app/api/v1/staff/route.ts`
   - `apps/staff-web/src/app/api/staff/reset-password/route.ts`
   - `apps/staff-web/src/app/api/schedules/clock/route.ts`
2. Keep `/api/health` outside `/v1/` — infra-facing, not client-facing.
3. Update `apiRoutes` in `apps/mobile/src/lib/api-routes.ts` to point
   at the new paths.
4. Add 308 redirects from old paths if any external caller still uses
   them (probably none).

**Success criteria:** every fetchable path used by web/mobile clients
starts with `/api/v1/`.

**Estimate:** half day.

---

## Backlog — no urgency

Land naturally during related work. Don't schedule a sprint.

### L1. Split `@gustri/queries` into framework-agnostic + React adapter ⚪
**Trigger:** considering Solid/Vue, OR test job pain caused by RTL pull.
**Estimate:** multi-quarter. Probably never justified.

### L2. Internal subfolders in `@gustri/core` ⚪
**Trigger:** core file count exceeds ~15.
**Steps:** `calculations/`, `errors/`, `validation/`, `type-guards/`.
Pure file moves + barrel exports. Biome will resort imports.
**Estimate:** half day.

### L3. Domain DTO layer between wrapper and UI ⚪
**Trigger:** introducing a column the UI must NOT see (PII, internal
flag), OR computed fields needed in 3+ places.
**Steps:** introduce `Order` (domain) distinct from `OrderRow` (DB) at
the wrapper boundary. Phased rollout per wrapper.
**Estimate:** 1 week. High blast radius — defer until forced.

### L4. Add JSDoc to remaining wrapper public methods ✅ (partial)
JSDoc added in 2026-04 for `orders.updateStatus`, `orders.applyDiscount`,
`orders.cleanupEmptyOrders`, `order-items.cancel`,
`tasks.getRecurringTemplates`, `tasks.generateRecurringTasks`,
`payments.create`, plus the realtime module-level note. Continue
opportunistically when touching other wrappers.

---

## Out of scope (do not ship)

These were in the audit but should NOT be done:

- **Refactoring `lib/services/*` to wrappers.** They're server-side
  helpers under `/api/v1/*` (CLAUDE.md Exception 2). The original audit
  miscategorized them. The wrapper-boundary CI gate already protects
  against new client-side leaks.
- **Removing `anyClient` from `WrapperContext`.** Some Supabase view
  queries genuinely need the untyped client — the typed `Database`
  generic doesn't cover views. Replace per-call as types catch up,
  don't blanket-remove.

---

## Done (reference)

For the index of items already shipped, see the bottom table of
`plans/10-PACKAGE-ARCHITECTURE-DEFERRED.md` ("Quick reference — fixed
inline").
