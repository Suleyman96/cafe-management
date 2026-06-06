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
  `20260605000001`, RLS test `soft-delete-catalog.test.ts`.
  - **Staff** (2026-06-05): "delete staff" now **deactivates** (`is_active=false`)
    instead of hard-deleting — the `/api/v1/staff` DELETE route was the last
    hard-delete path (the `db.staff.delete()` wrapper already deactivated). A
    hard delete either FK-failed (`refunds.processed_by` / `orders.delivery_person_id`
    / `staff_schedules` are RESTRICT) or nulled historical attribution;
    `current_tenant_id()` only resolves for active staff, so deactivation fully
    locks them out and is reversible. The auth user is retained.
  - Other operational tables still hard-delete by design (no attribution to
    preserve; financial tables are RESTRICT-protected). Extend if/when needed.
- **M4 — RLS recursion review** — ✅ reviewed, safe (2026-06-05). All staff-reading
  helpers (`current_tenant_id`, `get_my_staff_role`, `is_active_staff`,
  `get_my_staff_id`) are `SECURITY DEFINER`, the canonical recursion-breaker — a
  staff policy calling them doesn't re-trigger staff RLS. No recursion; no change.
- **M9 — cascade cleanup** — ✅ reviewed, sound (2026-06-05). FK `ON DELETE` is a
  deliberate mix: financial paths (`refunds`/`order_payments`/audit → orders/staff)
  are `RESTRICT`, ephemeral children (`order_items`, kitchen filters, push tokens)
  `CASCADE`, attribution `SET NULL`. No accidental-wipe cascades; no change.
- **M11 retention + L4 audit-archival** — ✅ DONE (was implemented-but-broken;
  fixed 2026-06-05). `run_data_retention()` + the `archive.*` schema + the
  `POST /api/v1/admin/retention` endpoint already existed (migration
  `20260424000004`). But its `INSERT INTO archive.X SELECT * FROM public.X`
  copies had silently broken: `public.orders` / `order_items` /
  `financial_audit_log` gained columns after the archive tables were snapshotted,
  so the archive INSERT threw 42601 on any aged order. Migration
  `20260605000002` re-aligns the archive tables; RLS test `data-retention.test.ts`
  exercises archive-prune + PII-anonymize and guards against future drift.
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
- **ADD-5 — Optimistic updates** — ✅ DONE (2026-06-05). The four
  highest-frequency shift-time mutations were pessimistic (wait → invalidate →
  refetch); now optimistic (onMutate snapshot → setQueryData → rollback onError
  → invalidate onSettled): **order status**, **order-item status**,
  **waiter-call acknowledge**, **table status**. A shared, key-agnostic
  primitive (`patchQueries`/`rollbackQueries` in `@gustri/queries/optimistic.ts`)
  serves both clients — staff-web (tenant-scoped keys) via the shared mutation
  hooks, and mobile (flat keys, offline-first: the change shows instantly even
  while the mutation is paused offline) via its local hooks. Aligned with
  ADR-0001, which governs only the *realtime* write path, not user-initiated
  mutations. Tests cover the primitive + per-hook optimistic flip/rollback.
- **ADD-8 — HMAC request signing** — ✅ DONE (2026-06-05, server-side BFF
  proxy). The naive plan (per-tenant secret signed in the browser) would be
  security theater — customer-web is a public browser app, so a shipped secret
  is public. Implemented the real version: customer mutations now post to
  customer-web's OWN same-origin BFF proxy
  (`app/api/v1/customer/[...path]`), which HMAC-SHA256-signs the request
  server-side (timestamp+method+path+body, server-only `CUSTOMER_API_SIGNING_SECRET`)
  and forwards to staff-web; staff-web verifies via `verifyCustomerSignature`
  on every `/api/v1/customer/*` route. The signing primitive is headless +
  cross-runtime (`@gustri/core/signing`, Web Crypto). Defense-in-depth on top
  of the existing IP rate-limit + tenant-binding + RLS: authenticates "came via
  our deployment", with replay (timestamp window) + tamper (body-bound sig)
  resistance. Safe default: unset secret ⇒ proxy forwards unsigned and staff-web
  skips verification (symmetric opt-in, no deploy-coupled break). The proxy
  forwards the real client IP so per-IP rate-limiting still keys per customer,
  and propagates the ADD-9 `x-request-id`. New sentinel `invalid_signature`
  (20 locales). Future: per-request nonce store for strict replay protection.
- **ADD-9 — Structured logging** — ✅ DONE (2026-06-05). Per-request correlation
  IDs end-to-end: `staff-web` middleware mints/propagates an `x-request-id`
  (honoring an inbound one) on every `/api/*` request, forwards it to the
  handler, and echoes it on the response. A zero-dep single-line-JSON `logger`
  (`apps/staff-web/src/lib/api/logger.ts` — pino was rejected: not Edge-runtime
  compatible) replaces ad-hoc `console.*`. `handleRouteError(err, request)`
  emits a structured log line + tags the Sentry event with `request_id`+`route`,
  and returns `request_id` in the error body (CORS-proof) and header. Clients
  close the loop: `httpStatusToAppError` threads `request_id` onto the typed
  error's `details`, and the mutation-cache `onError` in staff-web, customer-web,
  and mobile tags their Sentry events with the same ID. Tests:
  `lib/api/{request-id,logger,handle-route-error,middleware-request-id}.test.ts`
  + `httpStatusToAppError` request_id cases. (pino at higher volume remains a
  future swap behind the same `logger` surface.)
- **MED-8 — Global React Query `staleTime`** — ✅ DONE (2026-06-04). A global
  default was already pinned in all three apps' QueryClient; the remaining
  work was consolidating scattered magic-number overrides into a shared
  `STALE_TIMES` tier policy in `@gustri/queries`
  (`REALTIME`/`SHORT`/`MEDIUM`/`LONG`/`STATIC`), adopted across the shared
  hooks + app hooks, deduping customer-web's local copy. Behavior-preserving
  (same numeric values).
- **SCALE residual** — ✅ all 34 shipped (verified against code 2026-06-05).
  The recorded "8 pending" was stale; a code sweep confirmed the tail items
  (SCALE-22 mobile Sentry, 23 CI coverage+bundle-check, 24 next/image, 25
  retention, 26 pg_stat_statements monitoring, 28 expo push, 29 mobile cache
  eviction, 30 sound unload, 31 realtime cleanup on logout, 32 FlashList, 33
  sync-handler Sentry, 34 Maestro E2E) are all present. No action.

## Open hardening follow-ups (optional)
- **ADD-8 — strict replay protection (nonce store)** — ✅ DONE (2026-06-06).
  The customer→staff HMAC signing already resisted replay via the ±5-min
  timestamp window; this makes it strict. The BFF proxy now mints a per-request
  `crypto.randomUUID()` nonce, binds it into the signed payload
  (`@gustri/core/signing` canonical string), and sends it as `x-gustri-nonce`.
  staff-web's `verify-customer-signature` verifies the signature (which now
  covers the nonce, so a swapped nonce fails) then atomically claims the nonce
  single-use via `nonce-store.ts` (Upstash `SET … NX EX <tolerance>`) — a repeat
  within the window is rejected as a replay. Fail-open when Redis is absent
  (dev/CI) or errors, so it never takes down ordering; the timestamp window
  still bounds replay there. Tests: core nonce cases + verify replay/skip/
  swapped-nonce + proxy nonce-header. NOTE: since the nonce is now part of the
  signed canonical, both apps must run this code before `CUSTOMER_API_SIGNING_SECRET`
  is set — which is already the deploy requirement for the whole feature.

## Post-refactor security/correctness audit (2026-06-06)
A fresh whole-codebase audit (security / correctness / data-integrity) after the
refactor work. The codebase was found well-hardened; the genuine findings:

- **MUST-FIX — customer add-items IDOR** — ✅ DONE (PR #182). The
  `/api/v1/customer/orders/[id]/items` route had no table binding (derived tenant
  from the public `tenant_id`, looked the order up by id+tenant only), so an
  order UUID alone let an actor append items to a stranger's open order. Now
  requires `table_id` and asserts `order.table_id === table_id` for dine-in
  (matching the cancel endpoints); auth runs before the idempotency replay.
- **SHOULD-FIX (this PR):**
  - **Item-status ↔ state-machine collision** — ✅ `20260606000003`. Serving the
    last item of a `preparing` dine-in order made the sync trigger issue an
    illegal `preparing→served` that the validator rejected, aborting the item
    update. The trigger now walks legal single hops and clamps `served` to
    dine-in. RLS regression test added.
  - **`orders.table_id` ON DELETE CASCADE → SET NULL** — ✅ `20260606000002`.
    Deleting a table no longer destroys its unpaid/cancelled order history.
  - **`order_payments.tip_amount` non-negative** — ✅ `20260606000001`. Was
    nullable + unguarded; now `NOT NULL DEFAULT 0` + `CHECK (>= 0)`. Types regen'd.
  - **Signing fail-open prod guardrail** — ✅ `verify-customer-signature` now
    emits a loud Sentry warning when prod is missing the secret (not fail-closed,
    which would break ordering on a partial rollout; the endpoints keep
    rate-limit + tenant-binding + RLS).
  - **BFF `x-real-ip` trust** — ✅ documented the Vercel-normalization trust
    model + switched the XFF fallback to the last (trusted-proxy) hop. Correct on
    Vercel; passthrough deploys must strip inbound forwarding headers at the edge.
- **`get_delivery_order` PII** — ✅ already fixed (false positive). The auditor
  read the stale `20260418000001` definition; `20260423000004` redefined it as
  `get_delivery_order(UUID, p_access_token)` gated on
  `delivery_access_token = p_access_token` (a null token matches nothing).

## Infra / CI follow-ups (found during cleanup, 2026-06-04)
- ~~**customer-web build is broken on `main`**~~ — ✅ resolved/stale
  (verified 2026-06-04). `@bprogress/next@^3.2.12` is installed and
  `providers.tsx`'s `@bprogress/next/app` import resolves; `pnpm build`
  passes for customer-web. No action needed.
- **Storage-image type drift** — addressed by scoping `gen types` to the
  `public` schema (see `scripts/generate-types.sh`); no further action unless
  a non-public schema type is genuinely needed.
