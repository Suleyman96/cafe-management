# customer-web Audit — Step-by-Step Fix Plan

Source audit: `plans/prompt-for-customer-web-review.md` (run 2026-05-05).
Scope: customer-facing web app (anon QR + delivery), Supabase RLS, triggers, realtime, perf.

How to use this file:
- Work top-to-bottom. Sections are ordered by blast radius, not by ease.
- Each finding has: **Where**, **What**, **Why**, **Fix steps**, **Verification**, **Done when**.
- Tick the checkbox when shipped to `main`. Add the migration / PR number next to the box.
- Anything tagged `[DB]` requires a migration + regenerated types (`pnpm db:types:generate`) committed in the same PR.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` shipped · `[-]` won't fix (justify inline)

---

## Phase 0 — Pre-flight (do once before starting)

- [ ] Re-read `CLAUDE.md` Migration Rule and Feature Flag Rule.
- [ ] Confirm a clean working tree on `main`. `pnpm check && pnpm type-check && pnpm test` all green.
- [ ] Snapshot the current `pg_policies` output (so post-fix diffs are reviewable):
  ```bash
  psql "$DATABASE_URL" -c "\copy (select * from pg_policies order by schemaname, tablename, policyname) to '/tmp/pg_policies_before.csv' csv header"
  ```
- [ ] Snapshot trigger list:
  ```bash
  psql "$DATABASE_URL" -c "\copy (select event_object_table, trigger_name, action_timing, event_manipulation from information_schema.triggers where trigger_schema='public' order by 1,2) to '/tmp/triggers_before.csv' csv header"
  ```

---

## Phase 1 — Critical (ship this week, in order)

### C1. Anon can create orders in any tenant by going around the API route  `[DB]`
- [ ] **Where.** RLS policy `anon_insert_orders` in `supabase/migrations/00000000000000_baseline.sql:2857-2861`.
- [ ] **What.** Takeout/delivery branch (`table_id IS NULL`) only checks `EXISTS tenant`. There is no QR-token / delivery-token check at the RLS layer — that lives only in the staff-web `/api/v1/customer/orders` route.
- [ ] **Why it matters.** Attacker holding the public anon key can POST `/rest/v1/orders` directly with any `tenant_id`. Single-tenant today; multi-tenant catastrophic.
- [ ] **Fix steps.**
  1. Add migration `YYYYMMDDNNNNNN_anon_orders_require_session_tenant.sql`:
     - DROP POLICY `anon_insert_orders` ON `public.orders`.
     - Re-create with takeout branch requiring `current_setting('app.current_tenant_id', true)::uuid = orders.tenant_id` (or matched-token check via `qr_tokens`).
  2. Add a `set_qr_token_context(p_token text)` RPC (mirror of `set_table_context`) that sets `app.current_tenant_id` from `qr_tokens.tenant_id` lookup. Grant EXECUTE to `anon`.
  3. Have customer-web call `setQrTokenContext(qrToken)` from `apps/customer-web/src/store/delivery-store.ts` (or a new `lib/delivery-context.ts`) before any direct Supabase call on the delivery flow.
- [ ] **Verification.**
  - Add an integration test under `packages/api-client/src/__tests__/security/` that asserts a direct anon insert with a forged `tenant_id` and `table_id IS NULL` is rejected.
  - Manual: with anon key, `curl -X POST .../rest/v1/orders -d '{"tenant_id":"<other>","table_id":null,"order_type":"delivery"}'` should return 403.
- [ ] **Done when.** Migration merged, types regenerated, security test passing, manual probe blocked.

### C2. Anon can cancel any early-stage order across tenants  `[DB]`
- [ ] **Where.** Policy `anon_cancel_early_orders` in `supabase/migrations/20260418000001_fix_security_issues.sql:99-114`.
- [ ] **What.** USING clause has no tenant or actor scoping. Any anon can `PATCH /rest/v1/orders?id=eq.<uuid>` with `{status:'cancelled'}` for any pending/new order in any tenant.
- [ ] **Why it matters.** Total DoS of the order pipeline. Order UUIDs leak via realtime + delivery URLs.
- [ ] **Fix steps.**
  1. Migration: drop and recreate `anon_cancel_early_orders` with USING that adds:
     - `AND tenant_id = current_setting('app.current_tenant_id', true)::uuid`
     - `AND ((table_id IS NOT NULL AND table_id::text = current_setting('app.current_table_id', true)) OR (table_id IS NULL AND delivery_access_token = current_setting('app.qr_token', true)))`
  2. Drop `'pending_approval'` from the allowed-status list — customer-web never starts orders in that state.
- [ ] **Verification.**
  - Test: with table A's session context bound, attempt to cancel an order from table B → expect 0 rows updated.
  - Existing dine-in cancel flow still works for the customer's own order.
- [ ] **Done when.** Migration merged, security test passing.

### C3. Anon waiter-call / feedback flood (no rate limit)  `[DB + APP]`
- [ ] **Where.**
  - `apps/customer-web/src/hooks/use-waiter-call.ts:30` (direct `db.waiterCalls.create`)
  - `apps/customer-web/src/components/feedback/feedback-form.tsx:43-62` (direct `db.feedback.create`)
- [ ] **What.** No DB rate limit, no API gateway, no captcha. The 20 req/10 s in `apps/customer-web/src/lib/supabase.ts:19-34` is in-memory per tab.
- [ ] **Why it matters.** Kitchen tablet flood, "fake emergency" abuse, storage bloat.
- [ ] **Fix steps (DB layer first — must survive route bypass).**
  1. Migration: BEFORE INSERT trigger on `public.waiter_calls`:
     ```sql
     IF (SELECT count(*) FROM public.waiter_calls
         WHERE table_id = NEW.table_id AND created_at > now() - interval '1 minute') >= 5 THEN
       RAISE EXCEPTION 'rate_limit_waiter_calls' USING ERRCODE = '53400';
     END IF;
     ```
  2. Same shape for `public.customer_feedback` (e.g. ≥3 per minute per `table_id`).
- [ ] **Fix steps (app layer — UX guard + observability).**
  3. New routes `staff-web/src/app/api/v1/customer/waiter-calls/route.ts` and `.../feedback/route.ts` that proxy the insert and add an Upstash rate limit keyed by `(ip, tenant_id)`. (Treat as future hardening — DB trigger is the must-ship.)
  4. Migrate `useCreateWaiterCall` to call the route via `apiFetch` instead of `db.waiterCalls.create` directly. Same for feedback.
- [ ] **Verification.** Loop-spam test from a script with anon key — DB rejects 6th call within a minute with a clean error code.
- [ ] **Done when.** DB triggers shipped. App-layer routes can land in a follow-up.

### C4. Delivery access tokens are permanent and reusable  `[DB + APP]`
- [ ] **Where.** `supabase/migrations/20260423000004_delivery_access_token.sql`.
- [ ] **What.** Token never expires, never revoked, passed in URL.
- [ ] **Fix steps.**
  1. Migration: add `delivery_access_token_expires_at TIMESTAMPTZ` defaulting to `now() + interval '7 days'`.
  2. Update `get_delivery_order(p_order_id, p_access_token)` to also check `expires_at > now()`.
  3. Trigger on UPDATE: when status hits `delivered` / `cancelled`, set `delivery_access_token = NULL`.
  4. App: stop passing the token in the URL — set it as an HttpOnly cookie at the delivery-order create response. Update `apps/customer-web/src/app/delivery/order/[orderId]/page.tsx` and `useDeliveryOrder` to read from cookie. (If cookie path is too invasive, ship steps 1-3 first and keep the URL token for now.)
- [ ] **Verification.** After 7 days (or with a clock-shifted test), `get_delivery_order` returns NULL. After order delivered, token reuse fails immediately.

### C5. Establish "anon writes never trust client tenant_id" invariant  `[DB + CI]`
- [ ] **Where.** All anon INSERT/UPDATE policies in `pg_policies`.
- [ ] **What.** Convention: every anon write must derive tenant from a strong FK lookup OR from `current_setting('app.current_tenant_id')`. Never trust the row's `tenant_id` column directly.
- [ ] **Fix steps.**
  1. Audit `pg_policies` and document each anon policy's tenant derivation.
  2. Add a CI test under `supabase/tests/` that fails if any anon INSERT/UPDATE policy lacks one of the two patterns. Use `pg_get_expr` against `pg_policy.polqual` / `polwithcheck`.
- [ ] **Done when.** CI test green, runs in `pnpm test:rls` (or wherever the RLS suite lives).

---

## Phase 2 — High-risk (ship this sprint)

### H1. `set_table_context` callable with any `qr_code` + weak code formats  `[DB]`
- [ ] **Where.** `supabase/migrations/00000000000000_baseline.sql:529-548`.
- [ ] **Fix steps.**
  1. Confirm production `tables.qr_code` is long random — if any are short legacy strings, regenerate them.
  2. Add CHECK: `CHECK (length(qr_code) >= 22)`.
  3. Optional: rename column to `qr_token` to avoid confusion with the printed table number.
- [ ] **Verification.** New table seed produces a 22+ char token. Old tables either pass or are migrated.

### H2. `item_name` not server-snapshotted  `[DB]`
- [ ] **Where.** Trigger `snapshot_item_price_from_menu` in `supabase/migrations/20260503000002_enforce_server_order_totals.sql:34-61`.
- [ ] **Fix steps.**
  1. Migration: extend the trigger to also `NEW.item_name := (SELECT name FROM menu_items WHERE id = NEW.menu_item_id AND tenant_id = NEW.tenant_id)`. Same for any translated-name column.
- [ ] **Verification.** Submit an order item with `item_name: "FREE COMP"` — DB row stores the canonical menu name.

### H3. `client_request_id` nullable for anon paths  `[DB + APP]`
- [ ] **Where.** `supabase/migrations/20260428000002_idempotency_keys.sql` + customer-web hooks that go direct to Supabase (waiter calls, feedback).
- [ ] **Fix steps.**
  1. App: stamp `client_request_id` in `useCreateWaiterCall` and `feedback-form.tsx` using `getOrCreateClientRequestId()` (already imported elsewhere).
  2. DB: change column DEFAULT to `gen_random_uuid()` for anon-writable tables so a duplicate POST always conflicts.
- [ ] **Verification.** Double-tap waiter-call button → 1 row created, second hits unique-violation and is treated as success by hook.

### H4. In-memory rate limits are UX-only — do not depend on them
- [ ] **Where.** `apps/customer-web/src/lib/api-routes.ts:13-26`, `apps/customer-web/src/lib/supabase.ts:19-34`.
- [ ] **Fix steps.** No code change needed — but add a code comment marking these as "UX guard, not a security boundary." Real defense is C3's DB triggers + future edge rate limit.

### H5. CSP `'unsafe-inline'` for styles
- [ ] **Where.** `apps/customer-web/src/middleware.ts:33`.
- [ ] **Fix steps.** Track for follow-up. Migrate to per-request style nonces once Next.js + Tailwind support it cleanly. Acceptable risk today.

### H6. CSP `connect-src` wildcards
- [ ] **Where.** `apps/customer-web/src/middleware.ts:35`.
- [ ] **Fix steps.**
  1. Replace `https://*.supabase.co` and `wss://*.supabase.co` with the specific project ref derived from `NEXT_PUBLIC_SUPABASE_URL`.
  2. Compute at build time or in middleware from `process.env.NEXT_PUBLIC_SUPABASE_URL`.
- [ ] **Verification.** Browser devtools → Network → WS connection still succeeds; CSP report-uri logs no violations.

### H7. Cart store leaks across tables/tenants
- [ ] **Where.** `apps/customer-web/src/store/cart-store.ts:89-94`.
- [ ] **Fix steps.**
  1. Switch `persist` key from `cart-storage` to `cart-storage:${tableId}` (use `partialize` + custom `name`).
  2. Or simpler: drop persistence entirely — most QR-flow customers don't reload.
- [ ] **Verification.** Scan table A → add items → scan table B → cart is empty.

---

## Phase 3 — Medium (ship next sprint)

- [ ] **M1.** Raise `eventsPerSecond` in `apps/customer-web/src/lib/supabase.ts:43` from 10 → 30.
- [ ] **M2.** Replace hardcoded `.limit(500)` in `packages/api-client/src/wrapper/menu.ts:35` with explicit pagination (`from`/`to` params) and a count.
- [ ] **M3.** SSR-prefetch the dine-in menu in `apps/customer-web/src/app/table/[tableId]/menu/page.tsx` — mirror what `/delivery/menu/page.tsx:5-17` does. Eliminates the double-fetch in `MenuScreen`.
- [ ] **M4.** Bump `staleTime` in `apps/customer-web/src/hooks/use-order.ts:24` and `use-delivery.ts:24` from 10s → 60s. Realtime invalidates anyway.
- [ ] **M5.** Add `findByIdForCustomer()` to `packages/api-client/src/wrapper/orders.ts` with a narrow SELECT (no payments/transfers/staff joins). Update `useOrder` and `useDeliveryOrder` to use it.
- [ ] **M6.** Add Cloudflare Turnstile (or hCaptcha) to feedback + waiter-call forms. Verify token server-side in the new C3 routes.
- [ ] **M7.** Audit `sentry.client.config.ts` to scrub `?token=` from URLs in events and breadcrumbs (`beforeBreadcrumb`, `beforeSend`).
- [ ] **M8.** Re-key `apps/customer-web/src/lib/api-routes.ts:13-26` rate limit by `(path, sessionId)` instead of `path`. (Mostly cosmetic — H4 says don't lean on this.)
- [ ] **M9.** Verify `supabase/migrations/20260424000001_storage_policies.sql` covers menu-image bucket. Confirm public read is intentional and signed where it shouldn't be.

---

## Phase 4 — Low

- [ ] **L1.** Prefix the cart localStorage key with a project hash to avoid cross-deployment collisions.
- [ ] **L2.** Switch realtime `event: '*'` to `event: 'UPDATE'` in `apps/customer-web/src/hooks/use-order.ts:40` once `orderId` is known.
- [ ] **L3.** Replace the silent `try/catch` in `apps/customer-web/src/lib/supabase.ts:74-80` with a Sentry `captureMessage('setTableContext.findByQrCode failed')`.
- [ ] **L4.** Add `blurDataURL` (1×1 inline) to priority menu images in `apps/customer-web/src/components/menu/menu-screen.tsx:304`.
- [ ] **L5.** Already covered by C2 — once anon cancels are tenant-scoped, the state machine + RLS compose correctly.

---

## Phase 5 — Structural (track separately, not blocking)

- [ ] **S1.** Push every anon-write policy down to the DB; drop the assumption that the API route is a security layer.
- [ ] **S2.** Adopt the convention: anon writes never carry `tenant_id` in the body. Enforce via TS types in `@gustri/database` schemas + a CI test on `pg_policies` (see C5).
- [ ] **S3.** Centralize rate limiting at one layer (edge proxy preferred) and remove the in-memory throttles or mark them clearly as UX-only.
- [ ] **S4.** Break `MenuScreen`, `CartScreen`, `OrderStatus` into smaller feature components to enable selective server-component conversion.
- [ ] **S5.** Extend `apps/customer-web/src/__tests__/lint/realtime-filter-guard.test.ts` with a sibling guard: "no anon-write hook may pass `tenant_id` from client state."

---

## Phase 6 — Verification & sign-off

- [ ] `pnpm check` clean.
- [ ] `pnpm type-check` clean.
- [ ] `pnpm test` clean. New RLS / security tests added for C1, C2, C3, C5, H2, H3.
- [ ] `pnpm db:types:check` clean (no schema drift).
- [ ] `pg_policies` diff (`/tmp/pg_policies_before.csv` vs after) reviewed and saved to PR description.
- [ ] Manual probe checklist (use anon key from `.env.local`, hit Supabase REST directly):
  - [ ] Forge `orders` insert with `table_id:null` + foreign tenant → 403.
  - [ ] PATCH another tenant's pending order to `cancelled` → 0 rows.
  - [ ] Spam 10 waiter calls in 30s for one table → 6th rejected with `53400`.
  - [ ] Get-delivery-order with expired token → NULL.
  - [ ] Order item with spoofed `item_name` → DB stores canonical name.
- [ ] Update `plans/POST_AUDIT_OPERATIONAL_FIX_PLANS.md` to reference this file as resolved.

---

## Notes / decisions log

(Append decisions and trade-offs here as you work — keeps the plan honest when reality intervenes.)

- _date_ — _decision_ — _rationale_
