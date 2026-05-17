# customer-web Phase 4 — Security & Privacy

Index: [21-CW-PROD-AUDIT-OVERVIEW.md](21-CW-PROD-AUDIT-OVERVIEW.md)

Five items. Closes residual PII / bearer-token surface area and tightens the
error-mapping path so server-emitted sentinels actually become localized
customer messages.

These are *not* DB-policy items — those were closed by PRs #97–#102. This
phase covers the app-layer side of "if someone shares a phone, what residue
remains?"

Status legend: `[ ]` not started · `[~]` in progress · `[x]` shipped · `[-]` won't fix

---

## S1. Auto-clear delivery PII after successful order

- [ ] **Where.**
  - [apps/customer-web/src/store/delivery-store.ts](../apps/customer-web/src/store/delivery-store.ts)
  - [apps/customer-web/src/components/cart/delivery-cart-screen.tsx:117-125](../apps/customer-web/src/components/cart/delivery-cart-screen.tsx#L117-L125)
- [ ] **What.** `customerName`, `customerPhone`, `deliveryAddress`, `deliveryNotes` are persisted to localStorage (`name: 'delivery-storage'`) indefinitely. After a successful order, none of these are cleared.
- [ ] **Why it matters.** On a shared device (kiosk, family iPad, partner's phone), the next visitor pre-fills with the previous customer's PII. Trust + privacy.
- [ ] **Fix steps.**
  1. After `setLastOrderId(order.id)` in `delivery-cart-screen.tsx` (line 120), call a new `useDeliveryStore.getState().clearCustomerInfo()` that wipes name/phone/address/notes but **preserves** `qrToken` and `lastOrderId` (those are still needed for status tracking).
  2. Add `clearCustomerInfo: () => void` to the store, distinct from `clearDeliveryInfo` (which wipes everything).
  3. **Don't** clear PII on cart screen navigation (back nav from cart → menu → cart should keep form pre-filled). Only on success.
  4. Consider also adding an explicit "Forget my info" link on the delivery landing page when PII is pre-filled.
- [ ] **Verification.**
  - Place an order → reload `/delivery` → form is empty.
  - Mid-flow back-nav (cart → menu → cart) → form still pre-filled.
- [ ] **Done when.** PII clears on success, mid-flow nav preserves, explicit-forget added (optional).

---

## S2. Auto-clear `qrToken` after order success

- [ ] **Where.**
  - Same files as S1.
- [ ] **What.** `qrToken` (the delivery bearer) is persisted to localStorage. It's a tenant-resolving secret; an attacker with later access to the browser can place orders against that tenant from a fresh tab.
- [ ] **Why it matters.** Defense in depth. The token already requires the customer to know the rest of the cart shape, but a stale bearer in localStorage is unnecessary attack surface.
- [ ] **Fix steps.**
  1. After successful order placement, also `setQrToken(null)` (or include it in the `clearCustomerInfo` from S1 — recommend two separate methods so the intent stays explicit).
  2. **Caveat.** The customer may want to place a second delivery order from the same restaurant. Today they'd need to re-scan the QR. That's acceptable — the QR is on the table tent / menu / poster; rescanning is the natural path.
  3. If the restaurant wants "rapid re-order" UX, the right shape is a *separate* per-tenant cached token with explicit expiry, not relying on the bearer sitting in localStorage forever.
  4. **Don't** clear `qrToken` mid-checkout — only after success.
- [ ] **Verification.**
  - Place delivery order → reload `/delivery` → "no token, go scan QR" UX.
- [ ] **Done when.** Token clears on success, mid-flow preserved.

---

## S3. Delivery `access_token` survival beyond URL fragment

- [ ] **Where.**
  - Issued in [delivery-cart-screen.tsx:124-125](../apps/customer-web/src/components/cart/delivery-cart-screen.tsx#L124-L125)
  - Read in [delivery-order-status.tsx:24-44](../apps/customer-web/src/components/order/delivery-order-status.tsx#L24-L44)
- [ ] **What.** The `access_token` for an active delivery order lives only in the URL fragment (`#token=…`). If the customer clears the URL bar, taps a back link, or shares the page via "copy link" (some platforms strip the fragment), the token is lost and they cannot retrieve their order.
- [ ] **Why it matters.** Failure scenario #7. The customer can't see whether the driver's on the way; calls the restaurant.
- [ ] **Fix steps.**
  1. On the order success path (or on first read in `delivery-order-status.tsx`), persist `(orderId → access_token)` to sessionStorage *only* (NOT localStorage) — survives tab refresh but dies with the session.
     ```ts
     // Key: `delivery-order-token:${orderId}`
     sessionStorage.setItem(`delivery-order-token:${orderId}`, accessToken);
     ```
  2. In `readAccessTokenFromHash`, fall back to sessionStorage if hash is empty.
  3. **On `status === 'delivered'` or `status === 'cancelled'`**, clear the sessionStorage entry to avoid stale data.
  4. *Why sessionStorage and not localStorage:* the access_token is a bearer; cross-tab persistence isn't needed (the tab that placed the order is the tab tracking it), and dying-with-session limits residue on shared devices.
- [ ] **Verification.**
  - Place delivery order → confirmation URL is `/delivery/order/abc#token=…` → clear hash from URL bar manually → page reads token from sessionStorage and continues to render order.
  - Close tab → reopen `/delivery/order/abc` (no fragment) → "missing access token" screen (correct behavior since sessionStorage is gone).
- [ ] **Verification (TTL).**
  - Mark order as `delivered` from staff side → reload order page → sessionStorage entry is gone, page shows the final state via fragment fallback if still in URL, else "missing token."
- [ ] **Done when.** sessionStorage fallback works, terminal-status cleanup wired.

---

## S4. `setTenantContext` stale-bind audit on cross-route navigation

- [ ] **Where.**
  - Set: [apps/customer-web/src/app/table/[tableId]/layout.tsx:40-42](../apps/customer-web/src/app/table/[tableId]/layout.tsx#L40-L42)
  - Cleared: [apps/customer-web/src/app/table/[tableId]/layout.tsx:43-49](../apps/customer-web/src/app/table/[tableId]/layout.tsx#L43-L49) (unmount)
  - Also set: [apps/customer-web/src/hooks/use-delivery-context.ts:46-50](../apps/customer-web/src/hooks/use-delivery-context.ts#L46-L50)
  - Source: [apps/customer-web/src/lib/supabase.ts:87-114](../apps/customer-web/src/lib/supabase.ts#L87-L114)
- [ ] **What.** The wrapper's tenant binding is a singleton. Navigating from `/table/T01/menu` → `/delivery` runs the table layout's unmount cleanup that sets tenant to null; but React's effect-cleanup order is not synchronous with the new route's mount. There may be a brief window where the new route's queries fire against a stale or null tenant.
- [ ] **Why it matters.** In a single-tenant deployment, this is invisible. In a multi-tenant deployment, a stale binding could leak the wrong tenant's data into the next page.
- [ ] **Fix steps.**
  1. **Audit.** Add a debug log (or a Sentry breadcrumb) on every `db.setTenantContext(...)` call: which route, which tenant, the prior value. Run a manual nav test cross-tenant to identify any actual race.
  2. **Mitigation.** Make `db.setTenantContext(null)` the default state on entering any *non-tenant-bound* route (e.g. the `/` root, `/delivery` landing). Add a top-level layout effect that sets to null on mount and lets the inner layouts bind once they have a real tenant.
  3. **Stronger mitigation.** Bind tenant *into the React Query queryKey* (already on the Phase 1 C6 to-do for `useCafeSettings`). When the wrapper rebinds, cached queries for the old tenant are *not* refetched but new queries naturally key under the new tenant. This is the cleanest design — Phase 1 C6 already steps in that direction.
  4. **Don't** delete the unmount cleanup. It's still useful for the explicit-leave case.
- [ ] **Verification.**
  - Add the debug log, do a cross-tenant nav test, confirm no observable race in single-tenant deploys.
  - For multi-tenant deploys, e2e test the nav and assert the new tenant's content renders.
- [ ] **Done when.** Audit complete, mitigation chosen and shipped, no observable stale-bind in test.

---

## S5. `apiFetch` throws bare `Error` instead of `AppError` — error sentinels never get localized

- [ ] **Where.** [apps/customer-web/src/lib/api-routes.ts:31-52](../apps/customer-web/src/lib/api-routes.ts#L31-L52)
- [ ] **What.** On non-2xx responses, `apiFetch` does `throw new Error(body.error || 'API error ${res.status}')`. The mutation cache's `onError` handler in [providers.tsx:52-63](../apps/customer-web/src/components/providers.tsx#L52-L63) checks `isAppError(error)` and only localizes if true. So every customer-mutation failure shows the server's raw sentinel (e.g. `rate_limited`) directly in the toast.
- [ ] **Why it matters.** This is a security/integrity item: the i18n contract for sentinel codes ([CLAUDE.md i18n rule](../CLAUDE.md)) says server returns snake_case codes and clients map them via `httpStatusToAppError` → `localizeErrorMessage`. customer-web breaks that contract.
- [ ] **Fix steps.**
  1. Import `httpStatusToAppError` from `@gustri/api-client`.
  2. In `apiFetch`, replace:
     ```ts
     if (!res.ok) {
       throw new Error(body.error || `API error ${res.status}`);
     }
     ```
     with:
     ```ts
     if (!res.ok) {
       throw httpStatusToAppError(res.status, body);
     }
     ```
  3. The mutation cache's `isAppError(error)` check now succeeds → `localizeErrorMessage(error.message, fallback)` runs → user sees the localized sentinel.
  4. **Verify the customer-side sentinel mapping is complete.** Walk every `/api/v1/customer/*` route's error responses and confirm each sentinel is in [packages/i18n/src/error-keys.ts](../packages/i18n/src/error-keys.ts) `SENTINEL_ERROR_CODES` and translated in all 20 `errors.json`. Specifically:
     - `rate_limited`, `qr_token_invalid`, `qr_token_expired`, `qr_token_revoked`, `plan_required`, `order_cancel_too_late` (Phase 2 H3), `minimum_order_not_met`, `invalid_phone`, `invalid_address`.
  5. Also map the client-side `RateLimitError` thrown by `checkClientRateLimit` to localize via the same path.
- [ ] **Verification.**
  - Trigger a rate-limit (rapid waiter calls) → toast shows the localized "Please slow down" message in current locale, NOT `rate_limited`.
  - Trigger an expired QR token → toast shows localized "Your QR code has expired."
- [ ] **Done when.** Mapping in place, all sentinels translated, manual repro confirms localization.

---

## Phase 4 exit gate

PII clears on success, qrToken clears on success, delivery access-token survives reasonable URL clearing, tenant binding behavior audited & documented, error sentinels localize. Manual checklist on a real device:

- Place delivery order → reload `/delivery` → form empty + no token.
- Place delivery order → close tab → reopen full URL (with fragment) → tracking works.
- Place delivery order → close tab → reopen URL without fragment → expected "no token" UI (correct).
- Force a 429 → toast in current locale, not `rate_limited` literal.

Once Phase 4 ships, hand off to [26-CW-PROD-PHASE-5-MOBILE-A11Y.md](26-CW-PROD-PHASE-5-MOBILE-A11Y.md).
