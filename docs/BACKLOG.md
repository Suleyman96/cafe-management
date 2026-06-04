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

### Menu-item modifiers / variants — NOT STARTED (code-verified)
Customer ordering supports only quantity + free-text notes. Real orders need
size (S/M/L), spice level, removals ("no onions"), priced add-ons
("+₺5 extra cheese"), and "choose N of M" option groups. Kitchen currently
misses note-based modifiers; staff walk over to clarify. Flagged as the #1
conversion ceiling.

- **Verified:** no `menu_item_options` / option-values schema exists anywhere
  in `supabase/migrations/` or `packages/database`.
- **Scope:** `menu_item_options` + `menu_item_option_values` tables,
  `order_items.options` (JSONB), customer-web menu-item modal UI with
  required/multi-select logic + pricing, 20-locale i18n for option labels.
- **Source:** `docs/history/plans/28-CW-POST-PHASE-6-AUDIT.md` §M1 (line ~201).

## Realtime / cache audit — open design questions (carried forward)
Three "leftovers" from the realtime + cache-integrity audit that each need a
focused design/decision pass (the other six findings shipped).

- **#4 — Refund pre-check: drop or atomicize.** Decide the correct shape for
  the service-side refund balance check vs. the atomic locking already added
  (`supabase/migrations/20260503000003_atomic_payment_refund_locking.sql`).
- **#7 — Realtime cache version-aware writes.** Guard cache writes so a stale
  realtime event can't clobber a newer optimistic/explicit write.
- **#9 — Customer-web cross-tenant realtime defense-in-depth.** Extra guard so
  a customer-web realtime channel can't surface another tenant's events.
- **Source:** `docs/history/plans/realtime-cache-audit-remaining-prompts.md`.

## Database / multi-tenant hardening — deferred (carried forward, partially code-verified)
Recorded as deferred in the DB-security audit (status 2026-05-01). Lower
urgency: financial tables already have hard-delete restriction
(`20260505000001_financial_tables_restrict_delete.sql`).

- **M8 — Soft-delete / archival pattern** (code-verified: no `deleted_at`
  columns exist).
- **M4 — RLS recursion review**, **M9 — cascade cleanup**, **M11 — retention
  policies**, **L4 — audit-log archival** (carried forward).
- **Source:** `docs/history/plans/09-DB-SECURITY-DEFERRED.md`.

## Package architecture — deferred (partially code-verified)
- **H4 — Subpath exports** (code-verified NOT done: `@gustri/database`
  exposes only `"."`; add `/types`, `/schemas`, `/enums` so type-only imports
  don't pull the whole barrel).
- **H5 — Wrapper tenant-filter defense-in-depth** appears **already
  implemented** (`applyTenantScope` / `assertInsertTenantMatches` are used
  across `packages/api-client/src/wrapper/*`) despite the plan marking it
  pending — reconcile the plan's status.
- **Source:** `docs/history/plans/10-PACKAGE-ARCHITECTURE-DEFERRED.md`,
  `11-PACKAGE-ARCHITECTURE-ROADMAP.md` (tenant #2 onboarding gate).

## Smaller carried-forward items
- **ADD-5 — Optimistic updates** for key mutations (some shipped via the
  `orders_optimistic_concurrency` path; confirm remaining coverage).
- **ADD-8 — HMAC** (code-verified: no `createHmac` usage present).
- **ADD-9 — Structured logging.**
- **MED-8 — Global React Query `staleTime`** (recorded partial).
- **SCALE residual** — ~8 of 34 scaling items recorded pending in
  `00-OVERVIEW.md`; note server-side **report aggregation already shipped**
  (`20260423000001_report_aggregation_functions.sql`), so re-verify the list
  in `docs/history/plans/07-SCALING-AND-ARCHITECTURE-fixes.md` before acting.

## Infra / CI follow-ups (found during cleanup, 2026-06-04)
- **customer-web build is broken on `main`** — `apps/customer-web/src/components/providers.tsx`
  imports `@bprogress/next/app`, but the installed package resolves to
  `@bprogress/core` + `@bprogress/react` (the package was restructured), so
  `next build` fails. Introduced in #160. Fix the import path or pin the
  package version.
- **Storage-image type drift** — addressed by scoping `gen types` to the
  `public` schema (see `scripts/generate-types.sh`); no further action unless
  a non-public schema type is genuinely needed.
