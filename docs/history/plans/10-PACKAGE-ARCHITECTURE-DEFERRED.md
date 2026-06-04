  # Package architecture — deferred findings

> Carried over from the architecture audit on 2026-04-28. The single-tenant
> blocking items were addressed inline (C1–C4 from the audit, H2, H3). The
> findings below were intentionally deferred because they only matter at
> multi-tenant scale, are bundle-size optimizations, or require a wider
> refactor than the current launch window allows.
>
> **Hard gate:** before onboarding tenant #2, every High item in this file
> must be fixed or explicitly waived. Bundle-size and polish items can ship
> incrementally.
>
> **Implementation plan:** see
> [`11-PACKAGE-ARCHITECTURE-ROADMAP.md`](./11-PACKAGE-ARCHITECTURE-ROADMAP.md)
> for concrete steps, ordering, and PR-sized batches.

---

## Status legend

- 🟠 High — multi-tenant or provider-swap concern
- 🟡 Medium — correctness / scale / DX
- 🟢 Low — quality / future-proofing

---

## 🟠 High

### ~~H0. Replace hand-written `database.ts` with generator output~~ ✅ Closed 2026-05-01
[packages/database/src/types/database.ts](../packages/database/src/types/database.ts)
is now an overlay over `./generated.ts` (regenerated via
`pnpm db:types:generate`). The overlay preserves CHECK-constraint
narrowings (e.g., `orders.status`, `payment_method`) and the
default-populated non-null assertions (`created_at`, `updated_at`,
`is_active`) the wrapper layer and UI relied on. The
`db-types-check` CI gate is now required (no `continue-on-error`).

---

### ~~H1. `RealtimeChannel` leaks into `@gustri/api-client` public surface~~ ✅ Closed 2026-04-30
[packages/api-client/src/wrapper/realtime.ts](../packages/api-client/src/wrapper/realtime.ts)
now exports a domain `Subscription { unsubscribe(): void }` interface and
returns it from every `subscribeTo*` method. The internal `RealtimeChannel`
is held inside `toSubscription(ctx, channel)`, which combines
`channel.unsubscribe()` and `ctx.client.removeChannel(channel)` for a
full teardown. Public API surface no longer leaks
`@supabase/supabase-js` types from the realtime wrapper. The standalone
`realtime.unsubscribe(channel)` method has been removed; consumers call
`subscription.unsubscribe()` instead. App-level realtime code (e.g.
`use-realtime-sync.ts`, `notification-provider.tsx`) still uses the raw
`supabase` client by design (CLAUDE.md Exception 1).

---

### H4. Single barrel export from `@gustri/database` bundles Zod everywhere
**Where:** [packages/database/package.json](../packages/database/package.json)

Only `.` is exposed. Any code that imports a *type* (e.g., `Order` in an
Edge route, a server util, a mobile screen) drags the whole barrel
through tsup, including all 70 Zod schemas. A type-only consumer pays
the validator weight.

**Fix:** subpath exports.
```json
"exports": {
  "./types":   { "types": "./dist/types/index.d.ts",   "import": "./dist/types/index.js" },
  "./schemas": { "types": "./dist/schemas/index.d.ts", "import": "./dist/schemas/index.js" },
  "./enums":   { "types": "./dist/enums/index.d.ts",   "import": "./dist/enums/index.js" },
  ".":         { "types": "./dist/index.d.ts",         "import": "./dist/index.js" }
}
```
Update tsup to emit per-subpath bundles. Migrate type-only imports
across apps over time.

---

### ~~H5. Wrapper has no defense-in-depth tenant filter~~ ✅ Closed 2026-05-01
The wrapper context now carries an optional `tenantContext: { tenantId, setTenantId }`,
and a shared `applyTenantScope(query, ctx, options?)` helper appends
`.eq('tenant_id', tenantId)` to every read on tenant-scoped tables. Inserts
that include `tenant_id` are validated against the bound context via
`assertInsertTenantMatches`, throwing `AuthorizationError` on mismatch.
Each app-level factory binds the tenant after auth:

- `apps/staff-web/src/hooks/use-auth.ts` — calls `db.setTenantContext(staff.tenant_id)`
  in `loadStaffAndSetup`; `stableLogout` clears it.
- `apps/mobile/src/lib/auth.ts` — `getCurrentUser` binds; `cleanupClientState` clears.
- `apps/customer-web/src/lib/supabase.ts` — anon QR session binds via
  `setTableContext()` after the table-row lookup.

Reads that legitimately run before a tenant is bound (anon menu/category
browse, `tables.findByQrCode`, `cafe_settings.get`, customer order/feedback
RPCs) pass `{ allowNull: true }` so they don't trip the dev-only Sentry
warning. RLS remains the primary boundary; this is the belt-and-braces
layer (H5/A3).

---

## 🟡 Medium

### M1. `@gustri/queries` hooks hardcode policy
**Where:** every read hook in [packages/queries/src/hooks/](../packages/queries/src/hooks/)

`staleTime: 5 * 60 * 1000` is hardcoded per hook. Customer-web (menu
freshness during ordering), staff-web (active orders), and mobile
(background refresh) all want different policies. Apps work around with
the `-safe` wrapper convention, defeating the shared layer.

**Fix:** accept `options: { staleTime?, enabled?, select?, retry? }` per
hook and provide a `QueryDefaultsProvider` for app-level defaults.

---

### ~~M2. `-safe` hook promotion rule~~ ✅ Closed 2026-04-28
Documented in CLAUDE.md → "Hooks" section. The `-safe` suffix is now
gated by three explicit criteria (apiRoutes, app-specific UI state, or
plan-gated behavior); anything else uses `@gustri/queries` directly.
Promotion path to `@gustri/queries` documented as well.

---

### M3. No optimistic updates anywhere in `@gustri/queries`
For waiter calls, table status, kitchen-side order item status — places
where realtime + optimistic UI is the right pattern — every mutation is
invalidate-on-success only. Realtime then refetches. Works at one cafe;
awful at 1k concurrent tables across tenants.

**Fix:** add `onMutate` + `setQueryData` to the highest-frequency
mutations: `useUpdateOrderItemStatus`, `useUpdateTableStatus`,
`useResolveWaiterCall`. Use `onError` to roll back.

---

### M4. `SupabaseWrapper` aggregates all 23 wrappers in every consumer
**Where:** [packages/api-client/src/wrapper/index.ts](../packages/api-client/src/wrapper/index.ts)

Lazy getters at runtime, but the *type* surface still pulls all 23 in.
Customer-web doesn't need `expensesWrapper`, `staffWrapper`,
`refundsWrapper`, but its bundle's type graph still touches them.

**Fix:** subpath exports per domain (`@gustri/api-client/orders`,
`@gustri/api-client/menu`, …). Each app imports only what it needs. The
aggregator stays for staff-web's broad surface.

---

### M5. `/api/v1/*` versioning is half-applied
**Where:** [apps/staff-web/src/app/api/](../apps/staff-web/src/app/api/)

Routes like `/api/staff/reset-password`, `/api/health`,
`/api/schedules/clock` sit outside `/api/v1/*`. The "v1" prefix becomes
meaningless if it's not consistent. Future v2 split is harder.

**Fix:** move all client-facing routes under `/api/v1/`. Keep
`/api/health` separate (infra-facing). Update mobile `apiRoutes`
accordingly.

---

### ~~M6. RPCs called via `ctx.anyClient.rpc(...)`~~ ✅ Closed 2026-04-30
Replaced by a typed `rpc(ctx, name, args)` helper at
[packages/api-client/src/wrapper/rpc-typed.ts](../packages/api-client/src/wrapper/rpc-typed.ts)
that constrains `name` to
`keyof Database['public']['Functions']`, infers `args` from
`Functions[name]['Args']`, and returns
`Functions[name]['Returns']` — with uniform error mapping via
`handleSupabaseError`. All 11 `ctx.anyClient.rpc(...)` call sites in
`reports.ts`, `tenants.ts`, `orders.ts:cleanupEmptyOrders`, and
`rpc.ts` have been migrated. The `anyClient` field on `WrapperContext`
remains for view queries that the typed `Database` doesn't cover, per
the plans/11 "Out of scope" guidance.

---

## 🟢 Low

### L1. `@gustri/queries` tests pull React DOM into CI
The `renderHookWithProviders` test helper depends on `@testing-library/react`.
If the package were split into a framework-agnostic builder + a React
adapter, the builder could be tested in pure Node and CI would be faster.

**Fix:** split `@gustri/queries` into `@gustri/queries-core` (builders)
+ `@gustri/queries-react` (TanStack adapter). Multi-quarter task.

---

### L2. `@gustri/core` mixes domain calculations with UI helpers
`profit-metrics.ts`, `utils.ts` (tax calc), and `colors.ts` are all
flat at the package root. Once file count grows past ~10, internal
subfolders (`calculations/`, `errors/`, `validation/`) help readability.

---

### L3. No formal "domain type" vs "DB row type" distinction
`OrderRow` from the wrapper *is* the DB row. UI consumes it directly.
When you start hiding columns (PII, internal flags) the surface needs a
DTO layer that the wrapper produces.

**Fix later:** introduce `Order` (domain type) at the wrapper boundary;
keep `OrderRow` internal to `api-client`.

---

### L4. JSDoc on wrapper public APIs (partial) 🟡
JSDoc added in 2026-04 for the high-risk methods:
- `orders.updateStatus` — `served` rule + empty-order rule
- `orders.applyDiscount` — trigger collision (don't add `.select()`)
- `orders.cleanupEmptyOrders` — DB security M10 caveat
- `order-items.cancel` — partial vs full cancel branches
- `tasks.getRecurringTemplates` / `generateRecurringTasks` — local-time
  day-of-week math
- `payments.create` — when to use the route vs the wrapper
- `realtime` (module-level) — `RealtimeChannel` leak warning

**Remaining (opportunistic):** add JSDoc when touching other wrappers
that enforce non-obvious rules. No standalone PR needed.

---

## Operational follow-ups

- **Tenant-#2 gate:** before adding a second `public.tenants` row, run
  through this file and require sign-off on every High item.
- **Bundle-size measurement:** before fixing H4 / M4, capture a baseline
  bundle size for each app so the win is measurable.
- **Migration order:** H1 (Subscription wrapper) before H4 (subpath
  exports), since subpath exports change import sites and you want one
  rename per file, not two.

---

## Quick reference — fixed inline (audit 2026-04-28)

| Item | Fix |
|------|-----|
| C1   | Audit re-classified: `lib/services/*` are server-side helpers used only by `/api/v1/*` routes (CLAUDE.md Exception 2) and use `supabaseAdmin` (service-role) — not boundary violations. The actual app-side `supabase.from(` usage is the realtime fallback polling in `notification-provider.tsx` (annotated `Raw queries intentional` for performance). Added a CI grep gate (`Wrapper boundary`) that fails on new raw `.from(`/`.rpc(` in `apps/*/src/hooks/` and `apps/*/src/components/`, with documented exceptions for storage + the annotated realtime fallback. |
| C2   | Moved `handleSupabaseError` (and `httpStatusToAppError`) from `@gustri/core` → `@gustri/api-client/errors`; removed `navigator.onLine` |
| C3   | Moved `QUERY_KEYS` to `@gustri/queries`; moved `getRoleBadgeColor`/`getOrderStatusColor` to `@gustri/ui` |
| C4   | Added `pnpm db:types:generate` + `pnpm db:types:check`. Soft gate flipped to required as part of H0 (2026-05-01). |
| H0   | Replaced hand-written `database.ts` with an overlay over `generated.ts` that preserves CHECK-constraint narrowings and DB-default non-null assertions. CI `db-types-check` gate is now required. (2026-05-01) |
| H5   | Wrapper-level defense-in-depth tenant filter. New `applyTenantScope` / `assertInsertTenantMatches` helpers; `WrapperContext` carries a `TenantContext`; all three app-level factories bind/clear it on auth events. Tests at `packages/api-client/src/__tests__/tenant-context.test.ts`. (2026-05-01) |
| H1   | Added domain `Subscription` interface to `realtime.ts`; wrapper public surface no longer leaks `RealtimeChannel`. App-level raw realtime code preserved per CLAUDE.md Exception 1. |
| H2   | Added Biome / CI rule flagging hardcoded JSX text and `toast.*`/`Alert.alert(` literals not produced via `t(...)` |
| H3   | Split `orders.ts` (650 LOC) into `orders.ts` + `order-items.ts`; split `tasks.ts` similarly |
| M2   | Documented `-safe` hook promotion rule in CLAUDE.md (3 explicit criteria + promotion path to `@gustri/queries`) |
| M6   | Added typed `rpc(ctx, name, args)` helper at `wrapper/rpc-typed.ts`; migrated 11 `anyClient.rpc(...)` call sites for end-to-end RPC type safety. |
| L4 (partial) | Added JSDoc to high-risk wrapper methods (orders/order-items/tasks/payments/realtime). Remaining methods documented opportunistically. |
