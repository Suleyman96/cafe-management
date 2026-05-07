# Customer-Web Audit — Continuation Plan

Handoff doc for picking up the customer-web security audit in a new Claude session. Previous work: PRs #97, #98, #99, #100 (see status table below). The audit source is [17-CUSTOMER-WEB-AUDIT-FIX-PLAN.md](17-CUSTOMER-WEB-AUDIT-FIX-PLAN.md).

---

## Status snapshot

### Closed (in `main`)

| Item | PR | Notes |
|---|---|---|
| 🟠 H1 — engagement-route DoS via direct-Supabase | #97 | API routes + DB velocity guard |
| 🟠 H2 — dine-in QR codes never expire | #97 | Rotation + expiry/revocation columns + admin UI |
| 🟠 H3 — unbounded free-text DoS | (pre-session) | `NOT VALID` length CHECKs |
| 🟠 H4 — anon table-free policy | false positive | Already fixed by 20260428000001 |
| 🟠 H5 — realtime cross-customer leak | (pre-session) | Channel narrowed from `table_id` to `id` |
| ⚙️ Migration timestamp collision | #98 | `20260507000001` → `…04` rename for `set_order_number_uses_new_tenant_id` |

### Open PRs

| PR | Title | Size |
|---|---|---|
| [#99](https://github.com/gunnerkh/cafe-idare/pull/99) | `chore(gitignore): catch .env*.local* variants` | 1 line |
| [#100](https://github.com/gunnerkh/cafe-idare/pull/100) | `audit: M1 + M2 + M6 — finish customer-web 🟡 list` | 15 files |

### Open audit items

**Mediums still open:**
- 🟡 **M3** — plan-required gate inconsistency. `/api/v1/customer/orders` enforces `PLAN_LIMITS[plan].qrOrdering` server-side, but `waiter_calls` and `feedback` routes (added in PR #97) skip this check. A free-tier tenant who hasn't enabled QR ordering still gets calls/feedback writes. Low revenue impact.
- 🟡 **M4** — staff-web XSS audit. Out-of-scope for the customer-web review. Need to grep staff-web for `dangerouslySetInnerHTML` and any code rendering `customer_notes` / `delivery_address` / `delivery_notes` / `feedback.message` / `waiter_calls.notes`.
- 🟡 **M5** — realtime listener leak on rapid navigation. PR1 simplified the path (no channel before `orderId`) but the `useEffect` dep array can still churn channels under React strict-mode double-invoke. Surgical fix in `apps/customer-web/src/hooks/use-order.ts`.

**Lows still open:**
- 🟢 **L4** — `tables.qr_code` is anon-readable via `anon_read_tables`. Partially mitigated by PR #97's rotation (rotated codes invalidate scrapes), but the column itself is still readable. Consider a column-level revoke or a view that omits `qr_code` from the anon-read policy.
- 🟢 **L5** — delivery menu fetched without scoping if token omitted. Verify [apps/customer-web/src/app/delivery/menu/page.tsx](../apps/customer-web/src/app/delivery/menu/page.tsx) rejects unscoped browses.

**Operational follow-ups (from PRs #97 / #98 / #100):**
- `VALIDATE CONSTRAINT` migration to upgrade PR2's `NOT VALID` length checks once a per-tenant audit query confirms no offending rows.
- Delete `db.waiterCalls.create` and `db.feedback.create` from `@gustri/api-client` once mobile is verified not to use them (they're already unused by customer-web post-PR #97).
- Print/PDF affordance for rotated QR codes (admin success toast → printable poster).
- Pre-expiry warning emails (daily cron checking `qr_code_expires_at < now() + 14 days`).
- Three distinct QR-error sentinel codes + 20-locale translations if differentiated UX is wanted (`invalid_qr_token`, `qr_token_expired`, `qr_token_revoked`).

**Performance items (defer until complaints):**
- Menu over-fetch (limit 500, no pagination).
- Settings + menu fetched twice for delivery (SSR + client) — `dehydrate` Query cache.
- Realtime invalidate cascade — `setQueryData` instead of `invalidateQueries`.
- Image lazy-load audit.
- i18n bundle audit — verify non-active locales lazy-load.

**Structural items (defer / multi-PR):**
- Two QR flows (`tables.qr_code` vs `qr_tokens.token`) — unify into one schema.
- Wrapper-side `tenant_id` trust pattern — `db.waiterCalls.create` and `db.feedback.create` still accept `tenant_id` from client; fine after PR #97 (they're unused by customer-web) but should be deleted once mobile is clear.
- Global `customer_ordering_enabled` kill-switch — one row in `feature_flags` would let an operator disable customer ordering during a kitchen crisis without a deploy.

---

## Recommended PR sequencing

### Tier 1 — small, fresh-session-friendly

1. **M5** — realtime listener leak (~1 hour)
   - File: [apps/customer-web/src/hooks/use-order.ts](../apps/customer-web/src/hooks/use-order.ts) lines 30–77.
   - Add a `useRef`-based dedupe so rapid mount/unmount cycles (React strict-mode double-invoke in dev) don't churn channels.
   - Existing test pattern: [apps/customer-web/src/__tests__/hooks/use-order.test.ts](../apps/customer-web/src/__tests__/hooks/use-order.test.ts).

2. **VALIDATE CONSTRAINT migration** (~1 hour)
   - Pre-flight: run on prod replica:
     ```sql
     SELECT count(*) FROM orders WHERE length(customer_notes) > 2000;
     SELECT count(*) FROM orders WHERE length(delivery_address) > 500;
     SELECT count(*) FROM orders WHERE length(delivery_notes) > 2000;
     SELECT count(*) FROM orders WHERE length(internal_notes) > 2000;
     SELECT count(*) FROM order_items WHERE length(notes) > 500;
     SELECT count(*) FROM customer_feedback WHERE length(message) > 1000;
     SELECT count(*) FROM customer_feedback WHERE length(response) > 2000;
     SELECT count(*) FROM waiter_calls WHERE length(notes) > 500;
     ```
   - If all zero: ship migration with `ALTER TABLE … VALIDATE CONSTRAINT …` for each. Constraint becomes fully validated.
   - If non-zero: truncate or raise the cap to fit; coordinate with CS first.

3. **Delete unused wrapper methods** (~30 min)
   - Verify mobile has no callers of `db.waiterCalls.create` or `db.feedback.create` (`grep -rn` in [apps/mobile/src/](../apps/mobile/src/)).
   - If clear: delete from `packages/api-client/src/wrapper/waiter-calls.ts` and `feedback.ts`. Update tests.

### Tier 2 — fresh session strongly recommended (different surface)

4. **M4 + L4 + L5** (~1 day) — staff-web XSS audit + tighten anon read + delivery menu lock-down.
   - **M4**: grep staff-web for `dangerouslySetInnerHTML`. Should be zero. Then audit all places that render `customer_notes`, `delivery_address`, `delivery_notes`, `feedback.message`, `waiter_calls.notes`. React escapes by default but verify no `<div innerHTML={...}>` or template-string-to-HTML patterns. Likely files: [apps/staff-web/src/app/(staff)/orders/](../apps/staff-web/src/app/), feedback views, waiter-call views.
   - **L4**: investigate whether `tables.qr_code` needs to remain anon-readable. The customer-web flow uses it for `findByQrCode` (called inside `setTableContext`). Could be restricted to a `SECURITY DEFINER` RPC instead of direct column access. Bigger surgery.
   - **L5**: confirm [apps/customer-web/src/app/delivery/menu/page.tsx](../apps/customer-web/src/app/delivery/menu/page.tsx) errors out if no token is set. If it currently shows an empty menu silently, fix the failure mode.

### Tier 3 — defer until needed

5. **M3** — plan-required gate consistency. Add `PLAN_LIMITS[plan].qrOrdering` check to `customer-engagement-service.ts`. Trivial change but low value (free-tier abuse vector is bounded by rate limiting already).

6. **Performance + structural** items per the lists above.

---

## Trade-offs locked in (do NOT relitigate)

- **Customer feedback dedupe deferred** — `customer_feedback` lacks `client_request_id` today. Adding the column would balloon scope; rate limiter (3/5min/IP) caps the spam blast radius.
- **Three QR-error sentinels not added to `SENTINEL_ERROR_CODES`** — single localized "Invalid Table" message covers all three failure modes (`invalid_qr_token` / `qr_token_revoked` / `qr_token_expired`). Saves 60 locale entries. Documented in PR #97.
- **No per-tenant feature flag for QR enforcement** — defaults are NULL on every existing row, so deploy was zero-impact. Operators opt in by rotating. Matches the safer-default pattern.
- **`window.confirm()` over a custom modal** for QR rotate — admin-only, rare, destructive. Polish isn't worth the surface.
- **M6's `table_id` match is incremental, not bulletproof** — `table_id` is anon-readable. A future PR could require live `qr_code` (a real secret) instead.
- **PR2 used `NOT VALID`** on length CHECKs — won't fail migration on legacy data. The pending VALIDATE step (#1 above) finishes the job.

---

## Pitfalls to NOT repeat

1. **`pnpm --filter <app> type-check` is the WRONG canonical command.** It bypasses Turbo's `dependsOn: ['^build']` and reads stale `dist/` outputs of shared packages. Use `pnpm type-check` from root. Spent ~30 min "investigating 223 type errors" that didn't exist.

2. **IDE diagnostics for "unused" imports/types are often stale.** When a file has imports used only inside JSX/generics, the IDE flashes a misleading "unused" warning. **Biome is the source of truth** — don't react to IDE warnings without running `pnpm exec biome check`.

3. **Migration timestamp collisions cause silent prod inconsistencies.** Two files with `YYYYMMDDNNNNNN` matching → Supabase CLI applies the SQL of one but errors on the schema_migrations INSERT of the other. End state: SQL ran (CREATE OR REPLACE FUNCTION etc. is in the DB) but the migration ledger doesn't reflect it. PR #98 fixed the active instance; check for new ones before shipping migrations dated the same day.

4. **CI is currently billing-blocked.** PRs #97 and #98 both ran for 4–12 seconds before hitting "recent account payments have failed or your spending limit needs to be increased." Resolve in GitHub Settings → Billing & plans before relying on CI signal.

5. **`gh pr edit` is broken** on the installed `gh` CLI version (deprecated GraphQL Projects-Classic endpoint). Use `gh pr comment` or `gh api` to update PR bodies. `brew upgrade gh` should fix.

---

## Working-tree leftovers

These will likely show up in `git status` when picking up:

- `apps/staff-web/.env.local.remote` — contains a real `SUPABASE_SERVICE_ROLE_KEY`. **Will be ignored automatically once PR #99 merges.** Until then, manually verify it's untracked before any commit. Never `git add -A`.
- `apps/staff-web/src/components/layout/sidebar.tsx` — unrelated UX work (localStorage-persisted collapsed groups). Not part of any audit PR. Commit on its own branch when ready.
- `packages/i18n/src/locales/{az,de,es,id,it,pt,tr}/nav.json` — unrelated nav.json modifications, possibly leftover from a prior `sync-i18n.py` run. Verify before committing.

---

## Pointers for the new session

- **Project conventions**: [CLAUDE.md](../CLAUDE.md) — read first.
- **Original audit plan**: [17-CUSTOMER-WEB-AUDIT-FIX-PLAN.md](17-CUSTOMER-WEB-AUDIT-FIX-PLAN.md).
- **Recent PR descriptions** carry the trade-offs and verification steps:
  - [#97 — H1 + H2](https://github.com/gunnerkh/cafe-idare/pull/97)
  - [#98 — Migration rename](https://github.com/gunnerkh/cafe-idare/pull/98)
  - [#99 — gitignore](https://github.com/gunnerkh/cafe-idare/pull/99)
  - [#100 — M1 + M2 + M6](https://github.com/gunnerkh/cafe-idare/pull/100)
- **Existing service patterns to mirror**:
  - [apps/staff-web/src/lib/services/customer-order-service.ts](../apps/staff-web/src/lib/services/customer-order-service.ts) — orders + cancel.
  - [apps/staff-web/src/lib/services/customer-engagement-service.ts](../apps/staff-web/src/lib/services/customer-engagement-service.ts) — waiter calls + feedback.
- **Existing route test patterns**: [apps/staff-web/src/__tests__/api/customer-*-route.test.ts](../apps/staff-web/src/__tests__/api/).
- **Existing migration patterns**: [supabase/migrations/20260507000003_table_qr_rotation.sql](../supabase/migrations/20260507000003_table_qr_rotation.sql) (with rollback).
- **Rate-limit categories**: [apps/staff-web/src/lib/api/rate-limit.ts](../apps/staff-web/src/lib/api/rate-limit.ts).
- **i18n key sync workflow**: add to `packages/i18n/src/locales/en/staff.json`, then run `python3 scripts/sync-i18n.py` (auto-fills 19 locales with English fallback + warnings).

---

## How to start the new session

A useful opening prompt:

> Continuation of the customer-web security audit. Read `plans/18-CUSTOMER-WEB-AUDIT-CONTINUATION.md` first — it has the status snapshot, locked-in trade-offs, and pitfalls to avoid. Start with [pick a tier-1 item from §"Recommended PR sequencing"]. PRs #99 and #100 may still be open; check before branching.
