# customer-web Phase 2 — High-Risk Operational

Index: [21-CW-PROD-AUDIT-OVERVIEW.md](21-CW-PROD-AUDIT-OVERVIEW.md)

Five items. Ships *after* Phase 1, *before* a public release. Each closes a class
of subtle operational failure where the customer can't tell whether the app is
broken or the restaurant is slow.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` shipped · `[-]` won't fix

---

## H1. Realtime subscription doesn't visibly surface "disconnected"

- [ ] **Where.**
  - [apps/customer-web/src/hooks/use-order.ts:82-108](../apps/customer-web/src/hooks/use-order.ts#L82-L108)
  - [apps/customer-web/src/hooks/use-delivery.ts:61-87](../apps/customer-web/src/hooks/use-delivery.ts#L61-L87)
  - Consumers: [components/order/order-status.tsx](../apps/customer-web/src/components/order/order-status.tsx), [components/order/delivery-order-status.tsx](../apps/customer-web/src/components/order/delivery-order-status.tsx)
- [ ] **What.** Neither hook reads `.subscribe(status => …)`. When the websocket drops (phone sleeps, tunnel through coffee-shop wifi), the customer sees a frozen order status with no indication.
- [ ] **Why it matters.** Failure scenario #5: phone sleeps for 10 min, kitchen ships food, the page still says "preparing." Customer flags down a waiter unnecessarily, or worse, leaves the table thinking the food isn't ready.
- [ ] **Fix steps.**
  1. Track subscription status in both hooks:
     ```ts
     const [rtStatus, setRtStatus] = useState<'CONNECTING' | 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR'>('CONNECTING');
     // pass setRtStatus into .subscribe((status) => setRtStatus(status as any))
     ```
     Return it from the hook alongside the query.
  2. In `order-status.tsx` (and delivery equivalent), render a small inline banner when `rtStatus !== 'SUBSCRIBED'` *and* `query.data` is older than ~30s. Copy: "Reconnecting…" with a manual "Refresh" button that calls `query.refetch()` + tears down & re-creates the channel.
  3. **Don't** render the banner instantly on CONNECTING — that adds noise on every mount. Gate by both staleness AND non-SUBSCRIBED.
  4. Add the new strings to all 20 locales: `realtime.reconnecting`, `realtime.refresh`. Put them under a new `realtime` namespace in `customer.json`.
- [ ] **Verification.**
  - DevTools → Network → "Offline" mid-order → banner appears within 30s. Click Refresh → query refetches, channel re-subscribes.
  - Toggle airplane mode on a real phone for 60s, restore → state reconciles, banner clears.
- [ ] **Done when.** Banner renders correctly under disconnect, manual refresh works, no banner under normal operation.

---

## H2. No refetch on visibility / reconnect for realtime queries

- [ ] **Where.**
  - Global QueryClient defaults: [apps/customer-web/src/components/providers.tsx:51-82](../apps/customer-web/src/components/providers.tsx#L51-L82)
  - Realtime hooks (same as H1)
- [ ] **What.** `refetchOnWindowFocus: true` is set globally so coming back to the tab will refetch React Query data, but `refetchOnReconnect` is not explicitly set and the realtime channel does not re-subscribe on `visibilitychange`. Phone wakes → query refetches once, but no fresh channel subscribe.
- [ ] **Why it matters.** After the one-shot refetch, the customer sees the state at wake-time, but subsequent staff-side updates go unannounced until the next focus event. Same failure mode as H1 just slower-burn.
- [ ] **Fix steps.**
  1. Set `refetchOnReconnect: 'always'` in the global QueryClient defaults.
  2. Inside `useOrder` / `useDeliveryOrder`, add a `visibilitychange` listener that:
     - If `document.visibilityState === 'visible'`:
       - Force `queryClient.invalidateQueries([QUERY_KEYS.ORDER, tableId])` (or delivery equivalent).
       - Re-subscribe the channel: `supabase.removeChannel(channelRef.current.channel); channelRef.current = null;` then the effect re-runs and re-creates.
  3. Keep the deferred-teardown `setTimeout(0)` pattern intact — visibility-based teardown should be *synchronous* to avoid racing with a re-mount triggered by a back-forward cache restore.
  4. Document the trade-off inline (every visibility toggle costs one RPC + one SUBSCRIBE round-trip).
- [ ] **Verification.**
  - Sleep phone for 5 min, wake → channel state in the React DevTools Realtime profiler shows a fresh subscribe.
  - Kitchen updates after wake reach the customer screen within ~1s.
- [ ] **Done when.** Visibility listener wired, manual sleep/wake test confirms re-subscribe.

---

## H3. Order-cancel race: customer cancels, kitchen has already started

- [ ] **Where.**
  - [apps/customer-web/src/components/order/order-status.tsx:64](../apps/customer-web/src/components/order/order-status.tsx#L64) (`canCancel`)
  - Server: `apps/staff-web/src/app/api/v1/customer/orders/[id]/cancel/route.ts` (verify behavior)
- [ ] **What.** Client allows cancel when `status ∈ {pending_approval, new}`. Kitchen can transition `new → preparing` after the customer reads the screen. Customer taps cancel; server may accept or reject depending on its own state check. If rejected, current UX is a generic `t('common.error')` toast.
- [ ] **Why it matters.** Failure scenario for irreversible food cost. Even when the server correctly rejects the cancel, the customer is told "something went wrong" instead of "kitchen has started — call a waiter to discuss."
- [ ] **Fix steps.**
  1. **Server.** Confirm the cancel route already re-reads `order.status` inside its transaction and returns a sentinel error when state has progressed. If not, add it. Sentinel: `order_cancel_too_late` (snake_case, per CLAUDE.md).
  2. **i18n.** Add `errors.order_cancel_too_late` to all 20 `errors.json` with copy like "Kitchen has already started preparing your order. Please call a waiter to discuss."
  3. **Client.** Update [order-status.tsx:82-98](../apps/customer-web/src/components/order/order-status.tsx#L82-L98) `handleCancelOrder` catch to call `localizeErrorMessage(error.message, fallback)` instead of bare `t('common.error')`. The fallback should still localize unknown errors.
  4. **Add a "Call Waiter" CTA inside the rejection toast** (or escalate to a small modal) — gives the customer a one-tap recovery path.
- [ ] **Verification.**
  - Manual: open `staff-web` orders page in one tab, customer-web order-status in another. Move order to `preparing` in staff, click cancel in customer → toast reads the localized "kitchen has started" message + has a Call Waiter affordance.
- [ ] **Done when.** Server returns the sentinel, client localizes it, CTA wired.

---

## H4. `setTableContext` errors silently for non-sentinel failures, leaving the menu CTA empty

- [ ] **Where.** [apps/customer-web/src/components/table/table-landing.tsx:58-87](../apps/customer-web/src/components/table/table-landing.tsx#L58-L87), [apps/customer-web/src/components/table/table-landing.tsx:376-411](../apps/customer-web/src/components/table/table-landing.tsx#L376-L411)
- [ ] **What.** Three QR sentinel errors → "Invalid Table" UI. Everything else → Sentry-captured silently, `tenantPlan` stays `null`, the Browse Menu area renders a 48px empty placeholder (`<div className="h-12" />`) until the user reloads.
- [ ] **Why it matters.** Failure scenario #3 / a transient RPC blip strands the customer on a layout that looks like a perpetual skeleton. They assume the app is broken.
- [ ] **Fix steps.**
  1. Distinguish *unknown* error from *no plan returned*:
     - On a thrown error that isn't one of the three sentinels, set a `setRetryNeeded(true)` state and render a small CTA: "Couldn't load the menu — tap to retry."
     - The retry button calls `setTableContext(token)` again with the same token.
  2. After 3 failed retries, escalate the customer-facing UI to "Network looks unstable. Please check your connection and try again." while still keeping Sentry capture in place.
  3. If `tenantPlan === null` *after* a successful RPC return (the Sentry-warn case in [supabase.ts:107-111](../apps/customer-web/src/lib/supabase.ts#L107-L111)), fall back to letting the customer browse the menu — current behavior is to render nothing, which is worse than showing the menu and discovering ordering is gated.
  4. *Don't* bypass the QR check on retry — the same RPC must succeed. The retry is for network jitter, not policy bypass.
- [ ] **Verification.**
  - Throttle the `set_table_context` RPC (DevTools network conditions, slow + offline) → retry UI appears.
  - Recover network, tap retry → CTA loads.
- [ ] **Done when.** Retry UI shown on non-sentinel error, plan-null fallback renders the menu CTA in standard mode.

---

## H5. `apiBaseUrl` env var has no runtime guard

- [ ] **Where.**
  - [apps/customer-web/src/middleware.ts:37](../apps/customer-web/src/middleware.ts#L37) (`process.env.NEXT_PUBLIC_API_BASE_URL ?? ''`)
  - [apps/customer-web/src/lib/api-routes.ts:10](../apps/customer-web/src/lib/api-routes.ts#L10) (`process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'`)
- [ ] **What.** If `NEXT_PUBLIC_API_BASE_URL` is unset in production, the CSP `connect-src` becomes `… '' …` (i.e. effectively nothing for that hint), AND `apiFetch` POSTs hit `http://localhost:3001` from a public deployment. The first failure is silent (browser blocks with CSP violation); the second is catastrophic (POSTs leak to nowhere or to whatever resolves on the customer's local network).
- [ ] **Why it matters.** Single env-var misconfig and customer-web becomes unable to place orders with zero user-visible error message. Sentry would catch the CSP violations but only after customers have already failed.
- [ ] **Fix steps.**
  1. **Build-time guard.** Add a check in `next.config.js` that throws when building in `production` mode without `NEXT_PUBLIC_API_BASE_URL` set:
     ```js
     if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_BASE_URL) {
       throw new Error('NEXT_PUBLIC_API_BASE_URL must be set for production builds');
     }
     ```
  2. **Runtime guard in middleware.** If `apiBaseUrl` is empty, log a Sentry breadcrumb and emit a CSP that *excludes* the `connect-src` hint instead of silently producing a malformed header.
  3. **api-routes.ts fallback.** Replace the `|| 'http://localhost:3001'` fallback with an explicit `if (typeof window !== 'undefined' && !API_BASE_URL) Sentry.captureMessage(...)`. The dev-only default is OK but should be gated on `NODE_ENV === 'development'`.
  4. **CI.** Add a `pnpm typecheck && pnpm build` step that asserts the build fails without the var set.
- [ ] **Verification.**
  - Unset the env var locally → `pnpm build` fails with the explicit error.
  - Production build with the var set → works as today.
- [ ] **Done when.** Build fails fast on missing env, middleware emits sane CSP, dev fallback explicit.

---

## Phase 2 exit gate

Realtime banner observable, visibility refetch wired, cancel-race messaged, table-landing retry visible, env-var build gate green. Confirm with two synthetic tests:

- Sleep phone, wake, observe re-subscribe and state reconciliation.
- Customer cancel from `preparing` state in `staff-web` triggers localized rejection + CTA.

Once Phase 2 ships, hand off to [24-CW-PROD-PHASE-3-MAJOR-UX.md](24-CW-PROD-PHASE-3-MAJOR-UX.md).
