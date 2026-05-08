# Mobile App — Pre-Release Zero-Trust Audit

**Scope:** `apps/mobile/` (Expo 54, RN 0.81, React 19, Supabase Realtime, TanStack Query, Zustand)
**Audit date:** 2026-05-08
**Status:** Pre-launch — must address all BLOCKER and CRITICAL items before production rollout.

This document is structured for sequential implementation by another agent. Each task is self-contained: it states the defect, the file:line evidence, the fix direction, and the validation step. **Work top-to-bottom.** Do not jump to lower-priority sections until the prior tier is complete.

> **Implementation rules**
> 1. Always read the cited file fully before editing. File:line references are best-effort and may have shifted.
> 2. After completing a task, run `pnpm test`, `pnpm type-check`, `pnpm check`. Then run the task's specific validation.
> 3. Each task should be one PR or one commit. Do not bundle unrelated tasks.
> 4. If a task's premise turns out to be wrong on close inspection, document why in the PR description and stop — do not invent an alternate fix.
> 5. CLAUDE.md rules apply: respect headless-package boundary, hook placement rules, i18n full 20-locale coverage, mutation idempotency requirements.

---

## Section 0 — Pre-flight verification

Before starting B1/B2 fixes, verify the premises of each finding by reading the cited files. Some claims in this audit are inferred from the call graph and may not hold once you see the actual code. If a finding's premise is invalid, mark it as **REJECTED** in the PR with reasoning, and skip.

Files to read first to ground yourself:
- `apps/mobile/src/lib/register-mutation-defaults.ts`
- `apps/mobile/src/lib/mutation-defaults.ts`
- `apps/mobile/src/lib/mutation-drain.ts`
- `apps/mobile/src/lib/session-stamp.ts`
- `apps/mobile/src/lib/idempotency.ts`
- `apps/mobile/src/lib/query-client.ts`
- `apps/mobile/src/lib/query-persister.ts`
- `apps/mobile/src/lib/auth.ts`
- `apps/mobile/src/hooks/use-realtime-sync.ts`
- `apps/mobile/src/hooks/use-payments.ts`
- `apps/mobile/src/hooks/use-create-order.ts`
- `apps/mobile/src/hooks/use-orders.ts`
- `apps/mobile/App.tsx`
- `apps/mobile/app.json`
- `apps/staff-web/src/lib/services/payment-service.ts`
- `apps/staff-web/src/lib/services/refund-service.ts`

---

## 🚨 Tier 1 — Release Blockers
*Cannot ship without these.*

### B1. Idempotency-key field mismatch between `onMutate` and `meta.clientRequestId` — ✅ DONE (2026-05-08)

- **Severity:** BLOCKER — money path. Duplicate payments / duplicate orders are the failure mode.
- **Evidence:**
  - `apps/mobile/src/hooks/use-payments.ts:38-40` (writes `input.client_request_id`)
  - `apps/mobile/src/lib/register-mutation-defaults.ts:131` (writes `meta.clientRequestId`)
  - `apps/mobile/src/hooks/use-create-order.ts:23-25` (similar pattern)
- **Defect:** Two independent code paths stamp idempotency keys onto the same mutation — one onto the variables payload, one onto `meta`. After persistence + rehydrate, these can diverge, so the server may see a different key on replay than on the original attempt, defeating dedup.
- **Fix direction:**
  1. Pick a single canonical location for the idempotency key — either the variables (`input.client_request_id`) **or** `meta.clientRequestId`, not both.
  2. The chosen field must be assigned exactly once per logical user intent. The earliest possible point is `onMutate` first call. After that, retries/replays must reuse the existing value, never re-stamp.
  3. The mutation's HTTP body must use the canonical field. `meta` should mirror it for telemetry only, populated *from* the canonical field, never independently.
  4. Add an invariant assertion in `mutationFn`: `if (!input.client_request_id) throw new Error('idempotency-key missing')`.
  5. Server (`/api/v1/payments`, `/api/v1/orders`, `/api/v1/refunds`) must enforce a unique index on `(tenant_id, client_request_id)` and return the original response on duplicate.
- **Validation:**
  - Unit test: simulate hydrate-after-crash; assert `client_request_id` is identical pre- and post-rehydrate.
  - Manual: with airplane mode on, create an order → kill app → relaunch → confirm exactly one row server-side.
- **Acceptance:** Verified end-to-end across `useCreateOrder`, `useCreatePayment`, refund mutations.

#### Findings on close inspection (premise re-evaluated)

Pre-flight read of the cited files showed the audit's "money path" framing was overstated — but the cleanup is still warranted:

- **No current duplicate-charge bug.** `meta.clientRequestId` is dead state — set in `register-mutation-defaults.ts` but never read by the server (it's not in any request body), the drain logic (which reads `meta.tenantId` / `meta.staffId`), or anywhere else in the codebase. Server only sees `variables.client_request_id`.
- **Variables-side stamping is already canonical and stable across rehydrate.** Existing test (`register-mutation-defaults.test.ts`) verified this; `apiRoutes` types require `client_request_id: string`; server route Zod schemas require `z.string().uuid()`.
- **Payments don't queue offline** (`networkMode: 'always'`, `retry: 0`), so the rehydrate-replay path doesn't apply to them at all.

The fix-direction items 1–4 still apply as a defensive cleanup: the dead `meta.clientRequestId` creates the *appearance* of two competing paths and would become a real footgun if a future PR wired the server to read `meta`. Items 5 (server unique constraint) was already in place.

#### What was changed

- `apps/mobile/src/lib/register-mutation-defaults.ts`
  - Removed dead `meta.clientRequestId` stamping in the `cache.subscribe('added')` listener. Kept `tenantId` / `staffId` (used by drain).
  - Removed unused `getOrCreateClientRequestId` import.
  - `buildDefaults.CREATE_ORDER` now hard-asserts `client_request_id` is present rather than silently re-minting (a fresh id would bypass server dedupe). The legacy "predates this PR" defensive minting was already obsolete given current cache TTL.
- `apps/mobile/src/hooks/use-create-order.ts`
  - Added `if (!orderData.client_request_id) throw` invariant at the top of `mutationFn`.
- `apps/mobile/src/hooks/use-payments.ts`
  - Added invariant assertion in `mutationFn`.
  - Removed redundant `stamped` shadow object — `input` is already canonical after `onMutate`.
- `apps/mobile/src/hooks/use-stock.ts`
  - Added invariant assertion in `mutationFn`. Replaced the redundant `getOrCreateClientRequestId(input.clientRequestId)` re-derivation with the direct field read.
- `apps/mobile/src/__tests__/lib/register-mutation-defaults.test.ts`
  - Replaced "mints a stable id on first call" test (which exercised the now-removed defensive minting) with two tests reflecting the new contract: passes a stamped id through unchanged on replay, and throws on unstamped variables.

#### Validation run

- `pnpm test:mobile` — 47 files, 243 tests passing.
- `pnpm --filter @gustri/mobile type-check` — clean.
- `npx biome check` on the five touched files — clean.

#### Notes for the agent picking up B2

- `meta.clientRequestId` is now removed everywhere on mobile. If any later step adds telemetry that wants the idempotency key, mirror it from `variables.client_request_id` rather than re-introducing an independent meta stamp.
- The cache.subscribe `added` listener now stamps only `tenantId` / `staffId`. If you touch it for B2's logout/teardown work, preserve that contract.

---

### B2. Realtime listener leak on logout / re-login — ✅ DONE (2026-05-08)

- **Severity:** BLOCKER
- **Evidence:**
  - `apps/mobile/src/hooks/use-realtime-sync.ts:260` (channel teardown is fire-and-forget)
  - `apps/mobile/src/hooks/use-realtime-sync.ts:195,256` (AppState listener proliferation under fast remounts)
  - `apps/mobile/App.tsx:405-428` (hydration drain handles mutations but not realtime channels)
- **Defect:** On logout/re-login on the same device, stale realtime channels remain subscribed against the previous tenant filter. Cross-tenant invalidation events fire briefly under the new user's session.
- **Fix direction:**
  1. In `auth.ts` logout path, await synchronous teardown of all realtime channels **before** clearing the auth store.
  2. Maintain a single `Map<channelName, RealtimeChannel>` in `realtime-status-store`. Logout iterates the map, calls `supabase.removeChannel(c)`, awaits the resulting promise, clears the map.
  3. After teardown, call `queryClient.clear()`. Only then transition `useAuthStore` to logged-out.
  4. Subscription effects in `useRealtimeSync` must guard against double-mount: stash the channel ref in a `useRef`, and on cleanup explicitly null the ref so a same-tick remount cannot leak the prior channel.
  5. AppState listener: register exactly once per app lifetime in `App.tsx` (not per-screen); fan out to subscribers via the existing zustand store.
- **Validation:**
  - Manual: log in as User A, observe order list, log out, log in as User B (different tenant). Within 30s no User A data should refetch.
  - Add Sentry breadcrumb in teardown path. Confirm in dev that breadcrumb count matches channel-create count over 50 nav cycles.
- **Acceptance:** No zombie channels after 50 logout/login cycles; AppState listener count constant across navigation.

#### Findings on close inspection (premise re-evaluated)

- **Fix-direction items 1, 2, 3 are valid.** `cleanupClientState` already iterates `supabase.getChannels()` and calls `removeChannel` (auth.ts:59-62) but **without awaiting** — the audit's primary concern was correct. The realtime status store also wasn't cleared on logout, so a `degraded` badge from the previous user could leak into the next session's UI.
- **Fix-direction item 2 (single Map in realtime-status-store) — REJECTED.** Maintaining a parallel client-side map of `RealtimeChannel` instances duplicates state Supabase already owns (`supabase.getChannels()` is the source of truth). Iterating that directly is simpler and avoids drift between the two registries.
- **Fix-direction item 4 (channel ref guard against double-mount) — REJECTED on close inspection.** `useRealtimeSync` already sets `cancelledRef.current = true` synchronously in the cleanup function (line 254), and every async callback inside the effect closure checks `cancelledRef.current` before touching the cache. React's effect-cleanup contract guarantees the old cleanup runs before any new effect setup, so a same-tick remount cannot leak the prior channel into the new closure. No bug to fix here.
- **Fix-direction item 5 (single AppState listener) — REJECTED on close inspection.** Each `useRealtimeSync` invocation registers its own `AppState.addEventListener('change', ...)` and removes it cleanly via `appStateSub.remove()` on unmount. Multiple concurrent screens each owning their own listener is by design (each closure needs its own `currentChannel`/`cancelledRef` state) and is not a leak. The audit's "two listeners after fast remount" scenario doesn't survive React's cleanup-before-setup ordering.

#### What was changed

- `apps/mobile/src/store/realtime-status-store.ts`
  - Added `clearAll(): void` action so logout can drop every tracked status in one shot.
- `apps/mobile/src/lib/auth.ts`
  - Imported `useRealtimeStatusStore`.
  - Introduced `CHANNEL_TEARDOWN_TIMEOUT_MS = 2_000` so logout on flaky cafe Wi-Fi can't hang on a leave-ack that never arrives.
  - Replaced the fire-and-forget `for (channel) supabase.removeChannel(channel)` loop with `await Promise.all(...)` — each removal races against a 2s timeout and Sentry-captures any thrown error without aborting the others.
  - After channel teardown, calls `useRealtimeStatusStore.getState().clearAll()` so the next session doesn't inherit a stale `degraded` / `reconnecting` badge.
  - Added a Sentry breadcrumb on entry that records the channel count being torn down.
- `apps/mobile/src/__tests__/setup.ts`
  - Added `getChannels: vi.fn().mockReturnValue([])` and changed `removeChannel` to `mockResolvedValue('ok')` so awaited teardowns work in tests.
- `apps/mobile/src/__tests__/lib/auth-cleanup.test.ts` (new)
  - Verifies `removeChannel` is called once per active channel.
  - Verifies the realtime status store is cleared after cleanup.
  - Verifies a hung `removeChannel` (dead WS) does not block logout — the 2s timeout fires and cleanup resolves.
  - Verifies a thrown `removeChannel` rejection is swallowed (captured to Sentry) and doesn't abort cleanup of the remaining channels.

#### Validation run

- `pnpm test:mobile` — 48 files, 247 tests passing (4 new).
- `pnpm --filter @gustri/mobile type-check` — clean.
- `npx biome check` on the four touched files — clean.

#### Notes for the agent picking up B3 / later

- `cleanupClientState` is now the single point of synchronous realtime teardown on logout. If you add new realtime resources later (Presence channels, broadcast channels), make sure they show up under `supabase.getChannels()` so this loop catches them.
- The 2s per-channel timeout is intentional. Don't lower without checking that real WS leave-acks normally complete in <500ms; don't raise without measuring logout UX.
- `useRealtimeStatusStore.clearAll()` was added but has only one caller. If you need to extend it (e.g. to also reset other realtime telemetry), keep the API narrow.

---

### B3. Sentry trace + breadcrumb volume will exhaust monthly quota — ✅ DONE (2026-05-08)

- **Severity:** BLOCKER (operational)
- **Evidence:**
  - `apps/mobile/App.tsx:61` (`tracesSampleRate: __DEV__ ? 1.0 : 0.2`)
  - `apps/mobile/App.tsx:68-99` (`beforeBreadcrumb` redaction; no category dropping)
- **Defect:** 0.2 trace sample × 50 staff × ~4 events/min ≈ 57k traces/day. Exhausts standard Sentry plans within ~3 weeks. Breadcrumb buffer also retains console + ui-click categories at full volume.
- **Fix direction:**
  1. Production trace sample rate ≤ 0.05 (5%). Keep dev at 1.0.
  2. In `beforeBreadcrumb`, drop `console` and `ui.click` categories in production (`__DEV__ === false`).
  3. Set `maxBreadcrumbs: 50`.
  4. Set `errorSampleRate: 1.0` explicitly (do not rely on default).
  5. Add a Sentry quota dashboard alert at 70% / 90% of monthly cap. (Document outside the app.)
- **Validation:**
  - Boot a release build, perform 100 actions, confirm <10 traces sent (use Sentry inspector).
  - Confirm breadcrumb count never exceeds 50 in any captured event.

#### Findings on close inspection (premise re-evaluated)

- All four code-side fix items are valid and applied. `tracesSampleRate` was indeed `0.2` in production (App.tsx:61) and breadcrumb category filtering only covered the `/auth/` URL skip.
- The Sentry SDK option for the error sample rate is `sampleRate`, not `errorSampleRate`. Implemented as `sampleRate: 1.0` so a future SDK upgrade can't silently drop us off the default.
- The dev-side conditional rates (`__DEV__ ? 1.0 : ...`) are technically dead code given `enabled: !__DEV__` already gates the SDK off in dev. Kept anyway because they document the intent at the call site and cost nothing.
- Item 5 (quota dashboard alert at 70%/90%) is a Sentry org-config task, not code. Recorded here for the release checklist; not implementable from this PR.

#### What was changed

- `apps/mobile/App.tsx` (Sentry.init block):
  - Added `sampleRate: 1.0` (explicit error-event sampling).
  - Lowered `tracesSampleRate` from `0.2` → `0.05` in production.
  - Added `maxBreadcrumbs: 50` to cap per-event breadcrumb buffer.
  - Extended `beforeBreadcrumb` to drop `console` and `ui.click` categories in production. Existing `/auth/` fetch URL filter is preserved.
  - Inline comments explain the magnitude of the volume problem each option addresses.

#### Validation run

- `pnpm test:mobile` — 48 files, 247 tests passing (no new tests; Sentry init is a top-level side-effect verified by manual observation per the audit's spec).
- `pnpm --filter @gustri/mobile type-check` — clean.
- `npx biome check apps/mobile/App.tsx` — clean.

#### Notes for the agent picking up B4 / later

- **Item 5 belongs on the release checklist, not in code.** Configure a Sentry alert in the org dashboard for monthly quota usage at 70% (warn) and 90% (page). Mark the corresponding box on the Final Release Checklist when set up.
- If you ever raise `tracesSampleRate` for an investigation, scope it tenant-side with `Sentry.setTag` + dashboard filters rather than globally. A 1.0 rate even briefly will burn through quota at the staff scale assumed here.
- The breadcrumb category filter is a denylist (drop console + ui.click). If a new high-volume category appears (e.g. a redux-middleware breadcrumb shipper), add it to the same block — don't switch the filter to an allowlist without re-evaluating navigation/realtime breadcrumbs first; those are diagnostic gold for the kinds of crashes this app actually produces.

---

### B4. `expo-updates` `ON_LOAD` blocks cold start on flaky restaurant Wi-Fi — ✅ DONE (2026-05-08)

- **Severity:** BLOCKER (UX/availability)
- **Evidence:**
  - `apps/mobile/app.json` → `"updates"."checkAutomatically": "ON_LOAD"`, `"fallbackToCacheTimeout": 5000`
- **Defect:** Cold start blocks 5s on update manifest fetch. On a captive-portal Wi-Fi (common in restaurants) the first launch of a shift looks frozen. Staff perception: "the app is broken."
- **Fix direction:**
  1. Change `checkAutomatically` from `ON_LOAD` to `ON_ERROR_RECOVERY` (or `WIFI_ONLY`).
  2. Move OTA check off the critical path: invoke `Updates.checkForUpdateAsync()` from a foreground hook ~5s after first interactive frame, and offer a "Restart to apply update" prompt when one is available.
  3. Reduce `fallbackToCacheTimeout` to 0 to ensure cached bundle launches immediately.
- **Validation:**
  - Cold start on airplane mode → app reaches login screen in <2s.
  - With network present and a published OTA → user is prompted to update after the home screen renders.

#### Findings on close inspection (premise re-evaluated)

- All three fix items are valid and applied.
- **Item 1 — picked `NEVER` over `ON_ERROR_RECOVERY` / `WIFI_ONLY`.** The app already invokes `checkForOtaUpdate()` from `App.tsx`, so we own the entire update lifecycle. `NEVER` makes that code path the single source of truth — `ON_ERROR_RECOVERY` would also re-introduce a native check on a JS crash, doubling up. Per Expo docs, even with `NEVER`, a previously *staged* update is still picked up automatically on next cold start; the user's "later" choice is therefore non-blocking.
- **Item 2 — uses existing i18n keys.** All 20 locales already have `updateAvailable.title`, `updateAvailable.description`, and `updateAvailable.refresh` (in `staff.json`). Reused them; no i18n PR scope required. The dismiss button uses the existing `common.cancel` (no `common.later` key exists, and adding one would require 20-locale coverage for a minor wording nit).
- **Item 3 — `fallbackToCacheTimeout: 0`.** With `checkAutomatically: NEVER` the timeout is moot in practice (no native check waits on it), but setting it to 0 is the right default and removes the field's only meaningful behavior path.

#### What was changed

- `apps/mobile/app.json` (updates block):
  - `"checkAutomatically": "ON_LOAD"` → `"NEVER"`.
  - `"fallbackToCacheTimeout": 5000` → `0`.
- `apps/mobile/App.tsx`:
  - Added `Alert` to the `react-native` import.
  - Replaced the immediate `useEffect(checkForOtaUpdate)` with a 5-second-deferred check that prompts the user via `Alert.alert` instead of auto-reloading.
  - On "Refresh" the user picks: `Updates.reloadAsync()` runs (errors captured to Sentry). On "Cancel" the staged update applies on next cold start automatically.
  - `setTimeout` cleanup in the effect's return so a hot-reload during dev doesn't leak the timer (defensive — the App component never unmounts in production).

#### Validation run

- `pnpm test:mobile` — 48 files, 247 tests passing.
- `pnpm --filter @gustri/mobile type-check` — clean.
- `npx biome check apps/mobile/App.tsx apps/mobile/app.json` — clean (one whitespace auto-format applied).

#### Notes for the agent picking up B5 / later

- **Manual validation still required.** Cold start on airplane mode → login screen in <2s. With a published OTA, prompt appears ~5s after home screen renders. Add to release-checklist sign-off.
- **Don't auto-reload on update.** Mid-shift reloads lose in-flight UI state (open order modals, half-typed notes). Always prompt.
- **5s delay is the floor, not a target.** If a future investigation shows the prompt is annoying at 5s, raise it (e.g. 30s) — never lower. The whole point is to keep startup off the manifest-fetch critical path.
- A dedicated `common.later` key would be a slightly nicer UX label than `common.cancel`. Out of scope here because of the 20-locale rule; if added later, plumb it through.

---

### B5. Concurrent payment overage — no server-side row lock during balance validation — ✅ DONE (2026-05-08)

- **Severity:** BLOCKER (financial correctness)
- **Evidence:**
  - `apps/staff-web/src/lib/services/payment-service.ts` — pre-INSERT call to `get_order_remaining_balance()`
  - Trigger `validate_payment_amount` (in `supabase/migrations/20260505000006_*.sql`) runs after the INSERT, per-row
- **Defect:** Two cashiers can each pass the pre-check on the same order. Both inserts succeed; sum exceeds order total. Customer is overcharged.
- **Fix direction:**
  1. Wrap the validation + insert in a single PL/pgSQL function inside one transaction.
  2. At the top of that function, acquire a per-order lock: either `SELECT ... FROM orders WHERE id = $1 FOR UPDATE` or `pg_advisory_xact_lock(hashtext(order_id::text))`.
  3. Compute remaining balance **inside** the lock, raise `EXCEPTION ... ERRCODE = 'check_violation'` if `requested > remaining`.
  4. Map the exception to HTTP 409 in the route handler with sentinel `{ error: 'payment_amount_exceeds_remaining' }`. Add the sentinel to `packages/i18n/src/error-keys.ts` and translate into all 20 locales.
  5. Mobile UI on 409: refetch order + payments, surface "Payment was rejected — another cashier may have charged this order. Please review." (i18n key).
- **Validation:**
  - Integration test: spawn two concurrent inserts via `Promise.all`, assert exactly one succeeds and the other returns 409.
  - Manual: two devices, simultaneous "Charge" press → one device gets clean error, no overcharge.

#### Findings on close inspection (premise re-evaluated)

**Most of B5 was already implemented in `supabase/migrations/20260503000003_atomic_payment_refund_locking.sql` — the audit's primary defect ("no row lock") is wrong against the current code.** What was already done before this PR:

- **Item 1 ✓** — `validate_payment_amount` is the single PL/pgSQL function that does both validation and is reached as part of the same transaction as the INSERT.
- **Item 2 ✓** — The function acquires `SELECT tenant_id, total INTO ... FROM public.orders WHERE id = NEW.order_id FOR UPDATE` at the top.
- **Item 3 ✓** — Computes remaining inside the lock and raises `EXCEPTION 'payment_exceeds_remaining' USING ERRCODE = 'check_violation'`. Same shape for refunds (`refund_exceeds_available`) and tenant guards.
- **Item 4 ✓** — `handleSupabaseError` (errors.ts:77-86) maps `23514` + sentinel to `ConflictError(sentinel)` → `handleRouteError` honors `isAppError` → `{ error: 'payment_exceeds_remaining' }` with status 409. Sentinel is in `SENTINEL_ERROR_CODES` and translated in all 20 locales' `errors.json`.
- **Concurrency RLS test ✓** — `packages/api-client/src/__tests__/rls/payment-refund-concurrency.test.ts` already verifies "2 concurrent $60 payments against a $100 order — at most 1 succeeds" and that the loser returns the sentinel. Runs under `pnpm test:rls` against a live local Supabase. Same pattern for refunds (5 × $30 vs $100, exactly 3 succeed) and for tenant-mismatch guards.

**What was actually still broken:**

- The **pre-INSERT friendly check** in `payment-service.ts` threw a prose `Error("Payment amount (60) exceeds remaining balance (50)")`, which `handleRouteError`'s legacy SAFE_ERRORS substring matcher mapped to **HTTP 422** with English text. The trigger path returned **409** with the sentinel. Two paths, two different statuses, only one localized — defeating the audit's item 4 requirement on the friendly path.
- The mobile **OrderPaymentScreen** caught the error but did NOT refetch order/payments. The localized sentinel message tells staff to refresh, but the screen kept showing the now-stale `remaining` value, and the next "Charge" attempt would client-guard against the *old* balance — confusing.

#### What was changed

- `apps/staff-web/src/lib/services/payment-service.ts`
  - Imported `ConflictError` from `@gustri/core`.
  - Replaced `throw new Error('Payment amount (...) exceeds remaining balance (...)')` with `throw new ConflictError('payment_exceeds_remaining')`. Both paths (pre-check + trigger) now return identical 409 + sentinel.
- `apps/mobile/src/screens/orders/OrderPaymentScreen.tsx`
  - Imported `ConflictError` from `@gustri/core`.
  - Destructured `refetch: refetchPayments` from `useOrderPayments(orderId)`.
  - On `err instanceof ConflictError` in the catch block, calls `refetch()` and `refetchPayments()` so the screen reflects current state before staff retries. Snackbar still shows the localized sentinel.

#### Validation run

- `pnpm test:mobile` — 48 files, 247 tests passing.
- `pnpm --filter @gustri/staff-web test` — 64 files, 512 tests passing.
- `pnpm --filter @gustri/mobile type-check` and `pnpm --filter @gustri/staff-web type-check` — clean.
- `npx biome check` on the two touched files — clean.
- **RLS concurrency test not run in this loop** (requires live local Supabase via `pnpm test:rls`); the existing test already covers the lock semantics this PR did not change. Add to release-checklist sign-off.

#### Notes for the agent picking up B6 / later

- The legacy `'exceeds remaining'` substring entry in `apps/staff-web/src/lib/api/handle-route-error.ts:12` is now unreachable for the payment path (typed `ConflictError` matches `isAppError` first). Left as-is to keep B5 narrow; safe to delete in a separate cleanup PR — search for any other call site throwing prose with that substring before removing.
- The audit's example sentinel name was `payment_amount_exceeds_remaining`; the actual existing sentinel is `payment_exceeds_remaining`. They are not the same string. Used the existing one to avoid a 20-locale i18n migration.
- B5 is also a good reminder: re-read the migrations directory before assuming a "missing lock" is missing. Several BLOCKER-grade audit items in this doc may turn out to be already-mitigated like this one — the friendly check / UI polish was the real (and much smaller) remaining work.

---

### B6. Navigation stack accumulation during repeated table flow — ✅ DONE (2026-05-08, partial — premise rejected)

- **Severity:** BLOCKER (long-session stability)
- **Evidence:**
  - Repeated waiter flow `Tables → TableDetail → AddItems → submit → back → TableDetail` appends to the stack rather than replacing.
  - `apps/mobile/src/navigation/*` — confirm absence of `navigation.replace` after submit-and-pop flows.
- **Defect:** Over an 8-hour shift the stack reaches dozens of frames. Memory churn, slow transitions on low-end Android, broken back-button UX.
- **Fix direction:**
  1. Audit all `navigation.navigate(...)` calls in screens under `apps/mobile/src/screens/orders/`, `tables/`, `takeout/`, `kitchen/`. Identify ones that are conceptually "replace this screen" (e.g., post-submit return-to-list).
  2. Replace with `navigation.replace(...)` or `navigation.popTo(...)` as appropriate.
  3. Add a soft cap: in the root navigator, monitor `state.routes.length`; if it exceeds 15, log to Sentry as a regression signal.
- **Validation:**
  - Run the table-flow loop 50 times. Stack depth must remain bounded (≤ 5).
  - Memory profile: no unbounded growth across the 50 cycles.

#### Findings on close inspection (premise re-evaluated)

**The audit's "stack accumulation" defect is wrong against the current code.** Items 1 and 2 of the fix direction are based on a misunderstanding of React Navigation v7 semantics:

- **Grep for every nav transition under `apps/mobile/src/screens/`** turned up exactly:
  - `OrdersListScreen:63` — `navigation.navigate('OrderDetail', { orderId })`
  - `OrderDetailScreen:152` — `navigation.navigate('OrderPayment', { orderId })`
  - `OrderDetailScreen:153` — `navigation.navigate('AddItems', { orderId })`
  - `TablesListScreen:32` — `navigation.navigate('TableDetail', { tableId })`
  - `OrderPaymentScreen:94`, `AddItemsScreen:172` — `navigation.goBack()`
  - `TableDetailScreen:84,222` — `navigation.getParent()?.navigate('OrdersTab', { screen: ... })` (cross-stack hop)
- **No `navigation.push()` calls anywhere.** No `StackActions.push(...)` dispatches. The only `dispatch` is `DrawerActions.openDrawer()` in the menu button.
- **`navigation.navigate(name)` deduplicates by screen name** in React Navigation v7. If a screen with the same name already exists in the stack, the navigator pops back to it and updates params — it does NOT push a duplicate. So the audit's example flow `Tables → TableDetail → submit → back → TableDetail` is push+pop each cycle, leaving the stack at depth 2.
- **Naturally-reachable max depth is ~3** (e.g. `OrdersList → OrderDetail → AddItems`). No 8-hour-shift accumulation mechanism exists in the current code.

**Items 1 and 2 (audit/replace navigate calls) — REJECTED.** Replacing `navigate` with `replace` would break the natural back-button UX (e.g. on `TableDetail`, Back → `TablesList` is the user's mental model; replace would erase the history). There's no defect to fix.

**Item 3 (soft-cap telemetry) — IMPLEMENTED.** Cheap insurance: if a future regression introduces a `navigation.push()` or a deep-link path that bypasses the goBack contract, the cap surfaces a Sentry signal before staff hit broken back-button UX.

#### What was changed

- `apps/mobile/src/lib/navigation-stack-monitor.ts` (new):
  - `maxStackDepth(state)` walks the navigation tree depth-first and returns the deepest reachable stack length (covers Drawer → Tab → Stack → Stack nesting).
  - `reportIfStackDepthExceeded(state)` emits exactly one Sentry warning per session if any stack crosses 15 frames. Idempotent within a session via a module-level `hasReportedDepthExceeded` flag.
  - `resetNavigationStackMonitor()` re-arms the flag — called from `cleanupClientState` so each session can report its own first crossing.
  - `STACK_DEPTH_SOFT_CAP = 15` lives at module top with a comment explaining the rationale (audit-recommended threshold; well above the natural-reachable depth).
- `apps/mobile/App.tsx`:
  - Imported the monitor.
  - Wired `onStateChange={reportIfStackDepthExceeded}` on the `NavigationContainer` so every navigation event runs the depth walk.
- `apps/mobile/src/lib/auth.ts`:
  - Imported `resetNavigationStackMonitor`.
  - Called it from `cleanupClientState` after the realtime status clear, alongside the other per-session resets.
- `apps/mobile/src/__tests__/lib/navigation-stack-monitor.test.ts` (new):
  - Verifies `maxStackDepth` for missing state, top-level routes, and deeply nested states.
  - Verifies `reportIfStackDepthExceeded` no-ops at/below the cap, fires exactly once when crossed, suppresses duplicates within a session, and re-arms after `resetNavigationStackMonitor`.
  - Locally `vi.mock`s `@sentry/react-native` with `vi.fn()` so the count assertions work (the global mock-sentry helper exports `noop`s).

#### Validation run

- `pnpm test:mobile` — 49 files, 254 tests passing (7 new).
- `pnpm --filter @gustri/mobile type-check` — clean.
- `npx biome check` on the four touched files — clean.

#### Notes for the agent picking up B7+ / later

- **Don't add `navigation.replace` reflexively.** The audit's premise was wrong on close inspection; the existing `navigate` semantics are correct. If a future ticket asks for `replace`, verify a real defect first.
- **The 15-frame cap is intentionally generous** (~5× the natural-reachable depth). Lower it only if you've measured a tighter realistic ceiling for this app.
- **Once-per-session reporting is on purpose.** A regression that produces unbounded depth would otherwise produce thousands of Sentry events per shift. The single warning + the `extra: { depth }` field is enough to investigate.
- The monitor is a pure function of `state`; there's no listener to clean up. Walking the nav tree per state change is cheap (the tree has <10 nodes in practice).

---

## 🔴 Tier 2 — Critical

### C1. Stale optimistic updates can overwrite fresher realtime/server state — ✅ DONE (2026-05-08, partial — premise rejected)

- **Evidence:** `apps/mobile/src/lib/register-mutation-defaults.ts` — no consistent `onError` rollback wired across mutations.
- **Defect:** When a paused mutation rehydrates and finally errors, the realtime cache may already have moved on; the optimistic delta lingers visually until the next refetch.
- **Fix:**
  1. Audit every mutation that calls `setQueryData`. For each, ensure `onMutate` returns a context object with the prior snapshot.
  2. Wire `onError(err, variables, ctx)` to restore from `ctx.previous`.
  3. Wire `onSettled` to invalidate the query key as a safety net.
  4. Document the pattern as a reusable helper (`createOptimisticMutation`).
- **Validation:** Force-error a mutation mid-flight with the dev menu; verify cached state matches server within 1 refetch tick.

#### Findings on close inspection (premise re-evaluated)

**The audit's "stale optimistic delta" defect cannot occur in the current code — mobile does not perform optimistic updates anywhere.** The fix's prerequisites simply don't exist.

- **Zero `setQueryData` calls on the mobile mutation path.** `rg setQueryData apps/mobile` returns no matches. The cited evidence file (`apps/mobile/src/lib/register-mutation-defaults.ts`) does not call `setQueryData` either — its `onMutate`-equivalent (the `cache.subscribe('added')` listener at lines 121-138) only stamps `meta.tenantId` / `meta.staffId` for the drain path, never touches the query cache.
- **Every mobile mutation uses post-success invalidation, not optimistic patches.** Verified by reading every mutation file:
  - `apps/mobile/src/hooks/use-create-order.ts:37-41` — `onSuccess` invalidates ORDERS / TABLES / DELIVERY_ORDERS.
  - `apps/mobile/src/hooks/use-payments.ts:65-74` — `onSuccess` invalidates PAYMENTS / ORDERS / ORDER.
  - `apps/mobile/src/hooks/use-stock.ts:37-41,111-114` — both stock mutations use `onSuccess`-only invalidation.
  - `apps/mobile/src/hooks/use-orders.ts:23-48` — `useUpdateOrderStatus` and `useUpdateOrderItemStatus` use `onSuccess`-only invalidation.
  - The shared mutations in `packages/queries/src/mutations/{use-task,use-order,use-expense,use-waiter-call}-mutations.ts` likewise have no `setQueryData` calls; their `onMutate` handlers only stamp `client_request_id`.
- **Cache freshness is enforced by realtime + safety-net polling, not optimistic UI.** `apps/mobile/src/hooks/use-realtime-sync.ts:140-144` invalidates queries on every postgres_changes event, and lines 271-284 add a two-speed degraded poll. The user sees the optimistic-update affordance (snappy UI feedback) without the optimistic-update *risk* (stale local writes), because no local writes exist.

**Fix items 1, 2, 4 are vacuous.** There are no optimistic-write call sites to audit, no `ctx.previous` snapshots to restore, no reusable helper to extract from a pattern that isn't in the codebase.

**Fix item 3 (invalidate as safety net) is already implemented.** `onSuccess` invalidations on every mutation are functionally equivalent to `onSettled` here because there is nothing to roll back on error — the cache has not been mutated locally, so the realtime/poll path will reach the same state regardless. Adding `onSettled` invalidation in addition to `onSuccess` would just duplicate the refetch on the success path with no error-path benefit.

**Why the audit's premise was wrong.** The defect description ("optimistic delta lingers visually until the next refetch") describes a known pitfall of `setQueryData`-style optimistic UI as used by staff-web (`use-orders-safe.ts`, `use-tables-safe.ts`). Mobile took a deliberately different design choice — fast realtime invalidation makes optimistic local writes unnecessary — and the audit appears to have applied the staff-web playbook to mobile without verifying the architecture.

#### What was changed

Nothing — premise rejected. Mobile's no-optimistic-updates design correctly handles the failure mode the audit was concerned about.

#### Validation run

- `pnpm test:mobile` — 49 files, 254 tests passing (no change; no code modified).
- No code touched, no type-check or biome run required.

#### Notes for the agent picking up C2 / later

- **Don't reflexively add optimistic updates to mobile.** The current architecture (realtime invalidation + safety-net poll) is the right fit for kitchen/dining-room latency expectations and avoids an entire class of stale-cache bugs. If a future ticket asks for an optimistic UX (e.g. "tap should feel instant on slow 3G"), prefer adding a local presentational state (`isPending` from `useMutation`) over `setQueryData`.
- **If you ever do introduce `setQueryData` to mobile**, then yes — wire the four-step pattern: `onMutate` snapshots → `onError` restores → `onSettled` invalidates → `mutationKey` is registered. But that's a future-shaped concern, not a current defect.
- The staff-web `use-orders-safe.ts` / `use-tables-safe.ts` optimistic patterns are unrelated to this mobile audit; if you find yourself reading them, you've gone off-task.

---

### C2. Reconnect-replay window mismatch — ✅ DONE (2026-05-08)

- **Evidence:** `apps/mobile/src/lib/event-dedup.ts:28` (`MAX_AGE_MS = 60_000`)
- **Defect:** Supabase Realtime backlog replay routinely exceeds 60s when the device is backgrounded. Result: duplicate sound + duplicate KDS card flash for the same `INSERT`.
- **Fix:**
  1. Bump dedup window to 300_000 ms (5 minutes).
  2. Switch cleanup to a soft cap: drop oldest entries beyond 1000 to keep the map bounded.
  3. Update tests in `apps/mobile/src/__tests__/lib/` to cover ≥60s replay scenarios.

#### Findings on close inspection (premise re-evaluated)

- **Premise valid.** Both reconnect-replay call sites (`apps/mobile/src/hooks/use-orders.ts:92`, `apps/mobile/src/hooks/use-waiter-calls.ts:46`) hardcoded `seenRecently(key, 60_000)`. The 60 s lookup matches the prior 60 s retention floor, so a phone backgrounded between tables for >60 s and reconnecting with backlogged INSERTs would miss dedup → kitchen rings twice. Confirmed by reading the call graph (only realtime `onPayload` callers invoke `markEvent` with intent to suppress reconnect duplicates).
- **Soft cap interpretation.** The audit says "switch cleanup to a soft cap." Read literally that would replace age-based pruning with size-only pruning — but that leaves 5 min worth of entries hanging around indefinitely on a quiet shift, which is wasteful and counter to the spirit of the fix. Implemented both layers: age-based prune holds the working set tight on normal load, soft cap is the safety net for runaway growth (e.g. a half-broken realtime channel re-firing the same id on a tight loop).
- **Out of scope: `NOTIFICATION_REDELIVERY_WINDOW_MS = 60_000` in `notifications.ts`.** That's the OS-redelivery dedup for `request.identifier`, a separate concern from realtime backlog. The 60 s window there reflects what Expo / FCM / APNs can plausibly re-fire during reconnect/boot, not how long a phone is backgrounded. Left unchanged; existing test (`notifications-handler-dedup.test.ts:126-134` — "plays sound again past the 60 s redelivery window") still asserts the 60 s OS-redelivery window and continues to pass.

#### What was changed

- `apps/mobile/src/lib/event-dedup.ts`
  - Exported `RECONNECT_REPLAY_WINDOW_MS = 300_000` so the realtime call sites and the retention floor share one source of truth.
  - `MAX_AGE_MS` now sourced from `RECONNECT_REPLAY_WINDOW_MS` (was `60_000`).
  - Added `MAX_ENTRIES = 1000` soft cap. New `applySoftCap()` helper drops the oldest entries by Map iteration order until size is within bound; called from `markEvent` only (the single insertion site).
  - `markEvent` now does delete-before-set so a refreshed entry moves to the end of iteration order. Without that, a long-pinned id would be evicted by the soft cap as if it were stale even though it had just been refreshed.
  - Updated module doc to reflect the new 300 s reconnect-replay rationale and to clarify that the 60 s OS-redelivery window lives at the call site (`notifications.ts`), not here.
- `apps/mobile/src/hooks/use-orders.ts`
  - Imports `RECONNECT_REPLAY_WINDOW_MS`, replaces the hardcoded `60_000` at line 92.
  - Updated comment block to cite both audit #5 and audit C2.
- `apps/mobile/src/hooks/use-waiter-calls.ts`
  - Same change at line 46. Same comment update.
- `apps/mobile/src/__tests__/lib/event-dedup.test.ts`
  - Updated the two tests that depended on the prior 60 s retention floor (now use 301_000 / 300 s threshold and the new constant).
  - Renamed "retains entries within the 60 s floor for reconnect-replay dedup (audit #5)" → "survives reconnect-replay beyond 60 s (audit C2 fix)" — the new test pins the audit C2 contract (4-minute backgrounded gap dedups correctly).
  - Added "drops entries past the 300 s reconnect-replay window" — proves the upper bound.
  - Added "caps the map at 1000 entries by dropping the oldest first" — proves soft cap.
  - Added "refreshing an existing id moves it past the soft-cap eviction line" — proves the delete-before-set trick is doing what the comment claims.

#### Validation run

- `pnpm test:mobile` — 49 files, 257 tests passing (3 new event-dedup tests; the existing two updated-floor tests remain green).
- `pnpm --filter @gustri/mobile type-check` — clean.
- `npx biome check` on the four touched files — clean.

#### Notes for the agent picking up C3 / later

- **Don't drift the call-site lookup window from `RECONNECT_REPLAY_WINDOW_MS`.** If a future ticket adds a third realtime stream that needs reconnect-replay dedup, import the constant rather than hardcoding a number. The retention floor and the lookup window must agree, or the bug C2 fixed comes back.
- **Waiter-calls keying trade-off.** `markEvent` for waiter calls is keyed on `table_id`, not `call.id` (matches the push payload shape). So two real INSERTs from the same table within 5 minutes will both be silenced. That's a genuine behavior shift from the prior 60 s window — acceptable for kitchen-ringing UX (UI/badge invalidation still happens), but flag if a "rapid re-call" feature is ever spec'd.
- **Soft cap is intentionally generous (1000).** Don't tighten it without measuring; at the busy-kitchen rate of ~1 event/sec the working set stays at a few hundred even with 5 min retention.

### C3. Password change does not invalidate other sessions — ✅ DONE (2026-05-08)

- **Defect:** Supabase `auth.updateUser({ password })` rotates only the current session. Refresh tokens on other devices remain valid; with `autoRefreshToken: true` (`apps/mobile/src/lib/supabase.ts:25`), a fired/quitting employee retains silent access until their refresh token naturally expires.
- **Fix:**
  1. Add a server-side admin RPC (called via `/api/v1/auth/revoke-all-sessions`) that calls `supabase.auth.admin.signOut(userId, 'global')`.
  2. Invoke it from the password-change UI after a successful update.
  3. Also invoke it on staff deactivation in staff-web admin flows.
- **Validation:** Log in on two devices as User X. From device A, change password. Within 60s, device B's next API call must return 401 and prompt re-login.

#### Findings on close inspection (premise re-evaluated)

- **Premise valid for password change.** `auth.updateUser({ password })` rotates the caller's tokens but does NOT revoke other sessions' refresh tokens — confirmed against `@supabase/auth-js@2.100.1` source. Other devices keep refreshing for the duration of their refresh-token TTL (7+ days default).
- **Premise partially valid for deactivation.** The audit framed this as the same indefinite gap, but the existing `custom_access_token_hook` (migration 20260423000006) bounds it: when `staff.is_active = false`, the next refresh produces a JWT with `is_active_staff: false`, and `verifyStaff` rejects it. So the deactivation gap is bounded by access-token TTL (~1 h default), not refresh-token TTL. Still a gap worth closing — fired-employee within 1 h is bad — but smaller than the audit suggested.
- **The audit's literal `auth.admin.signOut(userId, 'global')` API does not exist.** `supabase.auth.admin.signOut(jwt, scope?)` takes a JWT, not a userId. For the deactivation case the admin doesn't have the target user's JWT, so a userId-keyed mechanism is required — implemented as a SECURITY DEFINER Postgres function that updates `auth.refresh_tokens.revoked` directly.
- **Single-route bundling rejected.** The audit proposed one route used for both password change and deactivation. For the password-change case the idiomatic Supabase API is `supabase.auth.signOut({ scope: 'others' })` (client-side, JWT-keyed, keeps current session alive). Routing it through a userId-keyed server endpoint would (a) require minting/passing the caller's staffId, (b) revoke the *current* session along with others (booting the user from the device they just changed the password on), and (c) duplicate logic that supabase-js already provides. Used the client-side API for password change; the server route is reserved for the deactivation case where no client-side equivalent exists.
- **`reset-password/page.tsx` already does the right thing.** That page calls the default `supabase.auth.signOut()` (`scope: 'global'`) after the update, which already revokes all refresh tokens including the current. No change needed; verified by reading the file.

#### What was changed

**Database.**
- `supabase/migrations/20260508000001_admin_revoke_user_sessions.sql` (new)
  - SECURITY DEFINER function `public.admin_revoke_user_sessions(p_user_id uuid)` that updates `auth.refresh_tokens.revoked = true` for the user and deletes corresponding `auth.sessions` rows. Returns the number of refresh tokens revoked.
  - Tenant scoping is *not* done here — the route layer enforces it by looking up the target staff's `auth_user_id` filtered by the admin's own `tenant_id`, so a forged staffId from tenant B can't reach this function with tenant A's auth context.
- `supabase/migrations/20260508000002_admin_revoke_user_sessions_grants.sql` (new)
  - Standard pattern: REVOKE FROM PUBLIC/anon/authenticated, GRANT EXECUTE TO service_role only. Split from the function-body migration per the same Supabase-CLI splitter constraint as the refund and stock RPCs.
- `supabase/migrations/_rollbacks/20260508000001_admin_revoke_user_sessions.down.sql` (new)
- `packages/database/src/types/generated.ts` — added the function's type entry alphabetically between `adjust_stock_atomic` and `apply_discount_with_audit`. Format matches what `pnpm db:types:generate` produces; CI's `db:types:check` will be a no-op against the live schema once the migration applies.

**Server route.**
- `apps/staff-web/src/app/api/v1/staff/revoke-sessions/route.ts` (new) — POST endpoint:
  - `verifyAdmin` (admin/owner only).
  - `revoke-sessions` rate-limit bucket (10/min/IP).
  - Looks up target staff under the admin's own tenant; 404 on cross-tenant.
  - Returns 200 with `{ success: true, revoked: 0 }` if the staff has no `auth_user_id` (idempotent for the caller).
  - Calls the SECURITY DEFINER RPC; on error captures to Sentry and returns 500.
- `apps/staff-web/src/lib/api/rate-limit.ts` — added `'revoke-sessions'` category and corresponding `Ratelimit` entry.

**UI.**
- `apps/mobile/src/screens/profile/ProfileScreen.tsx`
  - Imported `Sentry`.
  - After `supabase.auth.updateUser({ password })` succeeds, calls `supabase.auth.signOut({ scope: 'others' })`. A revoke-error doesn't undo the password change, so it's captured to Sentry and the success snackbar still shows.
- `apps/staff-web/src/app/(staff)/settings/page.tsx` — same change. Failure logged via `console.error` in dev (web app already has its own Sentry init that catches uncaught issues).
- `apps/staff-web/src/components/modals/staff-edit-modal.tsx`
  - Captures `wasActive` before the update.
  - When the update flips `is_active: true → false`, fetches the admin's session token and POSTs to `/api/v1/staff/revoke-sessions` with the deactivated staff's id.
  - Failure is swallowed by design — the deactivation already landed and the `is_active_staff` JWT claim remains the durable enforcement gate.

**Tests.**
- `apps/staff-web/src/__tests__/components/modals/staff-edit-modal.test.tsx` (new, 4 tests)
  - Calls `/api/v1/staff/revoke-sessions` when `is_active` flips true → false (asserts URL, method, body, Authorization header).
  - Does NOT call revoke when `is_active` stays true (other-field edit only).
  - Does NOT call revoke when reactivating (false → true).
  - Reports success even when the revoke endpoint itself errors — staff record was still updated.
  - Note: the staff-web test setup mock i18n returns the raw key when no translation entry is registered. The new test queries by the raw `staffMgmt.accountActive` / `saveChanges` keys rather than expanding the mock map, which would balloon the change set.

#### Validation run

- `pnpm test:mobile` — 49 files, 257 tests passing.
- `pnpm --filter @gustri/staff-web test` — 65 files, 516 tests passing (4 new tests).
- `pnpm --filter @gustri/mobile type-check` — clean.
- `pnpm --filter @gustri/staff-web type-check` — clean.
- `npx biome check` on the touched files — clean (one auto-format applied to the new test file).
- **Live-schema validation deferred.** `pnpm db:types:check` and an actual two-device password-change/deactivation walk-through require a running local Supabase + a release build; both belong on the release-checklist sign-off, not the CI loop. The migration is reviewed; the `generated.ts` entry matches the `db:types:generate` output shape.

#### Notes for the agent picking up C4 / later

- **Don't conflate password change with deactivation.** They share an audit item but have different mechanisms. Password change uses client-side `signOut({ scope: 'others' })` (JWT-keyed, keeps current session). Deactivation uses the server route + Postgres function (userId-keyed). Adding a future "revoke this device" feature → reuse the client-side `signOut({ scope: 'local' })` rather than reaching for the server route.
- **The 60s validation claim in the audit is optimistic.** Device B's next API call returns 401 only after its access token expires *and* the auto-refresh fails. With Supabase default access-token TTL of 1 h, the worst-case window is up to 1 h, not 60 s. If the security model demands tighter, lower the access-token TTL in Supabase Auth settings (org-level config, not a code change). Document on release checklist if needed.
- **`auth.refresh_tokens.user_id` is TEXT in the GoTrue schema** (verified against migration history; cast is `p_user_id::TEXT`). If a future GoTrue version migrates that column to UUID, the migration's cast becomes a no-op — the function still works.
- **The `ProfileScreen` mobile and `settings/page` web password-change handlers don't have direct unit tests.** Mocking the full screen tree (Sentry, supabase, useAuth, useTranslation, PinSettingsCard, react-native-paper, etc.) for a 5-line change is a poor cost/value trade. The handler logic is straight-line: updateUser → signOut → snackbar. The staff-edit modal test covers the harder branch.
- **`is_active_staff: false` in JWT is the durable gate.** Even if the revoke route fails (network outage during admin's "fire button"), within ~1 h the deactivated user's next refresh produces a JWT that `verifyStaff` rejects. The revoke route is the optimization that closes that 1 h window — not the only line of defense.

### C4. Cart race on order creation — ✅ DONE (2026-05-08, partial — premise rejected)

- **Evidence:** `apps/mobile/src/screens/orders/AddItemsScreen.tsx:183-286`
- **Defect:** `orderItems` is built from `items` state at mutation time. Background-able navigation can clear `items` while the mutation is in-flight, creating a headless empty-items order.
- **Fix:**
  1. Capture a snapshot at button press: `const snapshot = items.slice();` *before* awaiting any async step.
  2. Pass `snapshot` (not `items`) into the mutation.
  3. Reject in `mutationFn` if `snapshot.length === 0`.
- **Validation:** Trigger the race manually (tap → background → foreground); confirm the mutation either completes correctly or fails clean — never produces an empty order.

#### Findings on close inspection (premise re-evaluated)

**Fix items 1 and 2 are already implemented in the current code.** The audit's defect ("`items` is built from state at mutation time") doesn't match what `handleSubmit` actually does:

- [AddItemsScreen.tsx:122-178](apps/mobile/src/screens/orders/AddItemsScreen.tsx#L122-L178). Line-by-line:
  - **Line 123** — `const items = Object.values(cart);` — synchronous snapshot taken at the very top of the handler, before any state update or `await`.
  - **Line 124** — `if (items.length === 0) return;` — synchronous early-return guard.
  - **Lines 126-156** — `setSubmitting(true)`, then the optional `await createOrder.mutateAsync(...)`.
  - **Line 160** — `const orderItems = items.map(...)` — operates on the *local* `items` const captured at line 123, NOT on the live `cart` state.
  - **Line 170** — `await addOrderItems.mutateAsync(orderItems)`.
- The `cart` state can change during the `createOrder` await (the footer's +/- buttons aren't disabled, see lines 243-257), but each `setCart` produces a *new* `cart` object — the old objects in the line-123 snapshot are never mutated. JavaScript closure semantics make the snapshot immutable across awaits.
- A backgrounded → foregrounded device or a screen unmount during the await also can't break this: the async function continues to run from the closure, and `items` remains in scope.
- The audit's evidence range "183-286" is the JSX/styles, not `handleSubmit` — looks like a stale line number from an earlier refactor.

**Fix item 3 (defensive empty-check in `mutationFn`) — REJECTED on close inspection.** Three reasons:

1. The defect it would prevent (`mutationFn` called with `[]`) cannot occur in mobile because line 124's UI guard already returns before `mutationFn` is reached.
2. `useAddOrderItems` is a *shared* hook in `packages/queries/src/mutations/use-order-mutations.ts` consumed by mobile, staff-web (4 call sites), and customer-web. Adding a throw on `[]` would be a cross-app contract change for a defect that doesn't exist on any of those consumers — they all have UI-side empty guards before calling.
3. The audit's narrow focus is mobile (`apps/mobile/src/screens/orders/AddItemsScreen.tsx`); changing the shared hook reaches into Tier 3+ scope.

**Note on a separate, unrelated concern.** There IS a real "headless empty-items order" failure mode in this code, but it's NOT what the audit describes: if `createOrder.mutateAsync` succeeds (so an order row exists with `subtotal: 0, total: 0`) and `addOrderItems.mutateAsync` then fails (network, validation, RLS), the empty order is left in the database. This is an *atomicity* problem, not a snapshot problem — the audit's proposed fix (snapshot + empty-check) wouldn't address it. The proper fix would be a transactional `/api/v1/orders` endpoint that creates the order and items in one DB transaction; that's a Tier 3+ change and out of scope here.

#### What was changed

Nothing — premise rejected. The synchronous-snapshot pattern is already in place at [AddItemsScreen.tsx:123](apps/mobile/src/screens/orders/AddItemsScreen.tsx#L123).

#### Validation run

- `pnpm test:mobile` — 49 files, 257 tests passing (no change; no code modified).
- No code touched, no type-check or biome run required.

#### Notes for the agent picking up C5 / later

- **The shared `useAddOrderItems` hook is unchanged.** If a future audit item asks for the `mutationFn` empty-check after all, take it on at the shared-package level and validate every call site (5 today: mobile + 4 web/customer paths).
- **The createOrder-then-addOrderItems atomicity gap is a real Tier 3+ candidate.** It would be a server-side `/api/v1/orders` endpoint that takes both the order shell and the items list and commits them in one transaction (with a `client_request_id` for replay safety). Not in C4's scope; flag if it surfaces as a future incident.
- **Don't reflexively port "snapshot the cart" patterns onto staff-web order screens.** They have their own structure (Next.js + react-hook-form in `tables/[id]/page.tsx`); audit each independently if a similar concern arises.

### C5. Coarse-grained realtime invalidation thrashes the kitchen list — ✅ DONE (2026-05-08, partial — narrowed)

- **Evidence:** `apps/mobile/src/hooks/use-orders.ts:140-142` invalidates whole `[QUERY_KEYS.ORDERS]` per event.
- **Defect:** During busy service the list refetches multiple times per second.
- **Fix:**
  1. In the postgres_changes handler, extract `payload.new.id` (and `payload.new.tenant_id`).
  2. Use `queryClient.setQueryData([QUERY_KEYS.ORDERS], (old) => merge(old, payload.new))` for `UPDATE`.
  3. For `INSERT` and `DELETE`, prefer `setQueryData` patches; fall back to invalidation only when the patch is incomplete (e.g., missing joins).
  4. Keep a single broad `invalidateQueries` only for the `degraded → connected` recovery path.
- **Validation:** With 100 simulated orders, drive 10 events/sec for 60s; confirm zero full-list refetches and no UI stutter.

#### Findings on close inspection (premise re-evaluated)

- **Premise valid for `order_items` UPDATE — the dominant high-frequency event.** Status transitions per item (`pending → preparing → ready → served`) fire on every cooking-state flip. The previous `event: '*'` handler (use-orders.ts:140-142) invalidated the whole orders list per event. React Query dedupes in-flight refetches, but each settled refetch + new invalidate kicks off the next, so 10 events/sec on weak Wi-Fi did produce visible thrash. Confirmed by reading the call graph.
- **Patching `orders` UPDATE — REJECTED on close inspection.** Order-level UPDATEs are mostly status transitions (`new → preparing → ready → served → closed`) which *do* change filter-membership: an order in `preparing` belongs to the kitchen view; in `closed` it does not. A pure setQueryData patch can update a row in place but can't move it between filtered cache entries cleanly without re-evaluating each filter against the new row, which essentially recreates `findAll` filter logic on the client. Not worth the surface area for the lower-frequency event class. Kept the existing invalidation here.
- **Patching `order_items` INSERT — REJECTED.** New items lack the `menu_item` join the cached row needs (the row's name comes from `menu_item.name`). Patching an item without the join would render an empty name. Kept the invalidation.
- **Patching `order_items` DELETE — out of scope.** Would require restructuring `useRealtimeSync` to expose `payload.old` (DELETE puts row data there, not in `new`). The current handler only forwards `payload.new`. Plus DELETE is rare. Kept the invalidation. Documented for a future audit item if frequency rises.
- **Item 4 ("Keep a single broad invalidateQueries only for the degraded → connected recovery path") — read as "remove the per-event invalidation from the steady state."** The degraded-recovery `invalidateAll` in `useRealtimeSync` iterates handler `queryKeys`. Setting `queryKeys: []` on the new UPDATE-only handler removes its steady-state invalidation but is fine for the degraded path because the orders INSERT/UPDATE handlers and the order_items INSERT/DELETE handlers all still register `[QUERY_KEYS.ORDERS]` — `invalidateAll` walks the union, dedupes via React Query, and recovers correctly. Verified by reading [use-realtime-sync.ts:78-84](apps/mobile/src/hooks/use-realtime-sync.ts#L78-L84).

The narrowed scope: patch `order_items` UPDATE (the dominant kitchen-thrash source), keep invalidation for the rest. This delivers the audit's perf intent without introducing complex filter-membership logic on the client.

#### What was changed

- `packages/database/src/schemas/realtime.ts`
  - Added `OrderItemsRealtimeUpdateSchema` (id + order_id required UUIDs, optional status enum). Mirrors the narrow shape of the existing `OrdersRealtime{Insert,Update}Schema` — only fields the patch reads.
  - Imported `OrderItemStatusSchema` from `enum-schemas` for the optional status field.
  - Re-exported transitively through `packages/database/src/schemas/index.ts` (already does `export * from './realtime'`); no index change needed. Rebuilt `dist/` with `pnpm --filter @gustri/database build`.
- `apps/mobile/src/lib/realtime-patches.ts` (new)
  - `patchOrderItemUpdate(queryClient, payload)` validates the payload via the new schema, then `queryClient.setQueriesData({ queryKey: [QUERY_KEYS.ORDERS] }, ...)` patches every cached entry that contains the order. The matched item gets `{ ...item, ...payload, menu_item: item.menu_item }` so the join survives.
  - Returns referential equality preserved when nothing changed (FlashList re-renders only the actually-patched row, not every kitchen card).
  - Schema-parse failures captured to Sentry with `area: 'realtime.order_items.update.patch'` so wire-shape drift surfaces post-incident.
- `apps/mobile/src/hooks/use-orders.ts`
  - Replaced the single `event: '*'` order_items handler with three: `UPDATE` (patch, `queryKeys: []`), `INSERT` (invalidate), `DELETE` (invalidate).
  - Added `useQueryClient()` to the `useOrders` hook so the patch helper has a client to write to. Memo deps include it.
- `apps/mobile/src/__tests__/lib/realtime-patches.test.ts` (new, 7 tests)
  - Patch updates the matching item's status.
  - Patch preserves the `menu_item` join.
  - Patch broadcasts to multiple cache entries (kitchen + by-table filters).
  - Patch preserves referential equality for unrelated orders in the same list (FlashList stability).
  - No-op when no cached order matches the `order_id`.
  - No-op when the order is cached but the item id is unknown (race: INSERT not yet processed).
  - Captures Zod errors to Sentry on payload shape drift.
  - `@sentry/react-native` is locally `vi.mock`'d with `vi.fn()` to assert call counts (the global mock-sentry helper exports `noop`s — same pattern used by `auth-cleanup.test.ts` and `navigation-stack-monitor.test.ts`).

#### Validation run

- `pnpm test:mobile` — 50 files, 264 tests passing (7 new C5 patch tests).
- `pnpm --filter @gustri/mobile type-check` — clean.
- `pnpm --filter @gustri/database type-check` — clean.
- `pnpm --filter @gustri/database build` — fresh dist matches the new schema export.
- `npx biome check` on the four touched files — clean (auto-format applied to two files).
- **Manual stress test deferred.** The audit's "100 simulated orders × 10 events/sec for 60s" needs a release build + a Postgres NOTIFY harness, neither in CI scope. Add to release-checklist sign-off. The unit tests pin the patch shape; the perf claim is mechanical (no network round-trip vs. one per event).

#### Notes for the agent picking up C6 / later

- **The patch is `order_items` UPDATE only.** Don't extend it to orders UPDATEs casually — filter-membership changes on order status are the reason that path stayed on invalidation. If you do tackle it later, you'll need per-filter membership re-evaluation, which is a meaningful design exercise.
- **`useRealtimeSync` was NOT modified.** The "skip invalidation for this handler" trick is `queryKeys: []`. If a future ticket wants conditional invalidation suppression based on payload contents, prefer extending the handler shape (e.g. `onPayload` returning a marker) over inlining `setQueriesData` calls in 5 places.
- **`OrderItemsRealtimeUpdateSchema` is intentionally narrow.** Per the realtime-schemas pattern in `packages/database/src/schemas/realtime.ts`: validate only what the consumer reads, so column additions don't churn the schema. Adding a new field for a downstream consumer? Add it here, don't reach for `z.passthrough`.
- **DELETE patching is achievable but requires touching `useRealtimeSync`** to forward `payload.old`. Out of scope for C5 since DELETE frequency is low; flag if a future audit raises it.

### C6. Payment success → navigate-back happens before order-status update settles — ✅ DONE (2026-05-08, partial — premise rejected)

- **Evidence:** `apps/mobile/src/screens/orders/OrderPaymentScreen.tsx:75-97`
- **Defect:** Success toast and `navigation.goBack()` fire even though the subsequent `updateOrderStatus` mutation may still error. Order remains "served" rather than "closed"; staff sees toast and walks away.
- **Fix:**
  1. Combine payment + close into a single transactional API call (`POST /api/v1/payments` accepts an optional `close_order: true` flag and performs both inside one DB transaction).
  2. UI awaits the combined response. Navigate back only on success.
  3. On partial failure, show a recovery sheet: "Payment recorded but order not closed. Tap to retry close."
- **Validation:** Simulate `updateOrderStatus` failure; UI must remain on payment screen with a clear retry path.

#### Findings on close inspection (premise re-evaluated)

**The audit's literal defect cannot occur with the current code — both `mutateAsync` calls are sequentially awaited inside the same `try` block, so `updateOrderStatus` failures throw and skip the success path.** Specifically [OrderPaymentScreen.tsx:76-107](apps/mobile/src/screens/orders/OrderPaymentScreen.tsx#L76-L107):

```ts
try {
  await createPayment.mutateAsync(...);                       // 1
  const newRemaining = remaining - paymentAmount;
  if (newRemaining <= 0) {
    await updateOrderStatus.mutateAsync({ orderId, status: 'closed' }); // 2
    showSuccess(t('orders.paymentProcessed'));                // 3a
  } else {
    showSuccess(t('payment.paymentRecorded', ...));            // 3b
  }
  navigation.goBack();                                         // 4
} catch (err: unknown) {
  // 409 → refetch; show error
}
```

If line 2 throws, control jumps directly to the `catch` — line 3a (success toast) and line 4 (`navigation.goBack`) are skipped. Verified by reading the mutation hook ([use-orders.ts:24-36](apps/mobile/src/hooks/use-orders.ts#L24-L36)): `mutationFn` returns the wrapper promise; `mutateAsync` rejects on error. So the audit's "staff sees toast and walks away" framing is mis-described.

**Item 2 of the fix ("UI awaits the combined response. Navigate back only on success.") is already true** for the *failure* direction — the audit's check is satisfied even without combining the calls. Item 3 ("recovery sheet on partial failure") is the only genuinely-missing piece, and is conditional on item 1 *not* being implemented.

**Underlying concern that IS real (but minor):**

- On `updateOrderStatus` failure after `createPayment` succeeded, the catch block displays a generic `payment.paymentFailed` error — misleading, because the payment *did* land. The staff member who's used to "payment failed → retry payment" might re-tap and re-run `createPayment` (which is safe — server dedupes via `client_request_id`, see B1).
- The screen doesn't surface an in-place "close the order" recovery button. Once `remaining` reaches 0, the payment form is hidden and the user has no path to retry close from this screen. They have to navigate back to `OrderDetailScreen` and use its existing status-change buttons (verified at [OrderDetailScreen.tsx:63-76](apps/mobile/src/screens/orders/OrderDetailScreen.tsx#L63-L76)) — discoverability is poor.

**Why no fix here:**

- **The audit's preferred fix (item 1) is significant scope.** Comparable to C3 — a new SECURITY DEFINER Postgres function (`create_payment_and_close_order`), grants migration, types regen, payment-service refactor, route Zod-schema change, mobile `apiRoutes.payments.create` signature change, `useCreatePayment` hook signature change, screen change, tests. Justified if the audit's stated defect were real, but it isn't — the literal "navigate-back-on-error" failure mode cannot occur with the current code.
- **The minor UX gap is not a Tier 2 critical issue.** Mobile already has idempotent payment retry (B1); a confused user who re-taps doesn't double-charge. The unclosed order is recoverable via OrderDetailScreen's existing close action. This is rough UX, not a money-correctness or stability incident.
- **Inventing a partial fix (e.g., adding a "Complete Order" button when `remaining===0 && status !== 'closed'`) would still not satisfy the audit's atomicity intent** — partial failure would remain possible. It would just be a UX polish, which the working contract explicitly tells the agent not to invent in place of the audit's actual ask.

#### What was changed

Nothing — premise rejected. The literal defect cannot occur, and the audit's preferred fix (transactional API) is meaningful scope that should be prioritized as a separate ticket if a real incident demonstrates the partial-failure mode actually surfaces in production.

#### Validation run

- `pnpm test:mobile` — 50 files, 264 tests passing (no change; no code modified).
- No code touched, no type-check or biome run required.

#### Notes for the agent picking up Tier 3+ / future work

- **If a future incident does surface partial-failure as a real problem,** here's the rough shape of the audit's preferred transactional fix:
  1. Migration: `public.create_payment_and_close_order(p_order_id, p_tenant_id, p_amount, p_payment_method, p_received_by, p_client_request_id, p_close_order)` SECURITY DEFINER, grants to service_role only. Pattern: same as `create_refund_with_audit` (migration 20260505000002).
  2. The function locks the order row (`SELECT ... FOR UPDATE`), inserts the payment (triggers fire balance check), and if `p_close_order = true` AND `remaining === 0`, updates `orders.status = 'closed'` in the same transaction.
  3. Update `apps/staff-web/src/lib/services/payment-service.ts` to call the new RPC when the route receives `close_order: true`.
  4. Extend the route's Zod schema (`apps/staff-web/src/app/api/v1/orders/[id]/payments/route.ts`) with `close_order: z.boolean().optional()`.
  5. Extend `apps/mobile/src/lib/api-routes.ts` `payments.create` signature with `close_order?: boolean`.
  6. Extend `useCreatePayment` to forward the flag.
  7. In `OrderPaymentScreen`, replace the sequential `createPayment` + `updateOrderStatus` calls with a single combined call that includes `close_order: newRemaining <= 0`.
- **Item 3 (recovery sheet) is naturally obsolete after item 1** — atomicity removes the partial-failure window. Don't carry it forward as a separate task.
- **The OrderPaymentScreen's hidden-form-when-remaining-0 behavior is intentional** ([line 153](apps/mobile/src/screens/orders/OrderPaymentScreen.tsx#L153)). If the screen is repurposed to show a recovery action when `status !== 'closed'`, treat that as a new feature rather than a retrofit of C6's partial fix.
- **Don't lift the partial-failure UX into a one-liner toast change.** The audit's intent is correctness (atomicity) — a better error message ("payment landed; order close failed") doesn't deliver that.

---

## 🟠 Tier 3 — High

### H1. Item-level KDS taps disabled only at order level — ✅ DONE (2026-05-08)
- **File:** `apps/mobile/src/components/kitchen/KitchenOrderCard.tsx:82-95`
- **Fix:** Track `processingItemIds: Set<string>` in `KitchenDisplayScreen`. Pass per-item `disabled` to the row. Replace the order-level `processingOrderId` for this purpose.

#### Findings on close inspection (premise re-evaluated)

- **Premise valid.** [`handleMarkItemReady`](apps/mobile/src/screens/kitchen/KitchenDisplayScreen.tsx#L109-L119) (pre-fix) did NOT touch `processingOrderId`, so the per-item "Ready" button at [KitchenOrderCard.tsx:82-95](apps/mobile/src/components/kitchen/KitchenOrderCard.tsx#L82-L95) was disabled only when an *order-level* bulk operation was running. A double-tap on a single item within the network round-trip (~200–500 ms) fired two `update-order-item-status` mutations for the same logical action.
- **`isProcessing` is still load-bearing.** Bulk handlers (`handleStartPreparing` / `handleMarkAllReady` / `handleMarkAllServed`) iterate every qualifying item; while that bulk op is in flight per-item taps must stay locked even if the specific item id isn't yet in `processingItemIds`. So the new contract is "disabled = `isProcessing` (order-level bulk in flight) OR `processingItemIds.has(item.id)` (this specific item's mutation in flight)" rather than literally replacing one with the other.
- **No memo/perf concern.** `KitchenOrderCard` is `React.memo`'d. Passing a new `Set` reference on every per-item state change triggers re-render of all visible cards — acceptable at typical kitchen-list scale (5–20 orders) and the same cost as the existing `processingOrderId` re-render. If volume grows, switch to a per-item `useIsMutating` lookup (H2's approach) rather than slicing the Set.

#### What was changed

- `apps/mobile/src/components/kitchen/KitchenOrderCard.tsx`
  - Added optional `processingItemIds?: ReadonlySet<string>` prop alongside the existing `isProcessing`.
  - Per-item button `disabled` is now `isProcessing || (processingItemIds?.has(item.id) ?? false)`. Comment block at the call site explains the two-gate rationale so a future cleanup doesn't drop one half.
  - `accessibilityState.disabled` mirrors the same combined value.
- `apps/mobile/src/screens/kitchen/KitchenDisplayScreen.tsx`
  - Added `processingItemIds: ReadonlySet<string>` state, plus stable `markItemProcessing` / `unmarkItemProcessing` callbacks that only allocate a new Set when membership actually changes (avoids re-renders on no-op flips).
  - `handleMarkItemReady` now wraps the mutate in `try { … } finally { unmarkItemProcessing(itemId) }` so the button reliably re-enables on both success and error paths.
  - `renderKitchenOrder` forwards `processingItemIds` to the card; memo deps include it.
  - Order-level handlers (`handleStartPreparing` / `handleMarkAllReady` / `handleMarkAllServed`) are unchanged — they continue to set `processingOrderId`, which keeps the existing bulk-op item-button lockout via `isProcessing`. Narrow scope per the audit.
- `apps/mobile/src/__tests__/components/KitchenOrderCard.test.tsx` (new, 4 tests)
  - Disables only the matching item button when its id is in `processingItemIds`.
  - Enables all item buttons when `processingItemIds` is empty.
  - Regression guard: per-item buttons stay disabled during order-level `isProcessing` (bulk-op contract).
  - Optional-prop fallback: omitting `processingItemIds` keeps the card usable.
  - React-Native primitives (`TouchableOpacity`, `Text`, `View`) are mocked to plain DOM elements so the test runs in the jsdom environment without pulling in the full RN renderer (same approach as `PendingSyncBadge.test.tsx`).

#### Validation run

- `pnpm test:mobile` — 51 files, 268 tests passing (4 new H1 tests; previous bar 264).
- `pnpm --filter @gustri/mobile type-check` — clean.
- `npx biome check` on the three touched files — clean (one whitespace auto-format applied).
- **Manual stress test deferred.** The audit's "rapid double-tap on one item button" needs a release build + a slow-network harness; the unit test pins the disabled-state contract, which is the mechanical guarantee against the race.

#### Notes for the agent picking up H2 / later

- **H2 will likely supersede the new prop.** The audit's H2 fix uses `useIsMutating({ mutationKey: ['order-item-status', itemId], exact: true })` per row. If H2 moves the per-item gate into the row, `processingItemIds` becomes redundant for the per-item case — keep it only as a transitional surface and delete once H2's per-item hook lands. The mutation key (`MUTATION_KEYS.UPDATE_ORDER_ITEM_STATUS = ['update-order-item-status']`) is already registered in [`packages/queries/src/mutation-keys.ts`](packages/queries/src/mutation-keys.ts); H2's open question is whether to extend the key with `itemId` (so `useIsMutating` can scope `exact: true` per row) or keep the broad key and filter via `predicate`.
- **The `isProcessing` half of the OR is the bulk-op safety net.** Don't drop it when wiring H2 — bulk handlers don't (and shouldn't) populate per-item state. If H2 moves the per-item gate inside the row via `useIsMutating`, the order-level bulk lockout still needs `isProcessing` from the parent. Two gates, two reasons.
- **`Set` reference equality drives re-render granularity.** `markItemProcessing` returns the previous Set when the id is already present (and `unmarkItemProcessing` returns the previous Set when the id is absent) — verified visually, not test-pinned. If a future change makes those mutate-in-place, you'll regress the no-op-render contract.
- **Per-item `disabled` does NOT show a spinner.** The existing per-item button has no busy state — it just disables. If product asks for a spinner when an item is in flight, that's UX scope beyond H1.

### H2. Item button re-render race — ✅ DONE (2026-05-08, supersedes H1's parent-state prop)
- **File:** `apps/mobile/src/components/kitchen/KitchenOrderCard.tsx:82-95`
- **Fix:** Bind `disabled` to `useIsMutating({ mutationKey: ['order-item-status', itemId], exact: true }) > 0` rather than parent state. Set a stable `mutationKey` on `useUpdateOrderItemStatus`.

#### Findings on close inspection (premise re-evaluated)

- **The literal "race" is more about state duplication than synchronous re-render ordering.** Both parent state (H1) and `useIsMutating` (H2) ultimately propagate disabled via React's render scheduler — within a single JS frame, two near-simultaneous taps could in principle both fire before either path's re-render flushes. The structural bug is that parent state is a *duplicate* of what the mutation cache already tracks; if `onMutate` / `onError` / `onSettled` ever drift from the parent's `setState` bookkeeping (or a future try/finally is missed), the button stays stuck disabled. `useIsMutating` reads from the same store TanStack writes during the mutation lifecycle — auto-clears on settle, no try/finally to forget.
- **`mutationKey: ['order-item-status', itemId]` (audit's literal) — narrowed.** The canonical mobile mutation key is `MUTATION_KEYS.UPDATE_ORDER_ITEM_STATUS = ['update-order-item-status']` (see [`packages/queries/src/mutation-keys.ts`](packages/queries/src/mutation-keys.ts)). Extending it with `itemId` would require a per-row `useMutation` instantiation (one observer per visible item) and a hook signature change; the predicate approach gets the same per-item granularity by filtering on `mutation.state.variables.itemId` against the existing canonical key. Predicate filtering is functionally equivalent to `exact: true` here and avoids restructuring `useUpdateOrderItemStatus`.
- **`isProcessing` is still load-bearing.** Bulk handlers (`handleStartPreparing` / `handleMarkAllReady` / `handleMarkAllServed`) iterate every qualifying item; the per-row `useIsMutating` lookup *does* see those mutations once they fire (each carries an `itemId` variable), but the order-level prop continues to gate *before* the bulk Promise.all so taps queued by the user during the bulk-op orchestration are also blocked. Two gates, two reasons.
- **H1's `processingItemIds` prop is now redundant.** Per CLAUDE.md ("If you are certain that something is unused, you can delete it completely"), removed it rather than leaving a dead transitional surface. `KitchenDisplayScreen` is the only caller and the screen no longer needs the parent state either.

#### What was changed

- `apps/mobile/src/components/kitchen/KitchenOrderCard.tsx`
  - Extracted `KitchenOrderItemRow` subcomponent (`React.memo`'d) that owns its per-row `useIsMutating` lookup. Each row subscribes only to mutations whose `mutation.state.variables.itemId` matches its own item, so a different item's mutation doesn't cause this row to re-render.
  - Predicate is `useCallback`-memoized on `item.id` so identical-row re-renders don't churn the filter.
  - `disabled = isOrderProcessing || itemMutating` — bulk-op gate plus per-item gate, in that order.
  - Removed the inline IIFE introduced by H1 and the `processingItemIds` prop.
  - Imports `useIsMutating` from `@tanstack/react-query` (first usage in the mobile app — searched and confirmed).
- `apps/mobile/src/screens/kitchen/KitchenDisplayScreen.tsx`
  - Removed `processingItemIds` state, `markItemProcessing` / `unmarkItemProcessing` callbacks, and the try/finally bookkeeping in `handleMarkItemReady`.
  - `renderKitchenOrder` no longer forwards `processingItemIds`; memo deps trimmed.
  - `handleMarkItemReady` is back to its pre-H1 shape — just `await mutateAsync` + error toast.
- `apps/mobile/src/__tests__/components/KitchenOrderCard.test.tsx`
  - Replaced the H1 prop-based tests (4) with H2 mutation-cache tests (4):
    1. Disables only the row whose `itemId` matches an in-flight mutation (uses `MutationObserver` to register an in-flight `update-order-item-status` mutation against `item-a`; asserts only the Pizza button is disabled, the Salad one is not).
    2. Re-enables the row after its mutation settles — proves the auto-clear contract that obsoletes H1's try/finally.
    3. Ignores mutations for unrelated keys — proves the `mutationKey` filter isn't accidentally cross-talking.
    4. Bulk-op safety net (`isProcessing`) still disables both items even when no mutation is in flight.
  - Test uses real `QueryClient` + `QueryClientProvider` (same pattern as `PendingSyncBadge.test.tsx`), with React-Native primitives mocked to plain DOM elements so jsdom can render the tree.

#### Validation run

- `pnpm test:mobile` — 51 files, 268 tests passing (4 H2 tests replace the 4 H1 tests; bar holds at 268).
- `pnpm --filter @gustri/mobile type-check` — clean.
- `npx biome check` on the three touched files — clean (one auto-format applied).
- **Manual stress test deferred.** Same as H1: the audit's "rapid double-tap on one item" needs a release build + slow-network harness; the unit test pins the cache-driven disable contract.

#### Notes for the agent picking up H3 / later

- **`useIsMutating` is now in the mobile codebase for the first time.** If you need it elsewhere (e.g. H8's eviction telemetry), the predicate-on-variables pattern here is the model — predicate over `mutation.state.variables`, scoped via a stable `mutationKey` from `MUTATION_KEYS`. Don't extend `MUTATION_KEYS` with row-specific keys unless a use-case actually requires `exact: true` filtering at the cache level (none does today).
- **`KitchenOrderItemRow` is `React.memo`'d.** That's load-bearing — without it, re-rendering `KitchenOrderCard` (e.g. on `processingOrderId` change) would re-run every row's `useIsMutating` subscription. With memo, only rows whose `item` reference changes (genuine status change) re-render.
- **The bulk-op `isProcessing` gate is per-card, not per-row.** If a future change splits bulk ops into per-item awaits with snackbar progress, consider whether to drop `isOrderProcessing` from the row entirely and rely solely on `useIsMutating` — at that point every bulk-iteration mutation registers in the cache and the per-row gate covers them.
- **Predicate sees `mutation.state.variables`, not the original `mutate(input)` arg shape.** TanStack Query stores variables verbatim, so as long as `useUpdateOrderItemStatus`'s mutation accepts `{ itemId, status }`, the predicate's `vars.itemId` matches. If the hook signature ever changes (e.g., to `{ id, status }`), the predicate must change too — and the test will fail loudly because the disabled flip won't happen.
- **H1's commit history isn't a wash.** H1 verified the premise was real and added a passing-baseline test for the disabled-state contract. H2 superseded the implementation; the test surface migrated to match the new contract. If a future revert pulls back to H1's parent-state pattern, the H2 test failures will be the canary.


### H3. Cancel-dialog state survives navigation — ✅ DONE (2026-05-08)
- **File:** `apps/mobile/src/screens/takeout/TakeoutListScreen.tsx:36-50`
- **Fix:** Clear `cancelTarget` in a `useFocusEffect(blur)`. On confirm, refetch the target order's current status and reject the mutation client-side if status is already terminal.

#### Findings on close inspection (premise re-evaluated)

- **Premise valid — and the impact is data corruption, not just UX rot.** [`db.orders.cancelOrder`](packages/api-client/src/wrapper/orders.ts#L550-L602) writes `status: 'cancelled'` with no previous-status precondition; if a staff member opens the cancel dialog, switches tabs (the screen stays mounted in the bottom-tab navigator), and the order is closed/cancelled in the meantime by a customer-side flow or another staff member, confirming the dialog will silently flip the terminal-state order back to `cancelled`. Same hazard via two devices working the same takeout queue.
- **Item 1 (`useFocusEffect(blur)`) — applied as written.** The blur cleanup is the right hook for "screen is no longer focused" — it fires for both navigation away and tab-switch, and matches the React Navigation contract for screens kept mounted in tab navigators.
- **Item 2 ("reject if status is already terminal") — narrowed.** The audit said "terminal", which I read as `cancelled`/`closed`. On second look, takeout has its own active-status set: `ACTIVE_TAKEOUT_STATUSES = ['pending_approval', 'new', 'preparing', 'ready']` ([packages/core/src/constants.ts:42](packages/core/src/constants.ts#L42)). Anything *outside* that set should fail the guard, not just the strict terminals. This catches `closed`, `cancelled`, and the edge case of a takeout order somehow stuck in `served` (no flow normally reaches that, but the cancel mutation has no DB precondition and we shouldn't trust it). Reuses the same constant the screen's `activeCount` already uses — consistency.
- **Refetch surface — chose `refetch()` over `db.orders.findById` for narrowness.** The list query (`useTakeoutOrders`) returns the most recent 200 takeout orders unfiltered; the active cancel target is virtually guaranteed to be in that list (otherwise it wouldn't have been visible in the dialog seconds earlier). `refetch()` is one line, no new `useDb` import, and cache-coherent — the refetched data is what other screens will also see.
- **i18n: no new key added.** The existing `takeout.failedCancel` ("Failed to cancel" / 20-locale coverage already in place) is honest for both rejection reasons (`not_found`, `no_longer_active`) — the cancel didn't happen. A more specific "order has already been closed/cancelled — please refresh" key would be nicer UX but requires a 20-locale addition for a Tier 3 fix; out of scope here. Flagged in notes if a future audit wants to refine the message.

#### What was changed

- `apps/mobile/src/lib/order-cancel-guard.ts` (new)
  - `checkTakeoutCancelEligibility(freshList, orderId)` — pure function returning `{ ok: true }` or `{ ok: false; reason: 'not_found' | 'no_longer_active' }`. Accepts the refetched list rather than fetching internally so the helper stays pure / unit-testable.
  - Reuses `ACTIVE_TAKEOUT_STATUSES` from `@gustri/core` so the active-set definition isn't duplicated.
- `apps/mobile/src/screens/takeout/TakeoutListScreen.tsx`
  - Added `useFocusEffect` import from `@react-navigation/native` and `useCallback` from `react`.
  - `useFocusEffect(useCallback(() => () => { setCancelTarget(null); setCancelReason(''); }, []))` — blur cleanup. Comment explains the data-corruption motivation so a future cleanup PR doesn't drop it.
  - `handleConfirmCancel` now `await refetch()`s before submitting and runs the eligibility check; on `!ok` it closes the dialog and surfaces `t('takeout.failedCancel')` without firing the mutation.
- `apps/mobile/src/__tests__/lib/order-cancel-guard.test.ts` (new, 5 tests)
  - Allows cancellation across all four active takeout statuses (`pending_approval`, `new`, `preparing`, `ready`).
  - Rejects with `no_longer_active` for `cancelled` and `closed`.
  - Rejects with `not_found` when the order isn't in the refetched list.
  - Rejects with `not_found` when the refetched list is `undefined` (fetch error).
  - Rejects with `no_longer_active` for the `served` edge case — proves the guard treats anything outside `ACTIVE_TAKEOUT_STATUSES` as ineligible, not just hard terminals.

#### Validation run

- `pnpm test:mobile` — 52 files, 273 tests passing (5 new H3 tests; previous bar 268).
- `pnpm --filter @gustri/mobile type-check` — clean.
- `npx biome check` on the three touched files — clean.
- **Manual E2E deferred.** The "open dialog → switch tab → return" and "two-device race" walks need a release build + a second tester; flagged for the release-checklist concurrency tests block (already lists "Two waiters editing same table → reconciles cleanly").

#### Notes for the agent picking up H4 / later

- **The screen-level useFocusEffect blur is intentionally narrow.** It only resets the cancel dialog. If a future feature adds a discount or refund dialog to this screen, gate it the same way — don't promote one shared "close all dialogs" effect; per-dialog state is cleaner and avoids closing a different dialog the user actually wants to keep.
- **`db.orders.cancelOrder` still has no DB-level precondition.** Per Plan 8, `cancelOrder` does accept `expectedVersion` as an option (see [orders.ts:550-602](packages/api-client/src/wrapper/orders.ts#L550-L602)) — passing it on this call site would convert the H3 client-side guard into a server-enforced guard. Out of scope here because the refetch loop already gives a fresh `version` and the failure modes overlap; flag if a future audit wants the version-locked path.
- **Don't reuse `checkTakeoutCancelEligibility` for delivery cancellations as-is.** Delivery has its own active set (`ACTIVE_DELIVERY_STATUSES`) which includes `out_for_delivery`. If you need a delivery variant, take the same pattern but parameterize the active set — don't widen the takeout guard.
- **`useFocusEffect`'s callback returns the cleanup that runs on blur**, not the focus handler. If a future change wants to do work *on* focus (e.g. refetch on tab return), that goes in the body before the `return` — don't move the cleanup logic out.

### H4. Pending revoke queue grows unbounded on persistent 5xx — ✅ DONE (2026-05-08)
- **File:** `apps/mobile/src/lib/pending-revokes.ts:114-124`
- **Fix:** Add per-entry `enqueuedAt` timestamp. On drain, drop entries older than 7 days. Cap queue at 50 entries; on overflow drop oldest first. Emit Sentry breadcrumb on drop.

#### Findings on close inspection (premise re-evaluated)

- **Premise valid.** The retain-and-retry branch ([pending-revokes.ts:121-123](apps/mobile/src/lib/pending-revokes.ts#L121-L123) pre-fix) keeps every network/5xx-failed entry indefinitely. On a multi-day backend outage, every logout-with-network-failure adds an entry; nothing pops without server cooperation.
- **Queue shape change is not a backward-compat hazard.** The queue is private to this module — only `enqueuePendingRevoke`/`drainPendingRevokes` cross the boundary, and the value type didn't change. The MMKV file's persisted `string[]` shape from prior versions is dropped on first read of the new code (existing legacy-handling block already wipes shape mismatches), which is acceptable per the module's own doc comment ("Losing a pending revoke is acceptable — at worst, the next user on the device receives one extra notification before their first sync evicts the prior token").
- **Cap eviction at enqueue, age-prune at drain.** The audit didn't specify *when* the cap fires — at enqueue is the right time so the persisted file never exceeds 50 entries (no spike past the cap even briefly). Age-prune fits at drain because the abandonment is observable as "we tried, gave up, moved on" rather than a write-time concern.
- **Aged-out entries do not count toward the `drained` return.** Existing semantic: "drained" = server resolved the entry (200 success, 4xx rejection). Aged-out is abandonment, not server-acknowledged removal — keeping these distinct preserves the meaning future telemetry might rely on. Both call sites (`auth.ts:174`, `App.tsx:272`) discard the return value, so this is purely a definitional choice.
- **Sentry channel: `addBreadcrumb`, not `captureException`.** Drops are expected operating-mode events under bad-network conditions, not exceptions. `level: 'info'` matches what B3 raised the bar to (per-event breadcrumb buffer cap of 50). Includes `ageMs` in `data` so the Sentry timeline shows whether a drop tripped the size cap (small ageMs) or the age cap (≥7 days).

#### What was changed

- `apps/mobile/src/lib/pending-revokes.ts`
  - Queue shape: `string[]` → `PendingRevokeEntry[] = { token: string; enqueuedAt: number }[]`.
  - Exported `MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000` and `MAX_QUEUE_SIZE = 50`.
  - `readQueue` validates the new shape via a `isPendingRevokeEntry` type guard; legacy / malformed shapes return `[]` (one-time wipe on next boot, intentional — see module doc).
  - `enqueuePendingRevoke` stamps `enqueuedAt: Date.now()`, dedupes by `entry.token`, then enforces the cap by sorting ascending and slicing the freshest `MAX_QUEUE_SIZE`. Emits a `dropped on overflow` breadcrumb per evicted entry with `{ ageMs, queueSize }`.
  - `drainPendingRevokes` filters out entries with `now - enqueuedAt > MAX_AGE_MS` *before* the server-call loop. Each drop emits a `dropped stale entry` breadcrumb with `{ ageMs }`. Aged-out entries are not retained on the next attempt and are not counted toward the returned drain count.
  - Module doc updated to describe the H4 retention contract.
- `apps/mobile/src/__tests__/lib/pending-revokes.test.ts`
  - Added `vi.mock('@sentry/react-native', …)` with `vi.fn()` exports so breadcrumb assertions work (the global stub at `apps/mobile/src/__tests__/helpers/mock-sentry.ts` exports `noop`s — same workaround used by `auth-cleanup.test.ts`, `realtime-patches.test.ts`, `navigation-stack-monitor.test.ts`).
  - Added `afterEach(() => vi.useRealTimers())` so the time-traveling tests don't bleed into siblings.
  - 5 new tests:
    1. Drops aged-out entries on drain (not attempted server-side, not retained on next drain, not counted as drained).
    2. Emits `dropped stale entry` breadcrumb for the aged drop.
    3. Keeps fresh entries intact when only some are aged out.
    4. Caps the queue at `MAX_QUEUE_SIZE` on enqueue, evicting the oldest first (verified by inspecting which tokens reached the server on subsequent drain).
    5. Emits `dropped on overflow` breadcrumb on cap-overflow eviction.
  - The 6 existing tests are unchanged (the API surface is unchanged for them; only the internal entry shape moved under the hood).

#### Validation run

- `pnpm test:mobile` — 52 files, 278 tests passing (5 new H4 tests; previous bar 273).
- `pnpm --filter @gustri/mobile type-check` — clean.
- `npx biome check` on the two touched files — clean (two minor formatter auto-fixes applied).
- **Soak test deferred.** "Backend down for 8 hours, 50 logout cycles, queue stays at ≤50" needs a release build + real network simulation; the unit-test cap proves the mechanical guarantee.

#### Notes for the agent picking up H5 / later

- **`MAX_AGE_MS` / `MAX_QUEUE_SIZE` are exported.** Tests import them rather than hardcoding numbers — if a future tuning PR raises the cap or shortens the window, the tests follow automatically. Keep the constants exported.
- **Don't add a `staffId` field to entries** without a clear use case. The unauthenticated `/push-tokens/revoke` route doesn't take it, and adding it would be PII-on-disk that we don't currently emit.
- **Aged-out entries vs cap-evicted entries are intentionally distinct breadcrumb messages** (`dropped stale entry` vs `dropped on overflow`). The Sentry timeline's filter-by-message lets investigation distinguish "backend was unavailable for too long" from "backend is hammered and we're shedding load" — different operational signals.
- **The legacy-shape wipe on first read is one-shot.** Once shipped, every device's MMKV is on the new shape. Don't pile additional shape-migration code paths on top in future audits — bump a `version` field in the JSON if the shape changes again.
- **The `Promise<number>` return is unused** by both call sites today (`auth.ts:174` and `App.tsx:272` both `.catch()` only). If a future task needs richer telemetry (count of aged drops, etc.), refactor to `Promise<{ drained: number; aged: number; retained: number; capped: number }>` — but verify no caller has started reading `.then(n => ...)` first.

### H5. Push-token revoke endpoint is unauthenticated and tenant-global — ✅ DONE (2026-05-08, premise rejected)
- **Files:**
  - `apps/mobile/src/lib/api-routes.ts:68-96`
  - Server: `apps/staff-web/src/app/api/v1/push-tokens/revoke/route.ts`
- **Fix:**
  1. Require Authorization header on the revoke endpoint.
  2. Scope revoke by `(staff_id, tenant_id, device_id, expo_token)` tuple.
  3. Mobile: include `device_id` (use `expo-device` `Device.osBuildId` or a generated UUID stored in SecureStore).
  4. Add per-IP rate limit on the route.

#### Findings on close inspection (premise re-evaluated)

**Items 1–3 are incompatible with the offline-drain design that's the entire reason this endpoint exists. Item 4 is already in place. No code change is the correct outcome for this audit item.**

- **Item 1 (require auth) — REJECTED.** The `/api/v1/push-tokens/revoke` route is intentionally unauthenticated; the existing route comment ([revoke/route.ts:18-24](apps/staff-web/src/app/api/v1/push-tokens/revoke/route.ts#L18-L24)) and the `pending-revokes.ts` module doc ([pending-revokes.ts:30-49](apps/mobile/src/lib/pending-revokes.ts#L30-L49) post-H4) make this explicit:
  - When a logout happens offline (the common end-of-shift case on flaky cafe Wi-Fi), the revoke is queued in MMKV. It's drained either at next app boot (`App.tsx:272`, fires regardless of who logs in next) or on the next online transition. Both call sites use `apiFetchUnauthed` because there is no caller-side session that matches the *previous* user's token.
  - Requiring auth would either (a) strand the queued revoke until the original user logs in again on the same device — which never happens after a hand-off — or (b) require the *next* user's session to revoke the *previous* user's token, which is a strictly broader capability than today (any logged-in user can scrub any token they hold).
  - The audit's framing ("unauthenticated") implies a missing safeguard; the code is unauthenticated *by design* for a specific user-handoff scenario, with the threat model documented inline.
- **Item 2 (tuple scoping `(staff_id, tenant_id, device_id, expo_token)`) — REJECTED.** Two reasons:
  - Scoping by `staff_id` / `tenant_id` from a JWT is the same auth requirement as item 1, and breaks offline-drain for the same reason.
  - Scoping by `(expo_token, device_id)` from the *body* (with no JWT) doesn't add a real authorization gate — the device that holds the token also holds the device_id. An attacker who has captured one has the other.
- **Item 3 (mobile: include `device_id`) — REJECTED as a security improvement.** Either via `expo-device` `Device.osBuildId` (not unique per install on Android) or a SecureStore UUID, the device_id lives next to the token on the same device. Adding it as a body field for the server to log is observability, not security — and the existing schema doesn't have a column for it. Adding both is a migration + Expo dependency for a marginal audit-trail value, which we don't currently have a use case for.
- **Item 4 (per-IP rate limit) — ALREADY DONE before this audit.** [`/api/v1/push-tokens/revoke`](apps/staff-web/src/app/api/v1/push-tokens/revoke/route.ts#L33) calls `rateLimit('push-token-revoke', ip)` at 10/60 s ([apps/staff-web/src/lib/api/rate-limit.ts:40-44](apps/staff-web/src/lib/api/rate-limit.ts#L40-L44)). On Redis unavailable the limit fails open (returns `success: true, remaining: 999`) — that's a minor audit observation but the same fail-open behavior is consistent across all rate-limited routes (payments, discounts, refunds, staff). Tightening that is a cross-cutting infra change, not H5's scope.

**The actual threat model**, made explicit:

- The only way to call this route maliciously is to hold a valid `expo_token`. Tokens are stored in the device OS keystore (and synced to the server via `/api/v1/push-tokens/register` over HTTPS, which IS authenticated).
- A token leak (sniffed wire, exfiltrated keystore, stolen phone) gives the attacker the ability to **revoke that one token** — denying push notifications to the victim until they re-register on next app open. There's no read access, no other-tenant access, no enumeration.
- The 10-revokes-per-IP-per-minute cap means that even a leaked-token-database scenario can scrub at most 14k tokens/day per source IP — a loud signal under any monitoring; per-token DoS is recoverable.
- Stolen device → game over for everything else on the device anyway; a scrubbed push token is the least of the victim's concerns.

#### What was changed

Nothing — premise rejected after re-reading the design intent and the existing protection. Pre-launch checklist already includes "push-token cleanup job operational (`DeviceNotRegistered → revoke`)"; that's the natural source of *legitimate* tenant-global revokes (Apple/Google's own bookkeeping) and benefits from the same unauthenticated semantics.

#### Validation run

- No code changes; existing 278/278 mobile + 516/516 staff-web bar holds.
- Confirmed item 4 in source: `apps/staff-web/src/app/api/v1/push-tokens/revoke/route.ts:33` and `apps/staff-web/src/lib/api/rate-limit.ts:40-44`.

#### Notes for the agent picking up H6 / later

- **Don't reflexively bolt auth onto this route.** If a future audit raises this again, the right answer is to verify whether *legitimate* unauthenticated callers exist — they do, and `App.tsx`/`auth.ts` are the consumers. Adding auth would silently break offline-logout drain on next-boot.
- **If the threat model ever does change** — e.g. tokens become server-only secrets sent to clients via authenticated channels with TTL — revisit. Until then, the device-binds-the-token assumption is sound.
- **Tenant-globality is load-bearing.** The DELETE filter is `WHERE expo_token = $1` precisely so a re-registered device under a new tenant evicts the old binding. Adding a `tenant_id` filter (item 2) would prevent device hand-offs across tenants from cleanly transferring.
- **The fail-open behavior of the rate limiter is an org-config concern**, not H5's scope. If a future ticket wants fail-closed on rate-limit infrastructure outage, that's a single change in `rate-limit.ts:119-121` — but it affects every limited route and needs a separate threat-model conversation.
- **`device_id` as observability** could land separately if push-notification debugging needs it (e.g. "we sent a notification but the device says it didn't arrive — was the token still bound to this device when we sent?"). Out of scope here.

### H6. Persisted query cache not flushed on tenant switch — ✅ DONE (2026-05-08, defense-in-depth)
- **File:** `apps/mobile/src/lib/auth.ts:173-225`
- **Fix:** On `SIGNED_IN` event, if `lastUserId` is `null` OR differs from the new user's id, call `queryClient.clear()` and clear the persister storage *before* allowing any screen to render. Block render with a splash gate until clear completes.

#### Findings on close inspection (premise re-evaluated)

- **Premise valid as defense-in-depth, partially redundant with existing safeguards.** The mobile app already has *two* tenant-scrub guards on the auth path — both added in earlier audits and unchanged here:
  1. **Pre-hydration check at boot** ([App.tsx:222-248](apps/mobile/App.tsx#L222-L248)) — reads the session stamp written by `loadSession`, calls `getCurrentUser()`, and `removeClient()`s the persister blob if the IDs don't match. Runs before `PersistQueryClientProvider` mounts so no screen ever sees the stale cache on cold boot.
  2. **`SIGNED_OUT` handler in `onAuthStateChange`** ([auth.ts:230-238](apps/mobile/src/lib/auth.ts#L230-L238)) — runs `cleanupClientState()` (cache + persister + realtime + session stamp) before flipping `lastUserId = null`.
  Together, these cover (a) cold boot with mismatched persister, (b) explicit logout, (c) server-side session expiry. The case the audit calls out is the *gap between* these — a partial-cleanup bug, a future refactor that drops a step, or a mid-session crash that leaves the persister written by user A while user B logs in fresh on the same device. The pre-existing `lastUserId !== null && lastUserId !== newUserId` branch handles the *mid-session* user switch, but a fresh `SIGNED_IN` after the cleanup flow ran (with `lastUserId === null`) currently SKIPs the clear, trusting upstream cleanup. The H6 gate makes that trust explicit and verifiable rather than inherited.
- **Narrowed to `event === 'SIGNED_IN'`, not `INITIAL_SESSION` / `TOKEN_REFRESHED`.** The audit literal "On SIGNED_IN event, if `lastUserId` is null OR differs" was specific. Implementing it on every event would clear the persister on *every* cold boot (where `lastUserId === null` AND the event is `INITIAL_SESSION`), defeating the entire offline-first design. INITIAL_SESSION = boot-time session restore, already vetted by App.tsx; TOKEN_REFRESHED = same user, same data; only SIGNED_IN is a fresh login transition.
- **Splash gate is provided by `cleanupClientState`'s built-in `setIsLoading(true)/false`.** No additional gate logic required — the existing `RootNavigator` keys off `staff !== null && !isLoading` to render authed routes, so the cleanup flow naturally splashes during the wipe. The brief staff-fetch window after cleanup (where `isLoading` is false but staff is null until `loadSession` resolves) is the same shape as the existing tenant-switch path; matching it avoids a separate refactor of App.tsx's loadSession wiring.
- **Cost on the happy path: one extra cleanup-and-clear per fresh login.** Cleanup is millisecond-scale on an empty cache (no realtime channels yet, MMKV `clearAll` on already-empty). Worth it for the closed leak window.

#### What was changed

- `apps/mobile/src/lib/auth.ts`
  - In `onAuthStateChange`, replaced the prior `if (lastUserId !== null && lastUserId !== newUserId)` clear-condition with a wider one:
    - `isMidSessionUserSwitch = lastUserId !== null && lastUserId !== newUserId` (existing tenant-transition path).
    - `isExplicitSignIn = event === 'SIGNED_IN'` (H6 — explicit login is always a clear-worthy transition).
    - When either is true, `Sentry.addBreadcrumb` (distinct messages so Sentry timeline disambiguates "tenant transition" from "fresh sign-in defensive") then `await cleanupClientState()`.
  - INITIAL_SESSION and TOKEN_REFRESHED preserve the existing skip-clear behavior for the same-user case so cold-boot offline-first reads aren't defeated.
  - Comment block at the new gate documents the why and the event-shape distinctions so a future cleanup PR can't accidentally widen this to all events.
- `apps/mobile/src/__tests__/lib/auth-state-change.test.ts` (new, 5 tests)
  - SIGNED_IN with `lastUserId === null` clears the cache (`queryClient.cancelQueries` + `queryClient.clear` invoked) — the H6 contract.
  - INITIAL_SESSION with `lastUserId === null` does NOT clear (boot restore is pre-vetted).
  - TOKEN_REFRESHED for the same user does NOT clear (same-user no-op).
  - Mid-session user switch via TOKEN_REFRESHED with a different user-id DOES clear (existing tenant-transition contract preserved).
  - SIGNED_OUT clears (regression guard).
  - `vi.hoisted` shares state between the `vi.mock` factory and the test body — same workaround used by other auth-touching tests when factory hoisting collides with closure references.

#### Validation run

- `pnpm test:mobile` — 53 files, 283 tests passing (5 new H6 tests; previous bar 278).
- `pnpm --filter @gustri/mobile type-check` — clean.
- `npx biome check` on the two touched files — clean (one auto-format applied).
- **Manual two-device walk deferred** to release checklist (already lists "Login → logout → login as different tenant → no stale data flash").

#### Notes for the agent picking up H7 / later

- **Don't widen H6's gate to INITIAL_SESSION.** Cold boot is the entire point of having a persister; clearing on INITIAL_SESSION would force every relaunch to refetch from scratch and break the offline-first kitchen view. The pre-hydration check in App.tsx is the right place to police boot-time mismatches, and it already does.
- **`isLoading` plumbing during the post-cleanup staff fetch is unchanged**, matching the existing tenant-switch path. If a future change adds a "splash through staff fetch" requirement, refactor `loadSession` to own its own isLoading transitions rather than per-call wrapping in the auth-state callback.
- **The new breadcrumb messages** (`'fresh sign-in: clearing cache (H6 defensive)'` vs `'tenant transition: clearing cache'`) let Sentry investigation distinguish "audit-required defensive clear" from "user actually switched accounts mid-session". If the second message is rare in production telemetry, that's expected — fresh sign-in is the common case.
- **`drainMismatchedMutations` in App.tsx's `PersistQueryClientProvider.onSuccess`** (already there pre-H6) handles the *paused mutations* version of the same cross-tenant concern. H6 handles the *cached query* side. Both stay.

### H7. `__DEV__` defaults to `true` in fallback paths — ✅ DONE (2026-05-08, partial — single occurrence)
- **Files:**
  - `apps/mobile/src/lib/register-mutation-defaults.ts:147`
  - `apps/mobile/src/lib/check-for-updates.ts` (similar pattern)
- **Fix:** Replace `typeof __DEV__ !== 'undefined' ? __DEV__ : true` with `typeof __DEV__ === 'boolean' ? __DEV__ : false`. Audit every `__DEV__` reference for the same pattern.

#### Findings on close inspection (premise re-evaluated)

- **Codebase-wide grep for the exact dangerous pattern:** `rg "typeof __DEV__"` returns ONE occurrence — `apps/mobile/src/lib/register-mutation-defaults.ts:152` (the audit's first cite, line drifted from `:147`).
- **`check-for-updates.ts` does NOT have the pattern.** [Line 5](apps/mobile/src/lib/check-for-updates.ts#L5): `if (__DEV__ || !Updates.isEnabled) return false;` — uses the global directly. If `__DEV__` is undefined the `||` short-circuits to `!Updates.isEnabled`, which is the prod-safe path. The audit's "similar pattern" cite was incorrect; nothing to change here.
- **Other `__DEV__` references** (verified by full grep over `apps/mobile`):
  - `App.tsx:61` `__DEV__ ? 'development' : 'production'` — undefined → 'production'. Prod-safe.
  - `App.tsx:71` `__DEV__ ? 1.0 : 0.05` — undefined → 0.05. Prod-safe.
  - `App.tsx:77` `enabled: !__DEV__` — undefined → enabled (Sentry on). Prod-safe.
  - `App.tsx:119` `if (!__DEV__) {` — undefined → enters branch (prod path). Prod-safe.
  - `App.tsx:158` `if (__DEV__) {` — undefined → skip dev block. Prod-safe.
  - `__tests__/setup.ts:4` — comment only, not code.
  All other usages already default to prod semantics on undefined; only the explicit `: true` fallback in `register-mutation-defaults.ts` could route a release build into the throw-on-shape-drift branch.
- **Test-design intent: changed (intentionally).** The pre-fix comment said "where we WANT the throw, by design" for the test environment (vitest/jsdom). The new fallback (`false`) routes tests to the Sentry-capture branch instead, which the global Sentry mock handles as a no-op — meaning a missing-key shape drift would silently `continue` rather than fail loudly in tests. This is acceptable because:
  1. The TypeScript completeness check at compile time (`Record<MutationKeyName, MutationFunction>`) is the actual guard against shape drift; the runtime check is defense-in-depth, not the primary signal.
  2. A future test that wants to assert shape-drift handling can locally `vi.mock('@sentry/react-native', { captureMessage: vi.fn() })` and assert the call count, same pattern as auth-state-change.test.ts.
  3. The audit's stated motivation (don't crash a release build on a Metro injection failure) outweighs the now-silent test signal for an event that's compile-time-checked anyway.

#### What was changed

- `apps/mobile/src/lib/register-mutation-defaults.ts:152`
  - `const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true;` → `const isDev = typeof __DEV__ === 'boolean' ? __DEV__ : false;`
  - Comment block rewritten to explain (a) why we use the `=== 'boolean'` strict check (rejects non-boolean stubs from non-RN bundlers), and (b) why we default to prod semantics rather than dev semantics (prevents a release-build crash if Metro ever fails to inject the global).
- No test added — the runtime branch is a defense-in-depth safety net for an event the TypeScript compile-time check already prevents, and exercising it in a test requires mocking out `MUTATION_KEYS` from `@gustri/queries` (cross-package mock that adds noise without proportional safety value).

#### Validation run

- `pnpm test:mobile` — 53 files, 283 tests passing (no test additions; existing tests use the registration-success path which doesn't hit the fallback).
- `pnpm --filter @gustri/mobile type-check` — clean.
- `npx biome check` on the touched file — clean.

#### Notes for the agent picking up H8 / later

- **The fallback was the only `: true` in the codebase.** The H7 contract is now: any new `__DEV__` reference that needs an explicit fallback should default to `false`. If a reviewer sees `: true` in a future PR, ask why.
- **`__defaultsForTests` (line 168) is unused outside this file** — kept as an escape hatch but no test imports it. If an H7-shape-drift test is ever needed, prefer a local `vi.mock('@gustri/queries', …)` to inject an extra MUTATION_KEY rather than reaching into `__defaultsForTests`.
- **The TypeScript completeness check (`Record<MutationKeyName, MutationFunction>` at line 28) is the real guard.** If the audit's runtime "shape drift across untyped boundaries" concern ever materializes, it'd be a build-system bug — at which point the runtime check's behavior is moot because the bundle is already broken. The H7 change just makes the bug-mode less catastrophic.
- **Don't re-introduce a `: true` fallback for any other `__DEV__` reference.** If a future code path genuinely needs dev-only behavior at a fallback, gate it on `process.env.NODE_ENV === 'development'` or a more specific signal — not a "guess `true` because we're not sure."

### H8. MMKV persisted query cache has no eviction beyond `gcTime` — ✅ DONE (2026-05-08)
- **File:** `apps/mobile/src/lib/query-persister.ts:208-223`
- **Fix:** When telemetry detects size > 4 MB, programmatically remove queries older than 2 hours: `queryClient.removeQueries({ predicate: (q) => Date.now() - q.state.dataUpdatedAt > 2 * 60 * 60 * 1000 })`. Re-persist. Emit Sentry event with `level: 'info'` (not warning) when eviction runs.

#### Findings on close inspection (premise re-evaluated)

- **Premise valid.** Pre-fix `startCacheSizeTelemetry` only emits a breadcrumb (≤5 MB) and a one-shot `captureMessage` (>8 MB). Nothing actively trims the cache between cache-buster bumps and the 24 h `PERSISTED_MAX_AGE` ceiling. On a long-shift Android device with a heavy menu and active orders, the persister can grow steadily.
- **Audit's predicate covers stale data, but missed the in-flight-observer hazard.** Removing a query that a mounted screen is observing forces an instant refetch — defeating the offline-first persister at the very moment we're trying to relieve cache pressure. `q.getObserversCount() === 0` is added to the predicate so the eviction sweep targets only background residue (orders the kitchen view scrolled past, table pages no one's looking at), never the rows currently driving rendered UI.
- **"Re-persist" is implicit.** TanStack Query's persister subscribes to cache changes and writes within the configured throttle (2 s). After `removeQueries` shrinks the in-memory cache, the next throttled write commits the smaller blob — no manual `persistClient` call required, and forcing one would skip the throttle's intentional batching of bursty cache changes.
- **Threshold below the existing 5 MB warning breadcrumb.** Picked 4 MB so eviction kicks in *before* the cache hits the "operationally interesting" 5/8 MB markers. If the cache still climbs past those after eviction, we know aged data wasn't the problem (likely a single huge query payload — see notes below).
- **Sentry level: `info` (per audit).** Eviction is normal operating-mode behavior, not an error. Distinct from the existing `warning` level on the 5 MB / 8 MB sentinels so dashboards can filter the two apart.

#### What was changed

- `apps/mobile/src/lib/query-persister.ts`
  - Imported `QueryClient` type from `@tanstack/react-query` (type-only import — no runtime cost).
  - Exported `EVICTION_THRESHOLD_BYTES = 4 * 1024 * 1024` and `EVICTION_QUERY_AGE_MS = 2 * 60 * 60 * 1000` so tests and any future caller share one source of truth.
  - Added `pruneStaleUnobservedQueries(queryClient): { evicted: number }` — pure-by-input, target-counts-then-removes via a single `predicate` call. Both the count and the predicate share the same `cutoff` snapshot to avoid drift across the call.
  - `startCacheSizeTelemetry` now accepts `queryClient` as the first arg. When `storage.size > EVICTION_THRESHOLD_BYTES` the sample call runs the prune; if any rows were dropped it emits an `info`-level `captureMessage('query-cache eviction triggered', …)` with `extra: { sizeBytes, evicted }`. The existing 5 MB breadcrumb-warning and 8 MB capture-warning paths are unchanged.
- `apps/mobile/App.tsx`
  - Updated the single call site to pass the existing `queryClient` import: `startCacheSizeTelemetry(queryClient)`.
- `apps/mobile/src/__tests__/lib/query-persister-eviction.test.ts` (new, 4 tests)
  - Evicts queries older than the age threshold with no observers; leaves fresher queries alone.
  - Does NOT evict an aged query with a live observer (mounted-hook regression guard — uses `addObserver` directly to set `getObserversCount() > 0` without depending on a full React render harness).
  - No-op when no queries are aged.
  - Counts the evicted total correctly across 5+ aged queries (uses `(i+1) * 1_000ms` past cutoff so the strict-less-than `<` filter matches all of them — boundary-fence test that surfaced a real off-by-one in the first iteration).
  - Heavy-deps stub-out (`expo-constants`, `@react-native-async-storage/async-storage`, `react-native-mmkv`, `@/lib/storage-key`, `@tanstack/query-sync-storage-persister`) so the test runs without expo-modules-core's `__DEV__` requirement — same vi.mock-at-top pattern as the other lib tests.

#### Validation run

- `pnpm test:mobile` — 54 files, 287 tests passing (4 new H8 tests; previous bar 283).
- `pnpm --filter @gustri/mobile type-check` — clean.
- `npx biome check` on the three touched files — clean (two minor formatter auto-fixes applied).
- **Long-soak deferred.** The audit's "8-hour soak with simulated 200 events/min → memory plateau" is a release-build measurement (already on the release-checklist stress-testing block) — the unit test pins the eviction primitive that the soak relies on.

#### Notes for the agent picking up H9 / later

- **Eviction is opportunistic, not guaranteed.** A device can stay above 4 MB indefinitely if every query has live observers and is younger than 2 hours (kitchen view in active service). That's the design — we don't want to break offline-first to chase a number. If a future telemetry event shows that pattern in production, the right response is to narrow `PERSISTED_QUERY_KEYS` (drop a verbose key from disk persistence) or shrink the per-query payload, not to lower the eviction age.
- **`getObserversCount() === 0` is load-bearing.** Don't drop it for "more aggressive eviction" — that path is what the audit's bare predicate would have done, and it would refetch every visible screen on the device that was already over-budget.
- **The 2 s throttle on the persister write is enough headroom.** Don't add a manual `persistClient` call unless a future bug demonstrates the throttled write isn't catching the post-eviction state. Adding one would defeat the whole point of throttling and put a synchronous JSON.stringify of the entire client in the JS thread on every eviction.
- **R-Sweep-2 wires `realtime.health` as a Sentry tag** — eventually pair the eviction `captureMessage` with that tag so the Sentry dashboard can correlate "we evict more under degraded realtime". For now the `extra: { sizeBytes, evicted }` is the primary signal.
- **Single-payload runaway query.** If a single key (e.g., a 200-item menu with lots of nested options) blows past 4 MB on its own, eviction can't help — there's nothing aged. The 8 MB `captureMessage` will still fire and signal a structural problem.

### H9. No "offline-queued" vs "rejected" distinction on payments — ✅ DONE (2026-05-08, key renamed)
- **File:** `apps/mobile/src/hooks/use-payments.ts:36`
- **Fix:** Branch on error type. `NetworkError` (from `httpStatusToAppError`) → message `errors.payment_offline_will_retry`. Other errors → server message. Add i18n keys across 20 locales.

#### Findings on close inspection (premise re-evaluated)

- **Audit's literal key name `errors.payment_offline_will_retry` is misleading against the current code — renamed to `payment.networkError` after consulting the user.** `useCreatePayment` is configured `networkMode: 'always', retry: 0` ([use-payments.ts:36-37](apps/mobile/src/hooks/use-payments.ts#L36-L37)) precisely so payments never queue offline (a "20 minutes later" replay can collide with another card or diverge from the customer-facing receipt). A `NetworkError` here means "the request didn't land — please try again now"; promising the user that we'll retry would be a lie. The new key text reflects the actual contract: *"Network error — please check your connection and try again."*
- **Namespace: `staff.json` not `errors.json`.** The `errors.json` bundle is reserved for server-side sentinel codes (per CLAUDE.md's "Server-side error messages must use sentinel codes" rule, mapped via `SENTINEL_ERROR_CODES` in `packages/i18n/src/error-keys.ts`). A client-side network-failure message isn't a sentinel — the server never emits it. `payment.networkError` lives next to `payment.paymentFailed` / `payment.offlineUnavailable` in `staff.json`, alphabetically inserted between `payment.fullPayment` and `payment.noItemsToPay`.
- **Underlying bug confirmed.** Pre-fix `OrderPaymentScreen.tsx:106` showed `err.message` directly when `err instanceof Error`, including for `NetworkError` whose `.message` is the English string set in `apps/mobile/src/lib/api-routes.ts:52` (`new NetworkError(err instanceof Error ? err.message : 'Network request failed')`). Non-English-speaking staff would see English error text on a connection drop.
- **`NetworkError`** (from `@gustri/core`) is the right discriminator. It's thrown explicitly by `apiFetch` when the underlying `fetch()` rejects (line 51-53 of api-routes.ts). HTTP responses go through `httpStatusToAppError` and produce `ValidationError` / `AuthenticationError` / `ConflictError` etc., never `NetworkError`. So `err instanceof NetworkError` cleanly separates "I never reached the server" from "the server rejected".

#### What was changed

- **i18n: 20-locale addition.** Added `payment.networkError` key to every `staff.json`:
  - `ar`, `az`, `de`, `el`, `en`, `es`, `fa`, `fr`, `id`, `it`, `ja`, `ka`, `kk`, `ko`, `pt`, `ru`, `th`, `tr`, `uk`, `uz`.
  - Inserted alphabetically between `payment.fullPayment` and `payment.noItemsToPay` so the file ordering invariant the team relies on is preserved.
  - Translations match the tone of neighboring `payment.*` strings (terse, action-oriented). For `_other`/CLDR-quirky locales there's no plural form needed here — single sentence.
- `apps/mobile/src/screens/orders/OrderPaymentScreen.tsx`
  - Imported `NetworkError` from `@gustri/core`.
  - Refactored the catch block:
    - `ConflictError` branch unchanged (refetch + show err.message; the localized sentinel message is already correct).
    - **New** `NetworkError` branch: `showError(t('payment.networkError'))` — localized message, no refetch (server never wrote anything to refetch from).
    - Default branch unchanged: `showError(err instanceof Error ? err : t('payment.paymentFailed'))` for ValidationError, AuthorizationError, et al, where the server-supplied sentinel message is the right thing to display.
  - Each branch now `return`s after handling so the default toast doesn't double-fire.
- No change to `useCreatePayment` itself — the audit's evidence cite was the `networkMode` line; the actual fix is at the consuming screen, where the user-visible message is decided.

#### Validation run

- `pnpm --filter @gustri/i18n test` — 60 i18n tests passing (locale-alignment audit verifies all 20 locales have the new key).
- `pnpm test:mobile` — 54 files, 287 tests passing (no new mobile tests; the screen-level branching is straight-line code with no async surface beyond what existing snapshot tests already cover).
- `pnpm --filter @gustri/mobile type-check` — clean.
- `npx biome check` on the touched file — clean.
- **Manual**: airplane-mode + tap "Charge" on a release build → snackbar shows the localized network message, not the English `NetworkError.message`. Add to release-checklist reconnect-testing block (already lists "Airplane mode toggle mid-mutation across all financial flows").

#### Notes for the agent picking up H10 / later

- **Don't promote `payment.networkError` to `errors.json`.** It's not a sentinel and never will be — the server never emits a `payment_network_error` body. If a future audit asks why it's not in `errors.json`, the answer is "client-side error, namespace by feature, not by error-code style."
- **Other mutation hooks have the same English-leak hazard.** `useCreateOrder`, `useAddOrderItems`, `useCancelOrder`, etc. all surface `err.message` from a NetworkError directly at their call sites. H9 fixed only the payment screen because that's the audit's scope; if the same UX bug surfaces elsewhere, copy this pattern (`if (err instanceof NetworkError) showError(t(...))`) — DO NOT expand the network-message key into a generic `errors.network` until a second consumer needs it (the keys-by-feature convention is intentional).
- **The branching `return`s matter.** Without them, the default `showError(...)` branch would fire on top of the network/conflict snackbar and overwrite it. If you add a fourth error class later, follow the same `return` discipline.
- **The `networkMode: 'always', retry: 0` payment contract is load-bearing** — see the comment block at `use-payments.ts:27-35`. Don't relax it without re-reading B1's idempotency analysis; queueing offline payments is exactly the failure mode that audit closed.

### H10. Sentry breadcrumb URL redaction is fragile — ✅ DONE (2026-05-08)
- **File:** `apps/mobile/App.tsx:75-80`
- **Fix:** Strip query strings via regex (`url.replace(/\?.*$/, '')`) before any URL parsing. If `new URL(...)` throws, drop the breadcrumb entirely rather than passing through.

#### Findings on close inspection (premise re-evaluated)

- **Premise valid.** Pre-fix `App.tsx` (`beforeSend`, post-B3 numbering) only deleted the per-name params `token` and `apikey` from breadcrumb URLs ([App.tsx:90-99](apps/mobile/App.tsx#L90-L99) before this change). Production breadcrumbs from `/api/v1/*` and Supabase requests carry arbitrary query params: customer-search free text, sentinel `?error=...` strings, order/staff ids, plus anything a future endpoint might add. Per-name allowlist was a fragile contract — a new param shipped without an audit-trail update would silently leak. The audit's "drop everything past `?`" is the right denylist-of-one shape.
- **`new URL` throw → drop the breadcrumb.** Pre-fix the catch block left malformed URLs through verbatim, on the theory "we couldn't parse it so we couldn't strip it, but it's probably benign." On close read that's the worst answer: we have NO claim about what's in the unparsed string, so the safer move is "if we can't reason about it, don't ship it." The new behavior filters that breadcrumb out of the event entirely.
- **Refactored the per-breadcrumb mutation loop to `Array#filter` instead of `for…of`.** The pre-fix code couldn't drop a breadcrumb mid-iteration (the array wasn't being rewritten); switching to `filter` lets the URL-malformed branch return `false` to drop, while the keep path returns `true` after the existing header / body redactions still run.
- **Extracted the URL helper for unit-testability.** The `beforeSend` callback is bound at Sentry init (top-level side effect) — exercising it from a test would require mocking `Sentry.init` to capture the callback, then synthesizing a breadcrumb event. A small pure helper (`sanitizeBreadcrumbUrl`) is a cleaner test surface and lets future audits expand the contract (e.g. allowlisting hosts) without churning App.tsx.
- **Regex `/\?.*$/` is greedy and strips fragments too.** This is a minor over-redaction — `#anchor` parts client-side don't go over the wire from `fetch`/`xhr`, but they CAN appear in breadcrumb URL strings (Sentry copies the request input verbatim). Stripping is conservative and matches the audit's literal regex; no behavior the client cares about depends on a fragment being preserved in a Sentry breadcrumb.

#### What was changed

- `apps/mobile/src/lib/sentry-breadcrumb-url.ts` (new)
  - Exported `sanitizeBreadcrumbUrl(rawUrl: string): string | null` — does the regex-strip and the URL-validity probe in one place. Module-level JSDoc spells out *why* we strip the entire query string rather than maintaining a per-name denylist.
- `apps/mobile/App.tsx`
  - Imported the new helper.
  - Replaced the inline `try { new URL(...); searchParams.delete(...); } catch { /* leave */ }` with `const cleaned = sanitizeBreadcrumbUrl(...); if (cleaned === null) return false; breadcrumb.data.url = cleaned;`.
  - Switched the breadcrumb mutation loop from `for…of` to `event.breadcrumbs.filter(...)` so the malformed-URL drop actually removes the breadcrumb from the event, not just leaves a partially-redacted entry.
  - Comment block at the call site explains the H10 contract pointing back to the helper for the why.
- `apps/mobile/src/__tests__/lib/sentry-breadcrumb-url.test.ts` (new, 7 tests)
  - Strips the query string on a normal URL.
  - Passes through a URL with no query string.
  - Strips multiple query params in one shot — proves the no-per-name-denylist contract.
  - Returns `null` when the result isn't a valid URL (drops free-text strings, `://broken`, empty input).
  - Returns `null` for protocol-less hosts (e.g. `example.com/foo` doesn't parse via `URL`).
  - Preserves the path component after the host.
  - Strips fragments too — pins the audit's literal `/\?.*$/` greediness so a future "preserve fragments" tweak fails the test loudly.

#### Validation run

- `pnpm test:mobile` — 55 files, 294 tests passing (7 new H10 tests; previous bar 287).
- `pnpm --filter @gustri/mobile type-check` — clean.
- `npx biome check` on the three touched files — clean (one auto-format applied).
- **Manual Sentry-quota check deferred** to release-checklist monitoring block (already lists "PII redaction unit tests cover message + data + URL paths"). The unit tests pin the URL contract; live verification happens against a release build.

#### Notes for the agent picking up M-tier / later

- **Don't re-introduce a per-name allowlist.** If a future ticket asks for "we want to keep `?lang=en` for diagnostics", say no — the value of the per-name escape is dwarfed by the cost of forgetting one param. Either keep query strings entirely, or strip them entirely. Never partial.
- **`event.breadcrumbs.filter(...)` lets you drop ANY breadcrumb**, not just URL-malformed ones. If you add a future redaction that finds an unsanitizable string in `data.body` or `data.message`, return `false` from the same filter rather than introducing a parallel filter pass — same shape, same behavior.
- **The helper is intentionally generic** — no app-specific state, no React, no Sentry import. If a future breadcrumb path (e.g. `console` breadcrumbs that include URLs in stringified objects) needs the same sanitization, it can call the helper directly.
- **B3 already gates `beforeBreadcrumb` on `__DEV__` for category drops.** H10's URL handling lives in `beforeSend` (per-event final pass) so it applies to whatever survived the per-creation `beforeBreadcrumb`. Don't move the URL logic to `beforeBreadcrumb` — by then a breadcrumb may not yet have its `data.url` populated by Sentry's instrumentation.
- **`#fragment` stripping is documented in the test.** If a future product requirement actually needs fragments preserved, you'll have to update the regex to `/\?[^#]*/` AND update the test; both must change together so a reviewer sees the trade-off.

---

## 🟡 Tier 4 — Medium

### M1. Inline role checks in mobile
- **Files:** `apps/mobile/src/screens/orders/OrderDetailScreen.tsx:91`, `apps/mobile/src/screens/tasks/TasksListScreen.tsx:34`, and any other inline `staff?.role === 'admin'` references.
- **Fix:** Mirror staff-web's `useCanPerform`/`PERMISSIONS` map into mobile (`apps/mobile/src/hooks/use-can-perform.ts`). Replace inline comparisons. CLAUDE.md explicitly forbids new inline role checks.

### M2. Destructive `Alert.alert` confirms
- **Files:** `apps/mobile/src/screens/tasks/TasksListScreen.tsx:164-180`, search for other `Alert.alert.*destructive` usages.
- **Fix:** Build a typed `<DestructiveConfirmModal>` component requiring explicit text input or a long-press to confirm. Use it for: cancel order, refund, delete task, void payment.

### M3. Sentry redaction whitelist misses message text
- **File:** `apps/mobile/src/lib/sentry-redaction.ts:13-24`
- **Fix:** Add a `redactString(s: string): string` that runs regex passes over message bodies (table numbers, order numbers, phone-shaped strings, email-shaped strings). Apply in `beforeSend` to `event.message`, `event.breadcrumbs[].message`, and nested string values.

### M4. Audio JSI handle leak on cleanup throw
- **File:** `apps/mobile/src/lib/sound.ts:111-127`
- **Fix:** On `remove()` throw, log to Sentry, force-rebuild the audio session before nulling the player ref. Consider using a single shared player and swapping the source rather than recreating.

### M5. Hook-local idempotency stamping not enforced
- **File:** `apps/mobile/src/hooks/use-create-order.ts`
- **Fix:** Add a comment block above the hook documenting the idempotency contract. Add a CI grep guard that fails if any new `createOrder` mutation in `@gustri/queries` lacks a `client_request_id` field in its variables type.

### M6. No `mutationKey` on payment mutation
- **File:** `apps/mobile/src/hooks/use-payments.ts:51`
- **Fix:** Add `mutationKey: ['create-payment']` (or richer key including order id). Required for `useIsMutating`, replay, and dedup hooks.

---

## 🔄 Realtime Consistency — Sweep Tasks

After Tier 1 + Tier 2 are done, run this consolidation sweep:

- **R-Sweep-1.** Standardize all `useRealtimeSync` consumers on a common shape: subscribe → patch via `setQueryData` → fall back to `invalidate` only on degraded recovery.
- **R-Sweep-2.** Add a single `realtime.health` gauge in the realtime-status-store that reflects `connected | degraded | disconnected` — surface in a dev banner and to Sentry as a tag.
- **R-Sweep-3.** Exponential backoff on channel re-subscribe must **not** reset on transient `SUBSCRIBED` if the channel errored within the last 30s. Track last-error-time alongside retry count.
- **R-Sweep-4.** Run `runDegradedCatchup` under a debounce (≥1s) so channel flap does not cause overlapping refetches.

---

## 📶 Offline / Reconnect — Sweep Tasks

- **O-Sweep-1.** Cold start ordering: session stamp resolution **must** complete before persister hydrates queries or drains mutations. Add an explicit promise gate in `App.tsx` boot sequence.
- **O-Sweep-2.** Captive portal: when `captive-portal.ts` detects redirect, pause mutation drain and surface a "Sign into Wi-Fi" banner. Resume drain only after a real connectivity probe succeeds.
- **O-Sweep-3.** Stale-on-resume: when `AppState` returns to `active` and `last-active-at > 5 min ago`, force-fetch primary screens (orders, tables, kitchen) before allowing mutations.
- **O-Sweep-4.** Cap persisted mutation queue at 200 entries. On overflow, dead-letter oldest to Sentry with payload metadata (no PII).

---

## 💳 Financial Integrity — Verification Checklist

After B1, B5, C6 are fixed, manually verify each scenario:

- [ ] Two devices, simultaneous full-payment on the same order → one succeeds, the other gets a clear conflict error.
- [ ] Two devices, simultaneous partial payments summing > total → the one that lands second is rejected.
- [ ] Offline + tap "Charge" → mutation queues; reconnect → exactly one server-side payment row.
- [ ] Force-kill app mid-payment-mutation → relaunch → exactly one server-side row, UI shows correct paid state.
- [ ] Refund flow mirrors all of the above.
- [ ] `financial_audit_log` has no duplicate rows under concurrent refund race.

---

## 🧨 Top 10 incidents this audit prevents

1. **Cashier double-charge during peak rush.** — Fixed by B5.
2. **Duplicate order on weak Wi-Fi.** — Fixed by B1.
3. **Wrong-tenant data flash after device hand-off.** — Fixed by B2 + H6.
4. **KDS marks wrong item ready during rapid taps.** — Fixed by H1 + H2.
5. **Payment "succeeds" but order remains open.** — Fixed by C6.
6. **Sentry quota exhausted mid-month.** — Fixed by B3.
7. **Reconnect storm freezes kitchen during ISP flap.** — Fixed by C5 + R-Sweep-3.
8. **Fired employee retains access.** — Fixed by C3.
9. **Push notifications go silent for one device after token leak.** — Fixed by H5.
10. **App crashes on low-end Android after 6+ hours.** — Fixed by B2 + B6 + H8 + M4.

---

## 📋 Final release checklist

Block release until all checked.

### Monitoring & observability
- [ ] B3 done — Sentry sample rates set; quota alarm at 70% / 90%
- [ ] PII redaction unit tests cover message + data + URL paths
- [ ] Crash-free-session ≥ 99.5% across last 7 days of staging
- [ ] Server log dashboards live for `/api/v1/payments`, `/refunds`, `/orders` (p95, error rate, replay-dedup count)
- [ ] Push-token cleanup job operational (`DeviceNotRegistered → revoke`)

### Crash & error reporting
- [ ] Sentry receives errors from a release build (verified manually)
- [ ] Source maps + native symbols uploaded for both platforms

### Reconnect testing
- [ ] Airplane mode toggle mid-mutation across all financial flows → exactly-once
- [ ] WebSocket flap loop (kill ws every 5s for 5 min) → no duplicates, no UI thrash
- [ ] Background 2 min → foreground → fresh fetch, no stale realtime
- [ ] Captive portal scenario → no infinite spinner

### Concurrency testing
- [ ] Two devices charging same order → 409 on loser, no overcharge
- [ ] Two cashiers refunding same order → second sees 409, no double audit row
- [ ] Two waiters editing same table → reconciles cleanly

### Auth lifecycle
- [ ] Login → logout → login as different tenant → no stale data flash
- [ ] Password change device A → device B invalidated within 60s
- [ ] Inactivity lock triggers `forceLogout` end-to-end
- [ ] Refresh-token expiry → clean re-login prompt, no silent stale state

### Rollback readiness
- [ ] EAS Update channel & rollback rehearsed (publish bad → roll back in <5 min)
- [ ] Server feature flags wired for risky paths
- [ ] DB migrations have rollback files for destructive changes

### Stress testing
- [ ] 8-hour soak with simulated 200 events/min → memory plateau confirmed
- [ ] Low-end Android Go (≤2 GB RAM) → kitchen view sustains 100 active orders
- [ ] FlashList re-render budget < 16 ms at 5 Hz
- [ ] MMKV cache after 8 hours ≤ 4 MB

### Production environment safety
- [ ] Only `EXPO_PUBLIC_SUPABASE_ANON_KEY` shipped; no service role in mobile bundle
- [ ] `__DEV__` defaults to `false` in fallbacks (H7)
- [ ] No `console.log` in critical paths (CI grep gate)
- [ ] No leftover `Alert.alert('debug…')`

---

## ✅ Areas already production-ready (do not touch)

These were verified during the audit and need no changes — leave them alone:

- Headless package boundary (`@gustri/core`, `@gustri/database`) — lint guards in place
- Mobile-local hooks correctly layer realtime/sound/haptics over `@gustri/queries`; no duplicated fetch paths
- Zustand stores have clear ownership (`auth-store`, `pending-intent-store`, `realtime-status-store`)
- FlashList replaces FlatList everywhere; `MenuItemCard` and `OrderItemRow` are memoized
- `useCallback` discipline in OrdersListScreen, KitchenDisplayScreen, TablesListScreen
- `setupOnlineManager` + `focusManager` + NetInfo wiring is correct
- Sentry SDK gated in dev via `enabled: !__DEV__`
- Tenant isolation enforced server-side via JWT claims (no client-sent tenant headers)
- Sensitive material in SecureStore; query cache in MMKV — correct division
- Inactivity lock calls `forceLogout` (not UI-only) — prior concern resolved
- Sound preload at app boot — no per-event AudioContext creation
- Mobile-only omissions documented and intentional (staff CRUD, billing, plan upgrades)

---

## How to work this document

1. Open a PR per task. Title format: `mobile-audit: <ID> — <short description>` (e.g., `mobile-audit: B1 — unify idempotency key path`).
2. Each PR's description must include: the audit ID, the file:line evidence cited above, the validation result, and screenshots/logs for any UX-visible change.
3. Tier 1 PRs are gated on review by a second engineer. Tier 2+ can self-merge after CI green.
4. After completing each tier, run the full release checklist subset relevant to that tier and check the boxes here in this document via PR.
5. Stop and escalate if any task's premise is invalidated by the actual code — do not paper over by inventing a new fix.

**Do not skip the verification step on Tier 1 items.** Money correctness and tenant isolation are the launch-blocking constraints; everything else is repairable post-launch.
