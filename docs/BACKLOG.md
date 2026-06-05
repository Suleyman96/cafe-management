# Backlog — genuinely unimplemented work

> Consolidated 2026-06-04 from the audit/fix plans in `docs/history/plans/`
> during the documentation cleanup. The vast majority of items in those plans
> are **shipped** (CRITICAL/HIGH/LOW fixes, customer-web prod phases 1–6,
> pre-release blockers, operational hardening, report aggregation, etc.). This
> file lists only the work that was **verified still open** as of the cleanup,
> so the source plans can be archived without losing the loose ends.
>
> Each item notes whether it was **code-verified** during the cleanup or
> **carried forward** from a plan's recorded status (verify before starting —
> some may have shipped since the plan was written).

## Product features

### Menu-item modifiers / variants — ✅ DONE (#173, 2026-06-04)
Shipped end-to-end: `menu_item_options` + `menu_item_option_values` tables
(`20260604000002`), `order_items.selected_options` (JSONB) snapshot,
admin modifier-management UI, customer-web modal with required/single/multi
logic + live pricing, kitchen display, and server-authoritative pricing —
the `snapshot_item_price_from_menu()` trigger sums modifier deltas
(`20260604000003`) so the bill always reflects base + Σ delta.

## Realtime / cache audit — ✅ DONE (verified 2026-06-04)
All three "leftovers" turned out already implemented (the source plan in
`docs/history/` predates the work):

- **#4 — Refund pre-check.** Already atomicized via the `create_refund_with_audit`
  RPC (order-row lock + `validate_refund_amount` trigger as the balance
  authority); `check_violation` → `ConflictError(409)` mapping lives in
  `packages/api-client/src/errors.ts`.
- **#7 — Realtime cache version-aware writes.** ADR
  `docs/adr/0001-realtime-cache-version-strategy.md` (Accepted) records the
  "invalidate, never `setQueryData`" decision, with a guard test in
  `apps/staff-web/src/__tests__/hooks/use-realtime-sync.test.ts`.
- **#9 — Cross-tenant realtime defense.** `apps/customer-web/README.md`
  "safe-by-UUID" section + the guard test
  `apps/customer-web/src/__tests__/lint/realtime-filter-guard.test.ts`.
- **Source:** `docs/history/plans/realtime-cache-audit-remaining-prompts.md`.

## Database / multi-tenant hardening — deferred (carried forward, partially code-verified)
Recorded as deferred in the DB-security audit (status 2026-05-01). Lower
urgency: financial tables already have hard-delete restriction
(`20260505000001_financial_tables_restrict_delete.sql`).

- **M8 — Soft-delete / archival pattern** — ◐ PARTIAL (2026-06-05).
  Implemented for the catalog tables (`menu_items`, `categories`): `deleted_at`
  column + a RESTRICTIVE `FOR SELECT` policy (`deleted_at IS NULL`) that hides
  tombstoned rows from every reader (anon browse, authenticated staff, embedded
  joins) while retaining them; deletes routed through SECURITY DEFINER RPCs
  (`soft_delete_menu_item` / `soft_delete_category`) since the restrictive
  policy also blocks a direct UPDATE that sets `deleted_at`. Migration
  `20260605000001`, RLS test `soft-delete-catalog.test.ts`. Remaining tables
  (e.g. `staff`) still hard-delete — extend the same pattern when needed.
- **M4 — RLS recursion review**, **M9 — cascade cleanup**, **M11 — retention
  policies**, **L4 — audit-log archival** (carried forward).
- **Source:** `docs/history/plans/09-DB-SECURITY-DEFERRED.md`.

## Package architecture
- **H4 — Subpath exports** — ✅ DONE (2026-06-04). `@gustri/database` now
  exposes `/types`, `/schemas`, `/schemas/inputs`, `/enums` (tsup multi-entry
  + `exports` map, guarded by `exports-contract.test.ts`). Type-only consumers
  migrated to `@gustri/database/types`; input-schema consumers to
  `/schemas/inputs`. Convention documented in `CLAUDE.md`.
- **H5 — Wrapper tenant-filter defense-in-depth** — ✅ verified already
  implemented (`applyTenantScope` / `assertInsertTenantMatches` used across
  all `packages/api-client/src/wrapper/*`, including `menu-options.ts`).
  Plan status reconciled.
- **Source:** `docs/history/plans/10-PACKAGE-ARCHITECTURE-DEFERRED.md`,
  `11-PACKAGE-ARCHITECTURE-ROADMAP.md` (tenant #2 onboarding gate).

## Smaller carried-forward items
- **ADD-5 — Optimistic updates** for key mutations (some shipped via the
  `orders_optimistic_concurrency` path; confirm remaining coverage).
- **ADD-8 — HMAC** (code-verified: no `createHmac` usage present).
- **ADD-9 — Structured logging.**
- **MED-8 — Global React Query `staleTime`** — ✅ DONE (2026-06-04). A global
  default was already pinned in all three apps' QueryClient; the remaining
  work was consolidating scattered magic-number overrides into a shared
  `STALE_TIMES` tier policy in `@gustri/queries`
  (`REALTIME`/`SHORT`/`MEDIUM`/`LONG`/`STATIC`), adopted across the shared
  hooks + app hooks, deduping customer-web's local copy. Behavior-preserving
  (same numeric values).
- **SCALE residual** — ~8 of 34 scaling items recorded pending in
  `00-OVERVIEW.md`; note server-side **report aggregation already shipped**
  (`20260423000001_report_aggregation_functions.sql`), so re-verify the list
  in `docs/history/plans/07-SCALING-AND-ARCHITECTURE-fixes.md` before acting.

## Infra / CI follow-ups (found during cleanup, 2026-06-04)
- ~~**customer-web build is broken on `main`**~~ — ✅ resolved/stale
  (verified 2026-06-04). `@bprogress/next@^3.2.12` is installed and
  `providers.tsx`'s `@bprogress/next/app` import resolves; `pnpm build`
  passes for customer-web. No action needed.
- **Storage-image type drift** — addressed by scoping `gen types` to the
  `public` schema (see `scripts/generate-types.sh`); no further action unless
  a non-public schema type is genuinely needed.
