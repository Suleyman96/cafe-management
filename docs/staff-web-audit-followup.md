# staff-web Production Audit — Outstanding Follow-Ups

Companion to the production audit performed on branch `fix/staff-web-critical-blockers`. The four critical blockers that were shipped on that branch are listed under [Shipped](#shipped-on-fixstaff-web-critical-blockers) for traceability; everything else is open work.

Status field convention: **🚨 Critical** must precede any "production-trust" claim, **🔴 Major** within first sprint after launch, **🟠 High** within month one, **🟡 Medium** when convenient, **✅ Strength** = noted, no work.

---

## Shipped on `fix/staff-web-critical-blockers`

For context only — do not redo.

- `4937081` — Scope cross-tab cache invalidation to operational keys
- `8fb6cd8` — Explicit Retry UX + reassurance banner on payment failure
- `e7a9044` — Distinguish already-handled call from generic failure
- `b794b3c` — Anchor kitchen elapsed time to server clock + skew banner
- `863c471` — Show actionable error when delivery list is missing a driver
- CI gap closed: `deploy-migrations.yml` chains app deploys behind a `supabase db push` step. Prior to this, app code shipped without the matching schema, which caused the May 2026 prod incident (PGRST204 on `is_takeoutable`). See workflow header for ordering / failure semantics.

---

## 🚨 Critical — open

### C-1. Cancel-order undo window (soft-cancel via `cancelled_pending`)

**Scope:** option (b) of the original spec — kitchen actually pauses prep during the undo window, auto-promote to `cancelled` after 60 s, customer-web hides the pending state.

**Why it deserves its own PR.** The full design touches:

- `supabase/migrations/` — new enum value on `orders.status` (`cancelled_pending`), plus columns for `cancelled_at`, `cancelled_by`, `cancellation_deadline_at`.
- RLS rewrite for the anon-customer cancel path (currently `supabase/migrations/00000000000000_baseline.sql:2619` and `:2907` allow anon UPDATE to `cancelled`). Needs careful decision: can a customer-initiated cancel be undone by staff? What does the customer see?
- Auto-promote mechanism. This repo does not currently use `pg_cron` — adopting it requires Supabase Pro and a new ops dependency. Alternative is lazy-promote-on-read which is race-prone across staff devices. Pick one deliberately.
- Status badges in three packages: `packages/ui-web/src/badges.ts`, `packages/design-tokens/src/colors.ts`, `packages/ui-mobile/src/StatusBadge.tsx`.
- Kitchen queue filter at `apps/staff-web/src/app/(staff)/kitchen/page.tsx:131-142` must exclude `cancelled_pending`.
- Customer-web `apps/customer-web/src/components/order/delivery-order-status.tsx:131-138` — decide whether to hide the pending state from the customer (recommended) or render "cancelling…".
- i18n key `orders.cancelledPending` across all 20 locales.
- Wrapper additions in `packages/api-client/src/wrapper/orders.ts:550-602`: split `cancelOrder` into `softCancelOrder` + `confirmCancelOrder` + `uncancelOrder` (or one promote endpoint).
- Audit log rows on cancel / promote / undo.

**Cheaper fallback if the full scope blocks:** option (a) — pure status reversal in a 60 s window. Adds `previous_status` + `cancellation_undo_deadline` columns, one `uncancelOrder` wrapper method, one API route, one undo toast on the cancel modal. Kitchen still sees a "cancelled" status during the window (so kitchen may have already pulled items off the line), but the data loss is recoverable. ~3 files, ~150 LOC.

**Open design decisions before starting:**

1. Auto-promote: pg_cron (cleanest, needs Pro) vs. server-side scheduled function vs. lazy-promote-on-read (race-prone).
2. Anon-cancel RLS: can a customer's cancel be undone by staff during the window?
3. Customer-web visibility of `cancelled_pending`.

---

## 🔴 Major operational workflow risks — open

### M-1. Payments are not role-scoped beyond `verifyStaff`
**File:** `apps/staff-web/src/app/api/v1/orders/[id]/payments/route.ts:36`. Any active staff member, including kitchen, can collect payment for any order in the tenant. With refunds being admin-only, this opens "collect-cash-then-have-admin-refund" abuse. Add `canPerform('collect_payment')` tied to role + (optionally) table assignment.

### M-2. Filter UIs hide actionable rows
- `apps/staff-web/src/app/(staff)/orders/page.tsx:140-155` — when a payment fails on a "paid"-filtered view, the order disappears.
- `apps/staff-web/src/components/kitchen/hidden-items-summary.tsx` — neutral typography for hidden cross-station items; kitchen lead can call "ready" while bar is still pouring.

Add a coloured "X items hidden by filter" badge; force-surface payment-failed rows regardless of filter; colour the hidden-items summary by urgency.

### M-3. Item transfer / split-check is tap-intensive
**File:** `apps/staff-web/src/components/modals/item-transfer-modal.tsx:60-72`. 12-item orders need 12+ taps. Add select-all-by-category and 50/50 split shortcuts. Highest UX-pain item flagged by the audit.

### M-4. Transfer-to-occupied-table is a soft warning
**File:** `apps/staff-web/src/components/modals/table-transfer-modal.tsx:77-81`. One extra click merges two bills. Promote to type-to-confirm or an explicit "merge" mode.

### M-5. Cancel `reason` textarea has no upper bound
**File:** `apps/staff-web/src/components/modals/cancel-order-modal.tsx:108`. A pasted complaint blows past server payload limits, fails silently, order in limbo. Add `maxLength` + client-side count.

### M-6. Z-Report is unbounded
**File:** `apps/staff-web/src/hooks/use-z-report-safe.ts:11-15`. Month-end close on a busy cafe fetches 10k+ payments to memory and renders a synchronous PDF. UI hang during the most stressful moment of the closing shift. Paginate by week or hard-cap with explicit "next page" controls.

---

## 🟠 High-risk realtime / concurrency issues — open

### H-1. Optimistic-concurrency `version` check is feature-flagged off by default
**File:** `apps/staff-web/src/hooks/use-orders-safe.ts:129`. Tenants without the flag fall back to last-write-wins on close/cancel. Either flip the default after a staging soak or document the risk in the rollout plan; today two admins racing close-unpaid can both succeed without conflict surfaced.

### H-2. Version-conflict "Override" path has no audit trail
**File:** `apps/staff-web/src/components/orders/version-conflict-banner.tsx`. Override is powerful and deliberate; should write a row into `financial_audit_log` (or a dedicated `override_log`) so disputes can be traced. Today it leaves no trace beyond `updated_at`.

### H-3. Realtime tenant filtering is client-supplied, not server-enforced
**File:** `apps/staff-web/src/hooks/use-realtime-sync.ts:107-115`. Convention always passes `tenant_id=eq.<id>`, but a future channel created without going through `useRealtimeSync` would receive cross-tenant events. Supabase RLS does not universally apply to Realtime broadcasts. Add a Supabase Realtime publication filter or wrap `supabase.channel()` behind a helper that refuses a missing tenant filter.

### H-4. Kitchen `staff_id` filter assumes RLS scopes staff to tenant
**File:** `apps/staff-web/src/app/(staff)/kitchen/page.tsx:158-166`. Filter is `staff_id=eq.<id>` not `tenant_id=eq.<id>`. Safe only if `staff_kitchen_filters` is strictly tenant-scoped via RLS on read. Audit the RLS policy; if missing, add it. If present, leave a comment at the call site naming the policy.

### H-5. Item-status mutations bypass version check
**File:** `apps/staff-web/src/hooks/use-orders-safe.ts:328-370`. Idempotent in practice (preparing→preparing is a no-op), but a slow-network "mark all served" bulk can produce a window where items are mixed pending/served while the order is `READY`. Consider opt-in version check for bulk item transitions.

### H-6. Pending retry timer can race a tenant switch
**File:** `apps/staff-web/src/components/providers/notification-provider.tsx:455-458`. A retry callback fires after `tenantId` changed → subscribes against the new tenant with stale handlers. Low probability, but capture `tenantId` in the closure and bail if it differs.

---

## 🔄 Realtime consistency — open

### R-1. No replay / gap-fill after WebSocket drop for financial mutations
On reconnect, a single fresh fetch is the catch-up mechanism. Fine for orders/items, but a payment that landed during the gap is only surfaced by the next realtime event. Add a "delta since last seen ts" reconcile pass on the payments query keyed by `last_seen_payment_ts`.

### R-2. Stale-data banner is too quiet
Today the kitchen sees the last-known state during the 30s fallback window with no overt indication. The existing `ConnectionBanner` (`connection-provider.tsx:85-100`) surfaces degraded/disconnected status when queries fail 3+ times — for a kitchen kiosk that's too late. Add a loud "stale data, reconnecting" banner when the websocket has been down > 15s, separate from the connection banner.

---

## 💳 Financial integrity — open

### F-1. Plan gate missing on discount and refund routes
**Files:**
- `apps/staff-web/src/app/api/v1/orders/[id]/discount/route.ts:32`
- `apps/staff-web/src/app/api/v1/orders/[id]/refunds/route.ts:34`

`verifyAdmin` only. A free-tier tenant can call these directly with curl. Wrap both with `verifyPlan([...])` matching the plan the UI offers.

### F-2. `tip_amount` is unbounded
**File:** `apps/staff-web/src/app/api/v1/orders/[id]/payments/route.ts:20`. `z.number().min(0).optional()` accepts £10,000 tips. Cap server-side at `amount * 1.0` or a tenant setting. The audit log mitigates but doesn't prevent.

### F-3. Type-to-confirm threshold for refunds is UI-only
**File:** `apps/staff-web/src/components/modals/confirm-refund-modal.tsx:57`. Server doesn't re-check. Low risk (the threshold is a friction knob, not a financial control), but a forged client trivially bypasses the speed bump. Server should re-check the tenant's current threshold against the refund amount.

### F-4. Payment validation triggers have no `FOR UPDATE`
Concurrent payments serialize on `INSERT` lock, not row lock. Safe in practice; mention in the production runbook so a future migration doesn't break the assumption.

---

## 🍽️ Kitchen workflow — open

### K-1. 30-second elapsed-time tick produces snap-color transitions
**File:** `apps/staff-web/src/components/kitchen/elapsed-time.tsx:24`. Reduce to 10s for smoother urgency signaling without re-render storms. Now that this leaf is server-anchored (shipped), the only cost of a faster tick is more `setState` calls in one leaf per card.

### K-2. `hidden-items-summary.tsx` uses neutral tone for cross-station hidden items
A pizza-station kitchen lead can call "ready" while the bar is still pouring. Colour the line orange when the blocking station is at-or-past urgency, and include the slowest station name (e.g. "waiting on: Bar").

### K-3. No "which station is blocking" sub-line on order cards
Bulk "All ready" advances order-level only when every station is done — correct logic, but no visual on the card showing which station is still pending. Add a "Waiting on: Bar" sub-line so the kitchen lead can see why an order isn't advancing.

### K-4. No "ping kitchen" or chat surface from order detail
Waiters revert to walkie-talkies or shouting. Even a simple "ping kitchen" intent button would reduce floor noise and create a written trace.

---

## ⚡ Performance — open

| # | File | Issue | Fix |
|---|---|---|---|
| P-1 | `apps/staff-web/src/app/(staff)/orders/page.tsx:36-41` | Unbounded orders list — 30-day window with no `LIMIT`, no virtualization | Hard cap 500-1000 rows + "Load older" button |
| P-2 | `apps/staff-web/src/lib/report-pdf-export.ts:1-2` | jsPDF + autotable eagerly imported (~200KB) | `React.lazy` the report module |
| P-3 | `apps/staff-web/src/app/providers.tsx:208-220` | No per-query `staleTime: 0` for kitchen/orders | Override defaults for those keys so backgrounded-tab return refetches |
| P-4 | `apps/staff-web/src/hooks/use-z-report-safe.ts:13` | (Also under F-6/M-6) — unbounded query, blocking PDF render | See M-6 |
| P-5 | `apps/staff-web/src/app/(staff)/kitchen/page.tsx:605` | Per-render `Date.now()` arithmetic — OK in isolation, expensive in 10-event burst | Memoize per-card based on `created_at` + tick; or use only the leaf-level tick (now anchored). Low priority. |
| P-6 | `apps/staff-web/src/components/providers/notification-provider.tsx:170-177` | Three `new Audio()` refs created once, never released | Acceptable as long as Sentry watch confirms no leak. |

---

## 🧠 Long-session stability — open

### S-1. `flushTimerRef` cleanup is conditional
**File:** `apps/staff-web/src/hooks/use-realtime-sync.ts:267`. Minor leak risk on frequent view toggling; cumulative cost is small but worth a guard.

### S-2. `StuckQueryObserver` logs but does not act
A stuck query on weak Wi-Fi silently stalls UI. Add auto-cancel after 90s with a "data unavailable, retrying" toast.

### S-3. No per-route error boundaries inside the `(staff)` segment
A throw in one feature blanks the entire shift. Wrap each route in a small boundary that renders a "section unavailable, reload" panel.

---

## 🔒 Multi-tenant safety — open

### MT-1. Auth-user reuse across tenants
**File:** `apps/staff-web/src/app/api/v1/staff/route.ts:84-92`. When creating a staff member, if the auth user exists, the code reuses the auth uid. One person can be staff at multiple tenants on a single auth account, and a compromised token reaches every linked tenant. Either create a tenant-scoped auth user or block reuse with 409 + a deliberate "link existing auth user" admin flow.

### MT-2. Session revocation grace is up to 1h
JWT TTL. Acceptable per design; document it in the offboarding runbook. If compliance ever demands sub-5-min grace, reduce JWT lifetime in Supabase config and accept the auth-latency cost.

### MT-3. No Sentry PII scrubber on staff-web server
Customer name / phone / address from `customer_orders` and free-text `customer_feedback.message` will land in error payloads unredacted. Add a `beforeSend` similar to customer-web's scrubber.

---

## ✅ Areas already production-ready (do not redo)

For reviewers and future-you — these are the strengths the audit confirmed.

- Idempotency end-to-end for payments / refunds / discounts: required `client_request_id`, persistent via `apps/staff-web/src/hooks/use-persistent-client-request-id.ts`, enforced by partial unique indexes and RPC-internal dedup.
- Atomic transactional mutations via `create_refund_with_audit` and `apply_discount_with_audit` RPCs with `FOR UPDATE` row locks and trigger-based validation.
- `verifyAdmin` / `verifyTenantClaim` posture — token re-verified, role + tenant cross-checked against DB on every call.
- JWT refresh ↔ Realtime rebinding via `channelRegistry` + `RealtimeAuthBridge` in `apps/staff-web/src/app/providers.tsx`.
- Leader-tab audio election with Web Locks primary + BroadcastChannel + heartbeat fallback (`apps/staff-web/src/lib/realtime/leader-election.ts`).
- Realtime invalidation debounce in `apps/staff-web/src/hooks/use-realtime-sync.ts:73-88`.
- Version-conflict banner when the flag is on — Refresh / Override semantics are clear (audit trail still owed, see H-2).
- i18n lazy loading in `apps/staff-web/src/lib/i18n.ts` — 19 locales code-split.
- PIN auth — scrypt-hashed (N=2^14), `timingSafeEqual`, IP rate-limited (5/300s).
- Rate limiting wired across all customer-facing routes.
- Server-anchored tenant resolution on QR-token routes.
- `useCanPerform` + `useIsOnline` convention.
- PostgreSQL trigger-based audit log, archive-before-delete retention.

---

## 🧨 Top 10 realistic incidents (carry-over list for runbook)

Each item below is the "what to watch for in the first 90 days of production":

1. **Cashier double-tap creates apparent double charge.** Mitigated by the new Retry UX banner (shipped). Watch Sentry for "payment.failureBannerSafeRetry" toast frequency — high count = network instability worth investigating.
2. **Wrong-order cancel during rush.** Mitigated only when C-1 ships. Until then, instruct floor staff to verify the order number out loud before tapping cancel.
3. **Tenant filter races a tab reload.** Cross-tab `tenant-changed` sweep is correct; the residual risk is the brief UI flash before clear. Consider a `tenantReady` gate on `Providers`.
4. **Two waiters acknowledge same call.** Mitigated (shipped). Watch for any spike in info-toast firings — that's the rate at which staff are stepping on each other.
5. **Kitchen clock drift marks orders overdue.** Mitigated (shipped). Watch Sentry for `clockSync.lastSyncedAt > 0 && |offset| > 2min` — every alert = a kiosk that needs an NTP fix.
6. **Z-Report freeze on month-end.** Open (M-6 / P-4). The closing shift overrun is the symptom to look for.
7. **Transfer-to-occupied-table merges bills.** Open (M-4). Watch dispute volume after launch.
8. **Refund + discount race.** Server-side `FOR UPDATE` serializes correctly. Open UI gap: no "order is being edited" lock surfaced via realtime — two admins on the same order can collide in the UI.
9. **WebSocket dies + iOS Safari kiosk mode suspends fallback poll.** The wake-from-background bridge calls resubscribe+invalidate; verify on real hardware in kiosk mode. Symptom: kitchen sits on 5+ min old data after refocus.
10. **Discount drives order to suspicious total via direct API.** Open (F-1). Plan-gate enforcement is missing server-side.

---

## Implementation order recommendation

If picking up from this list:

**Week 1**
- C-1 (cancel undo, design decisions first)
- F-1 (plan gate on discount/refund — small, server-only)
- F-2 (tip cap — small, server-only)
- M-1 (`canPerform('collect_payment')` — purely additive)

**Week 2-3**
- H-2 (audit trail for "Override")
- H-3 (centralise channel creation behind a helper)
- M-4 (hard transfer confirmation)
- M-3 (split-check shortcuts)
- M-6 / P-4 (Z-Report pagination)

**Month 1**
- MT-3 (Sentry PII scrubber)
- MT-1 (auth-user reuse policy)
- P-1 (orders pagination ceiling)
- S-3 (per-route error boundaries)
- K-2, K-3 (kitchen UX polish)
- The remaining 🟡 items as bandwidth allows

---

## Test plan reminder for any of these

The audit's "Production Readiness Checklist" still applies — keep it open when validating fixes:

- Concurrency: `pgbench`-style 50× parallel payment / refund / discount on same order; only one succeeds, others typed 409
- Realtime: kill the WebSocket every 30s for 1 hour with kitchen view open; no missed events after convergence
- Reconnect: airplane-mode toggle mid-payment ×20; zero double charges, zero "payment-uncertain" stuck orders
- Stress: 2000 orders over 14 days in staging; list FPS + cache memory after 14h open-tab session
- Financial: reconciliation script on 10k synthetic orders — `financial_audit_log` matches payments + refunds + discounts, zero drift
- Long-session: 24h kitchen kiosk; `performance.memory` growth ≤ 50MB
- Multi-device: five tablets, same tenant, rapid edits; no version-conflict false positives
- Multi-tenant: switch tenants in same browser, verify `queryClient.clear()` purges cache
- JWT refresh: force mid-shift refresh, observe `channelRegistry.resubscribeAll()` fires
- Clock skew: set kiosk +10 min, verify server-anchored times are correct (post-fix smoke test)
- Plan bypass: curl `/api/v1/orders/[id]/discount` with free-tier admin JWT → expect 403 after F-1 lands
- Cancel-undo: cancel an order, wait 30s, tap Undo → state restored, audit log captures both events (post-C-1)
