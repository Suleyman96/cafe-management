# customer-web Phase 1 — Critical Release Blockers

Index: [21-CW-PROD-AUDIT-OVERVIEW.md](21-CW-PROD-AUDIT-OVERVIEW.md)

Six items. All must ship before the next customer-facing release. None require
a DB migration — these are app-layer correctness and i18n fixes.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` shipped · `[-]` won't fix

---

## C1. Dine-in checkout has no stable idempotency key across user-driven retries

- [ ] **Where.**
  - [apps/customer-web/src/hooks/use-place-order.ts:38-87](../apps/customer-web/src/hooks/use-place-order.ts#L38-L87)
  - [apps/customer-web/src/hooks/use-order.ts:130-167](../apps/customer-web/src/hooks/use-order.ts#L130-L167) (`useCreateOrder.onMutate`)
  - [apps/customer-web/src/hooks/use-order.ts:217-250](../apps/customer-web/src/hooks/use-order.ts#L217-L250) (`useAddOrderItems.onMutate`)
  - [apps/customer-web/src/components/cart/cart-screen.tsx](../apps/customer-web/src/components/cart/cart-screen.tsx) (call site)
  - [apps/customer-web/src/components/menu/menu-cart-sidebar.tsx](../apps/customer-web/src/components/menu/menu-cart-sidebar.tsx) (second call site)
- [ ] **What.** `onMutate` stamps `client_request_id` via `getOrCreateClientRequestId(variables.client_request_id)`. React Query reuses `variables` only across *automatic* retries (which are disabled, `retry: 0`). When a user re-taps "Place Order" after a network error, a fresh `mutate(...)` call passes a fresh variables object, `onMutate` mints a new UUID, and the server-side `(tenant_id, client_request_id)` unique index dedupes nothing.
- [ ] **Why it matters.** Flaky wifi + impatient retap = two kitchen tickets for the same cart. The delivery cart already has the right pattern; dine-in does not. Failure scenario #1 in the overview.
- [ ] **Fix steps.**
  1. Mirror the delivery-cart approach used in [delivery-cart-screen.tsx:42-57, 96, 113, 117-118](../apps/customer-web/src/components/cart/delivery-cart-screen.tsx#L42-L57):
     ```ts
     // In usePlaceOrder (or in cart-screen / menu-cart-sidebar — wherever the
     // submit lives), at the top of the component:
     const orderIdempotencyKey = useStableClientRequestId(); // from @gustri/queries
     const itemIdempotencyKeysRef = useRef<Map<string, string>>(new Map());
     const getItemIdempotencyKey = useCallback((menuItemId: string) => {
       let key = itemIdempotencyKeysRef.current.get(menuItemId);
       if (!key) {
         key = randomUUIDv4();
         itemIdempotencyKeysRef.current.set(menuItemId, key);
       }
       return key;
     }, []);
     ```
  2. Pass `client_request_id: orderIdempotencyKey.get()` when calling `createOrder.mutateAsync(...)` in `usePlaceOrder`, and `client_request_id: getItemIdempotencyKey(item.menuItem.id)` for each item passed to `addOrderItems.mutateAsync(...)`.
  3. On success, call `orderIdempotencyKey.reset()` and `itemIdempotencyKeysRef.current.clear()` before `clearCart()` / navigation.
  4. **Decide where the hook lives.** Two call sites today (`cart-screen.tsx` and `menu-cart-sidebar.tsx`) both invoke `usePlaceOrder`. Keep the idempotency state inside `usePlaceOrder` so both surfaces are covered by one fix.
  5. Drop the now-misleading comment on `useCreateOrder` ("React Query reuses the same variables object across retries, so the id stays stable") — that promise only holds for automatic retries.
- [ ] **Verification.**
  - Reproduce pre-fix: throttle network to "slow 3G", click Place Order, kill the request mid-flight (DevTools), click again → two orders in `staff-web` orders list.
  - Post-fix: same reproduction → second click 200s with the same `client_request_id`, server returns the prior order, single kitchen ticket.
  - Add an integration test in [apps/customer-web/src/__tests__](../apps/customer-web/src/__tests__/) (or wherever the hook-level tests live) that asserts the same `client_request_id` is sent on two consecutive `mutate` invocations until success.
- [ ] **Done when.** Both dine-in call sites use stable keys, integration test green, manual repro yields one order.

---

## C2. `useCreateWaiterCall` has the same idempotency gap

- [ ] **Where.**
  - [apps/customer-web/src/hooks/use-waiter-call.ts:31-33](../apps/customer-web/src/hooks/use-waiter-call.ts#L31-L33)
  - Call sites:
    - [apps/customer-web/src/app/table/[tableId]/layout.tsx:51-66](../apps/customer-web/src/app/table/[tableId]/layout.tsx#L51-L66) (FAB)
    - [apps/customer-web/src/components/order/order-status.tsx:66-80](../apps/customer-web/src/components/order/order-status.tsx#L66-L80) (Call Staff button)
- [ ] **What.** `onMutate` stamps `vars.client_request_id` per `mutate` invocation. Re-clicking the FAB after a 429 / network blip mints a new UUID; the partial-unique index does not dedupe.
- [ ] **Why it matters.** Failure scenario #2. Staff sees two pending calls for one customer, marks the second as "ignored" suspicion, dispatches duplicates.
- [ ] **Fix steps.**
  1. Same pattern as C1. In each call site, hold a `useStableClientRequestId()` for the current "pending call cycle." Pass `client_request_id` explicitly to `mutateAsync(...)`. Reset on success.
  2. *Caveat:* the FAB is mounted in `table layout.tsx`, which wraps every route inside `/table/[tableId]/*`. The same stable key should persist across the user staying on any sub-route (menu, cart, order) until a successful call completes. A `useRef` at the layout level (not per-screen) is the right scope.
  3. The Call Staff button inside `order-status.tsx` should share the same key when mounted, but since both surfaces are mounted simultaneously, the simplest fix is a small Zustand slice (`useWaiterCallIdempotency`) that both surfaces read from — single key per session, reset on success.
- [ ] **Verification.**
  - Pre-fix: throttle network, tap FAB twice within a second → two `waiter_calls` rows in DB.
  - Post-fix: same → one row, second POST returns the same row.
- [ ] **Done when.** Both FAB surfaces share one stable key, manual repro yields one waiter call.

---

## C3. `useCancelOrderItem` bypasses the customer API surface

- [ ] **Where.**
  - [apps/customer-web/src/hooks/use-order.ts:191-202](../apps/customer-web/src/hooks/use-order.ts#L191-L202) (`useCancelOrderItem`)
  - Call site: [apps/customer-web/src/components/order/order-status.tsx:100-116](../apps/customer-web/src/components/order/order-status.tsx#L100-L116)
- [ ] **What.** Calls `db.orderItems.cancel(itemId, cancelQty)` through the Supabase wrapper directly. The order-level cancel was moved to `/api/v1/customer/orders/[id]/cancel` (note M6) so the Upstash limiter and `table_id`-match check apply. Per-item cancel was missed in that migration.
- [ ] **Why it matters.** A customer (or a forked client) can hammer per-item cancels without the route-level throttle and without the table-match check. RLS still scopes by tenant, but you lose the same defense-in-depth M6 added for the order-level path. Also: failure scenario #10 — the kitchen-display realtime path for item cancel may be driven off a different code path.
- [ ] **Fix steps.**
  1. **Server.** Add `apps/staff-web/src/app/api/v1/customer/orders/[id]/items/[itemId]/cancel/route.ts` mirroring the order-cancel route:
     - Resolve order; verify `request.body.table_id` matches `order.table_id` (or accept the qr_token for delivery items).
     - Verify the item belongs to that order.
     - Upstash rate-limit keyed by `(ip, tenant_id)`.
     - Use the same `httpStatusToAppError` mapping for failures so customer-web localizes them.
  2. **api-client.** Add `apiRoutes.customerOrders.cancelItem(orderId, itemId, body)` in [apps/customer-web/src/lib/api-routes.ts](../apps/customer-web/src/lib/api-routes.ts) alongside the existing `cancel`.
  3. **Hook.** Rewrite `useCancelOrderItem` in [use-order.ts:191-202](../apps/customer-web/src/hooks/use-order.ts#L191-L202) to take `{ orderId, itemId, cancelQty, tableId }` and call the new route. Same `retry: 0`, same idempotency-key story (server dedupes via `(tenant_id, client_request_id)` if added; otherwise rate limit is the cap).
  4. **Call site.** Update `order-status.tsx:100-116` to pass `orderId` and `tableId` through.
  5. **Wrapper.** Leave `db.orderItems.cancel` in place — staff-web still uses it. Do not delete the wrapper method.
- [ ] **Verification.**
  - Burst test: 10 item-cancel requests in 5s with the anon key directly to PostgREST → still works (RLS) but rate-limit on the new route caps the *front-door* path.
  - Existing single-item cancel UX is unchanged.
  - Kitchen-display realtime sees the cancel within ~500ms.
- [ ] **Done when.** Route added, hook routes through it, manual repro shows rate-limit headers on the front door.

---

## C4. `platform-footer.tsx` hardcodes "Powered by" — violates i18n rule

- [ ] **Where.** [apps/customer-web/src/components/ui/platform-footer.tsx:14](../apps/customer-web/src/components/ui/platform-footer.tsx#L14)
- [ ] **What.** `<p>Powered by <span>gustri</span></p>` — no `t()` call. Every customer in every locale sees English "Powered by".
- [ ] **Why it matters.** CLAUDE.md i18n rule: "Every user-visible string goes through `@gustri/i18n` keys. No hardcoded text in JSX." Also: `table-landing.tsx` already uses `t('tableLanding.poweredBy')` so the key exists.
- [ ] **Fix steps.**
  1. Replace the literal with `t('tableLanding.poweredBy')` (key already exists across all 20 locales). Confirm the key value reads correctly in context.
  2. Add `'use client'` is already present — no other change needed.
  3. *Don't* extract a new namespace for this — the existing `tableLanding.poweredBy` is the right reuse.
- [ ] **Verification.**
  - Switch to AR / RU / TR / KO in the language picker → footer reads in that locale.
  - Search the codebase for any other hardcoded "Powered by" — none expected, but verify.
- [ ] **Done when.** Footer renders the translated string in all 20 locales, no biome warnings.

---

## C5. `global-error.tsx` has `lang="ja"` with English-only content

- [ ] **Where.** [apps/customer-web/src/app/global-error.tsx](../apps/customer-web/src/app/global-error.tsx)
- [ ] **What.** `<html lang="ja">` but body strings ("Something went wrong", "A critical error occurred. Please reload the page.", "Try again") are English.
- [ ] **Why it matters.** Screen readers will attempt to pronounce English text using Japanese phonology. Misleading lang attribute also signals carelessness. The i18n provider is unavailable at the `global-error` boundary by design (it's the catch-all when the tree explodes), so `t()` isn't an option without extra work.
- [ ] **Fix steps.**
  1. **Quick fix.** Change `lang="ja"` → `lang="en"`. Add a comment explaining *why* the strings are English-only at this boundary (provider not available).
  2. **Better fix (optional, not blocking).** Bundle the three strings into a tiny JSON map (`{ en: {...}, ar: {...}, ... }`) inline in this file, read `navigator.language` defensively, and pick the closest match. Falls back to EN. This avoids a network fetch (the page is already broken; don't compound).
  3. The translated approach also lets you set `lang` from the matched locale.
- [ ] **Verification.**
  - Trigger a global error (e.g. throw at module top-level in `providers.tsx`) → page renders in EN with `lang="en"`.
  - If translated: switch system locale → page renders in matched locale.
- [ ] **Done when.** `lang` matches the rendered text; ideally both translated.

---

## C6. `useCafeSettings` query key is not tenant-scoped

- [ ] **Where.** [apps/customer-web/src/hooks/use-settings.ts:70](../apps/customer-web/src/hooks/use-settings.ts#L70)
- [ ] **What.** `queryKey: [QUERY_KEYS.CAFE_SETTINGS]` — no tenant id. In a multi-tenant customer-web deployment (one Vercel project serving multiple tenants), a single browser session that touches two tenants reuses the first tenant's settings cache for `STALE_TIMES.MEDIUM` after switching.
- [ ] **Why it matters.** Wrong restaurant name, wrong currency, wrong delivery fee shown for the second tenant until cache expires. Also a trust hit: customer thinks the app is broken.
- [ ] **Fix steps.**
  1. Read the currently-bound tenant id from the wrapper: `const tenantId = db.getTenantId()` (singleton). Key the query as `[QUERY_KEYS.CAFE_SETTINGS, tenantId]`.
  2. `enabled: !!tenantId` so we don't fetch settings before the tenant is bound (otherwise we cache `null` and reuse it).
  3. Audit other query hooks for the same gap — at minimum [use-menu.ts](../apps/customer-web/src/hooks/use-menu.ts) (re-exports from `@gustri/queries`; verify those are already tenant-keyed) and [use-table.ts](../apps/customer-web/src/hooks/use-table.ts) (table is keyed by `tableId` which is unique; lower risk).
  4. Update `DEFAULT_SETTINGS` placeholder usage — `placeholderData: DEFAULT_SETTINGS` should still work but the key change means cache hits are now per-tenant.
- [ ] **Verification.**
  - Two-tab test: tenant A in tab 1, tenant B in tab 2, swap rapidly between them. Each tab shows its own restaurant name and currency continuously.
  - In one tab: scan tenant A's QR, then navigate to tenant B's delivery link without reloading. Settings flips to B within one refetch.
  - Vitest unit test on `useCafeSettings` asserting the query key includes the wrapper's `tenantId`.
- [ ] **Done when.** Query key includes tenantId, manual two-tenant test passes, unit test green.

---

## Phase 1 exit gate

All six items shipped to `main`. Manual repro of failure scenarios #1, #2 confirmed no longer reproducible. Translation audit run (`pnpm i18n:check` or equivalent) shows no missing keys. No regressions on the existing customer e2e suite.

Once Phase 1 is shipped, hand off to [23-CW-PROD-PHASE-2-HIGH.md](23-CW-PROD-PHASE-2-HIGH.md).
