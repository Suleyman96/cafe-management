# Tier 2 Implementation Prompt — Tenant-#2 Readiness

> Generated: 2026-05-01
> Context: Hand-off prompt for the next implementation agent.
> Scope: The "tenant-#2 hard gate" items from `plans/09-DB-SECURITY-DEFERRED.md`
> and `plans/10-PACKAGE-ARCHITECTURE-DEFERRED.md` /
> `plans/11-PACKAGE-ARCHITECTURE-ROADMAP.md`. These are the things that
> must ship before a second row goes into `public.tenants`.

---

## How to use this file

Paste the **Prompt** section below into a fresh agent session. It is
self-contained — no other context needed.

The work is structured as **three sequential PRs** (A → B → C). Don't
bundle. PR B depends on PR A's type changes (the wrapper needs the
generated `Database['public']` shape). PR C is independent SQL and can
ship before, after, or alongside the other two — sequence it last only
to keep migration numbering tidy.

---

## Prompt

You are a senior full-stack engineer working on Gustri (a Turborepo
monorepo: `apps/{staff-web,customer-web,marketing,mobile}` and
`packages/{database,core,api-client,queries,i18n,ui}`). Read
`/Users/kamilhajilov/Documents/github/cafe-idare/CLAUDE.md` first — it
documents the data-access boundary, hook placement, migration rules, and
i18n requirements you must follow.

You're picking up the **tenant-#2 readiness** work. Today the system
runs single-tenant; before inserting a second row into `public.tenants`,
the items below must ship. Almost all multi-tenant security findings
have already been closed (see `plans/09-DB-SECURITY-DEFERRED.md` —
migrations `20260428000001`, `20260430000002`, `20260501000001`).
What remains is the wrapper layer + a handful of DB hygiene items.

### Ground rules

- **Three PRs, in order: A → B → C.** PR B's wrapper changes assume
  PR A's regenerated types. PR C is SQL-only and independent.
- **Don't expand scope.** No drive-by refactors. If you find something
  that looks wrong but isn't on this list, leave a TODO comment with a
  one-line rationale and keep moving.
- **Follow CLAUDE.md.** Especially the migration rule (sequential
  filename `YYYYMMDDNNNNNN_short_snake_case.sql`, RLS in same migration,
  regenerate types via `pnpm db:types:generate` and commit the result;
  destructive changes need a paired rollback under
  `supabase/migrations/_rollbacks/`).
- **Verify before claiming done.** Each PR has explicit acceptance
  commands. Run them.
- **Never edit a migration that has been merged to `main`.** Add a new
  migration that alters/fixes.

---

## PR A — Replace hand-written `database.ts` with generator output (H0 / A1)

**Why now:** Today `packages/database/src/types/database.ts` is 729
lines of hand-written `Tables` / `Insert` / `Update` definitions. The
generated equivalent at `packages/database/src/types/generated.ts`
exists but isn't re-exported. Drift today silently ships wrong types.
The CI gate `db-types-check` is currently soft
(`continue-on-error: true` in `.github/workflows/ci.yml`).

**The trap to watch for:** the hand-written file narrows several
columns to string-union literals derived from CHECK constraints —
`status: 'free' | 'occupied' | 'reserved' | 'closed'`,
`payment_method: 'cash' | 'card' | 'digital'`, etc. The generator
emits these as `string`. A naked `export * from './generated'`
weakens `findAll({ status })` typing across ~30 wrapper methods. You
need an **overlay layer** that preserves the narrowings on top of the
generated shape.

**Files to touch:**
- `packages/database/src/types/database.ts` (rewrite as overlay)
- `packages/database/src/types/generated.ts` (regenerate; commit
  result)
- `packages/database/src/types/index.ts` (any extension types whose
  columns moved)
- `packages/database/src/schemas/inputs.ts` (likely Zod fixture tweaks
  if `Insert`/`Update` shapes shifted)
- `.github/workflows/ci.yml` (flip `db-types-check` from
  `continue-on-error: true` to required)

**Steps:**

1. Local Supabase: `supabase start && supabase db reset` to ensure all
   migrations applied.
2. `pnpm db:types:generate` — writes/updates
   `packages/database/src/types/generated.ts`.
3. Replace the body of
   `packages/database/src/types/database.ts` with an overlay pattern.
   Pseudocode:
   ```ts
   import type { Database as Generated, Json } from './generated';

   export type { Json };

   // Per-table column narrowings the generator can't infer from
   // CHECK constraints. Keep this list short — only narrow what the
   // wrapper layer or UI actually relies on.
   type TableNarrowings = {
     tables: { status: 'free' | 'occupied' | 'reserved' | 'closed' };
     order_payments: { payment_method: 'cash' | 'card' | 'digital' };
     orders: {
       status: 'pending_approval' | 'new' | 'preparing' | 'ready'
              | 'served' | 'out_for_delivery' | 'delivered'
              | 'closed' | 'cancelled';
       order_type: 'dine_in' | 'takeout' | 'delivery';
     };
     order_items: { status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled' };
     // …continue for the enums listed in CLAUDE.md "Enums" section
   };

   type ApplyNarrowing<T, N> = Omit<T, keyof N> & N;

   type NarrowedTables = {
     [K in keyof Generated['public']['Tables']]:
       K extends keyof TableNarrowings
         ? {
             Row: ApplyNarrowing<Generated['public']['Tables'][K]['Row'], TableNarrowings[K]>;
             Insert: Generated['public']['Tables'][K]['Insert'] & Partial<TableNarrowings[K]>;
             Update: Generated['public']['Tables'][K]['Update'] & Partial<TableNarrowings[K]>;
             Relationships: Generated['public']['Tables'][K]['Relationships'];
           }
         : Generated['public']['Tables'][K];
   };

   export type Database = Omit<Generated, 'public'> & {
     public: Omit<Generated['public'], 'Tables'> & { Tables: NarrowedTables };
   };
   ```
   The exact mechanism can vary — what matters is that the public
   `Database` type preserves the same column unions the wrapper layer
   already depends on. Use the existing hand-written file as the
   authoritative source for which columns to narrow; use CLAUDE.md
   "Enums" section as the cross-check list.
4. `pnpm build --filter='./packages/*'` — compile the package graph.
   Likely failure sites:
   - Wrapper `Insert` types where the generator differs from
     `Omit<Row, ...>` patterns. Update the wrapper signatures, not the
     overlay.
   - Zod schemas in `packages/database/src/schemas/inputs.ts` that
     reference now-renamed or now-different fields.
5. `pnpm type-check` and `pnpm test` — fix consumers as needed.
6. In `.github/workflows/ci.yml`, find the `db-types-check` job (it
   has a step "Verify generated types match schema" or similar with
   `continue-on-error: true`). Remove the `continue-on-error: true`
   line so the gate is required. Do **not** restructure the job.
7. Update `plans/10-PACKAGE-ARCHITECTURE-DEFERRED.md` and
   `plans/11-PACKAGE-ARCHITECTURE-ROADMAP.md`: move H0 / A1 to the
   "fixed" tables.

**Acceptance:**
- `pnpm db:types:check` passes locally.
- `pnpm build` passes (all packages + apps).
- `pnpm test` passes.
- `pnpm type-check` passes.
- A representative wrapper call like `db.tables.findAll({ status: 'free' })`
  still type-checks; passing `status: 'unknown'` fails at compile time.
- CI's `db-types-check` job is required (no `continue-on-error: true`).

**Rollback note:** If reconciling shape diffs blows up, ship as a
narrower scope: keep the hand-written file but add a CI step that
diffs it against the generator output and fails if they drift.
That's the "patched soft gate" fallback — document the choice in the
PR description and leave H0 open.

---

## PR B — Wrapper-level defense-in-depth tenant filter (H5 / A3)

**Why now:** RLS is the primary tenant boundary, but every deferred
DB-security finding is a reminder that a single bad migration could
let cross-tenant reads slip past. The wrapper layer adds belt-and-braces:
every read appends `.eq('tenant_id', ctx.tenantContext.tenantId)`
explicitly. If a future migration regression breaks RLS, the wrapper
still won't return another tenant's rows; in dev, a missing predicate
trips a Sentry warning so we catch drift during refactors.

**Files to touch:**
- `packages/api-client/src/wrapper/types.ts` — add `TenantContext`
  interface, extend `WrapperContext`.
- `packages/api-client/src/wrapper/index.ts` — `createSupabaseWrapper`
  accepts an optional `tenantId` and a `setTenantContext(id)` method.
- Every wrapper file under `packages/api-client/src/wrapper/` that
  has read methods — `orders.ts`, `order-items.ts`, `tables.ts`,
  `payments.ts`, `menu.ts`, `categories.ts`, `staff.ts`,
  `waiter-calls.ts`, `customer-feedback.ts`, `delivery-customers.ts`,
  `expenses.ts`, `expense-categories.ts`, `tasks.ts`, `task-categories.ts`,
  `stock-items.ts`, `stock-movements.ts`, `waste-logs.ts`,
  `staff-schedules.ts`, `cafe-settings.ts`, `tenants.ts`, `refunds.ts`,
  `app-versions.ts`, `feature-flags.ts`. (Verify the current list with
  `ls packages/api-client/src/wrapper/`.)
- App-level wrapper factories:
  - `apps/staff-web/src/lib/supabase/wrapped-client.ts` (or wherever
    `createSupabaseWrapper` is invoked — grep for it)
  - `apps/customer-web/src/lib/supabase.ts`
  - `apps/mobile/src/lib/supabase.ts`
- New: `packages/api-client/src/__tests__/tenant-context.test.ts`

**Design:**

```ts
// packages/api-client/src/wrapper/types.ts
export interface TenantContext {
  tenantId: string | null;
  setTenantId(id: string | null): void;
}

export interface WrapperContext {
  client: SupabaseClient<Database>;
  anyClient: SupabaseClient<any>;          // existing — view fallback
  tenantContext: TenantContext;            // NEW
}
```

```ts
// In every read method that hits a tenant-scoped table:
const tenantId = ctx.tenantContext.tenantId;
if (!tenantId) {
  // Dev-only: log a Sentry warning. Don't throw — anon flows
  // (customer-web menu browsing) legitimately have no tenant context
  // until set_table_context() runs. Specific wrapper methods that
  // require a tenant should throw their own AuthorizationError.
  if (process.env.NODE_ENV === 'development') {
    Sentry?.captureMessage('Wrapper read without tenant context', { level: 'warning' });
  }
}

const query = ctx.client.from('orders').select('*');
if (tenantId) query.eq('tenant_id', tenantId);
// …existing filters chain
```

**Inserts:** if the payload contains `tenant_id`, assert it matches
`ctx.tenantContext.tenantId` (or both are null). Throw `AuthorizationError`
from `@gustri/core` on mismatch.

**Steps:**

1. Add `TenantContext` to `wrapper/types.ts`.
2. Update `createSupabaseWrapper` signature to accept
   `{ tenantId?: string }` and to expose `setTenantContext(id)`.
3. Apply the predicate to one wrapper first as the pattern (`orders.ts`
   is a good choice — most-used, most tests). Verify tests still pass.
4. Apply to remaining wrappers. Use a checklist; don't trust grep alone.
5. Update the three app-level factories to call `setTenantContext` after
   sign-in. Look for the existing post-login hook in each app:
   - staff-web: probably `apps/staff-web/src/lib/auth/use-auth.ts` or
     `apps/staff-web/src/components/providers/auth-provider.tsx`.
   - customer-web: anon flow — set tenant from `set_table_context` RPC
     response in `apps/customer-web/src/lib/supabase.ts`.
   - mobile: `apps/mobile/src/lib/auth.ts` already has the
     `cleanupClientState` hook from PR 3 — extend it.
6. Add `packages/api-client/src/__tests__/tenant-context.test.ts`:
   - Test 1: read with matching `tenantId` succeeds (mock client returns
     the row).
   - Test 2: insert with mismatched `tenant_id` throws `AuthorizationError`.
   - Test 3: read with `tenantId: null` succeeds and emits a Sentry
     warning in dev (mock Sentry).
   - Test 4: an integration-style test using the existing mock-supabase
     helper that asserts the `.eq('tenant_id', …)` predicate appears in
     the query chain.
7. Update `plans/10-PACKAGE-ARCHITECTURE-DEFERRED.md` and `11-...ROADMAP.md`:
   move H5 / A3 to the "fixed" tables.

**Anti-patterns to avoid:**
- ❌ Don't make the predicate mandatory at the wrapper layer if it
  breaks anon customer-web flows. The QR-code path legitimately reads
  certain tables before a tenant context exists; those reads happen
  through `anon_read_*` RLS policies which already scope correctly.
- ❌ Don't migrate `lib/services/*` (server-side helpers under
  `/api/v1/*`). Per CLAUDE.md Exception 2 they use `supabaseAdmin`
  with service-role key; tenant scoping is enforced inside each route
  handler, not via the wrapper.
- ❌ Don't remove `anyClient` from `WrapperContext`. Per
  `plans/11` "Out of scope," some view queries still need it.

**Acceptance:**
- All existing tests pass.
- Four new tests in `tenant-context.test.ts` pass.
- Manual: in staff-web, sign in → make a request → in browser DevTools
  Network tab, observe `tenant_id=eq.<uuid>` query parameter on
  Supabase REST calls.
- Manual: artificially break the predicate by hand-editing one wrapper
  (`return ctx.client.from('orders').select('*')` with no eq) → in
  dev mode, see a Sentry warning. Restore the predicate after the
  smoke test.
- No measurable perf regression. RLS already filters; this predicate
  is redundant on the database side and cheap.

**Estimate:** 2–3 days. The bulk is updating ~20 wrappers and their
tests.

---

## PR C — Residual DB hardening (M4 / M8 / M11)

**Why now:** Three medium-priority DB items from
`plans/09-DB-SECURITY-DEFERRED.md` remain. Single migration, single PR.

**Files to touch:**
- New migration: `supabase/migrations/YYYYMMDDNNNNNN_tenant2_residual_hardening.sql`
  (use today's date; check the latest existing migration to pick the
  next sequence number).
- New rollback: `supabase/migrations/_rollbacks/YYYYMMDDNNNNNN_tenant2_residual_hardening.down.sql`
- After running the migration locally:
  `pnpm db:types:generate` — commit the regenerated
  `packages/database/src/types/generated.ts`.

### M4 — `tenant_self_view` exposing only `name, slug`

The `tenants` row leaks `plan` and `is_active` to every staff member
via `tenant_read_own`. Replace with a minimal view.

```sql
CREATE OR REPLACE VIEW public.tenant_self_view
WITH (security_invoker = on) AS
SELECT id, name, slug
FROM public.tenants
WHERE id = public.current_tenant_id();

REVOKE SELECT ON public.tenants FROM authenticated;
GRANT SELECT ON public.tenant_self_view TO authenticated;
```

**App-side adjustment:** grep for direct `tenants` table reads in
`packages/api-client/src/wrapper/tenants.ts` and any consumers.
Switch them to read from `tenant_self_view`. If staff-web has a
"plan" or "billing" UI that legitimately needs `plan`/`is_active`,
it's likely fetching via an `/api/v1/*` route using the service-role
client — that path is unaffected. Verify by grepping for `from('tenants')`
in `apps/`.

### M8 — RLS helpers read JWT claims first

The custom-claims hook from `20260423000006_jwt_custom_claims_hook.sql`
populates `tenant_id`, `user_role`, `is_active_staff` into the JWT,
but the helper functions still query the `staff` table on every RLS
evaluation.

```sql
CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_claim text;
BEGIN
  v_claim := auth.jwt() ->> 'tenant_id';
  IF v_claim IS NOT NULL AND v_claim <> '' THEN
    RETURN v_claim::uuid;
  END IF;
  -- Fallback for sessions issued before the hook was enabled.
  IF auth.uid() IS NOT NULL THEN
    RETURN (SELECT tenant_id FROM public.staff
            WHERE auth_user_id = auth.uid() AND is_active LIMIT 1);
  END IF;
  RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
END;
$$;

-- Same pattern for get_my_staff_role() and is_active_staff()
```

Verify the JWT claim names match what the hook actually emits — read
`supabase/migrations/20260423000006_jwt_custom_claims_hook.sql` first.
Don't hardcode names that diverge.

### M11 — `LIMIT 200` on `active_orders_view`

Find the current view definition in the baseline or a follow-up
migration. Recreate with `LIMIT 200`:

```sql
CREATE OR REPLACE VIEW public.active_orders_view
WITH (security_invoker = on) AS
SELECT …existing columns…
FROM public.orders o
JOIN …existing joins…
WHERE o.status NOT IN ('closed', 'cancelled')
  AND o.tenant_id = public.current_tenant_id()
ORDER BY o.created_at DESC
LIMIT 200;
```

The `tenant_id = current_tenant_id()` predicate plus
`security_invoker = on` is what scopes it. Don't drop the existing
predicates or columns — copy them verbatim from the existing definition.

### Rollback file

Mirror each `CREATE OR REPLACE` and `DROP` in the down file. For
`REVOKE SELECT`, the rollback is the matching `GRANT SELECT`.

### Update plans

After the migration applies cleanly, update
`plans/09-DB-SECURITY-DEFERRED.md`:
- Move M4, M8, M11 from "Still deferred" to a new
  "Quick reference — fixed in `<your-migration-id>`" table.

**Acceptance:**
- `supabase db reset` applies the migration cleanly with no errors.
- `pnpm db:types:check` passes (regenerated types committed).
- `pnpm test:rls` passes.
- Manual: sign in to staff-web, navigate around — no broken queries
  from the `tenants` view swap.
- Manual: `EXPLAIN ANALYZE SELECT * FROM active_orders_view;` shows
  the `LIMIT 200` clause.

---

## After all three PRs land

1. **Update `plans/00-OVERVIEW.md`:** flip the
   `[PACKAGE-ARCH](10-PACKAGE-ARCHITECTURE-DEFERRED.md)` row from
   "🟠 0 of remaining shipped" to reflect H0 + H5 done. Flip the
   `[DB-SECURITY](09-DB-SECURITY-DEFERRED.md)` row from "5 deferred"
   to "2 deferred (M9 verification, L4 informational)".
2. **Verify the tenant-#2 gate is open:** re-read
   `plans/09-DB-SECURITY-DEFERRED.md` and `plans/10-PACKAGE-ARCHITECTURE-DEFERRED.md`
   end-to-end. Every Critical and High should be in a "fixed" table.
   If anything is still in the active body, you missed a step.
3. **M9 verification (separate, lightweight):** before the first real
   tenant-#2 onboarding, run a load test against the realtime
   publication with two seeded tenants. Confirm subscriber A only
   receives tenant A's events. This is a checklist item, not a PR.

---

## What NOT to do in this batch

- ❌ Don't ship subpath exports for `@gustri/database` or
  `@gustri/api-client` (H4 / M4 in plan 10) — those are bundle-size
  optimizations triggered by Edge cold starts > 800ms or mobile
  bundle > 50MB, not by tenant-#2 onboarding.
- ❌ Don't add per-hook policy overrides to `@gustri/queries` (M1) —
  trigger is "second `-safe` wrapper written purely to override
  `staleTime`," not yet hit.
- ❌ Don't add optimistic updates (M3) — that's Tier 4, on
  staff-complaint trigger.
- ❌ Don't move the 4 stray `/api/v1/*` routes (M5 / C3) — that's
  Tier 3 and unrelated to tenant-#2 readiness.

---

## Reporting back

For each PR, tell me:
- One-line summary of what changed and where.
- The acceptance commands you ran and their outcomes.
- Any deviations from the plan and the reasoning.
- Any regression risk you flagged but couldn't fully test (with how
  to test it later).
- The PR URL or commit SHA.

Don't summarize the diffs — I read those. Tell me what only you know.
