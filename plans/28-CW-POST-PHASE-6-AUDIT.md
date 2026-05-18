# customer-web Post-Phase-6 Production Audit

This is a fresh deep-audit of customer-web after Phases 1–6 of the prior
audit ([21-CW-PROD-AUDIT-OVERVIEW.md](21-CW-PROD-AUDIT-OVERVIEW.md))
have all shipped. The earlier rounds closed: duplicate orders, route
bypass, multi-tenant cache leak, stale realtime, currency flicker,
mobile parity gaps, bundle guardrail. What follows is what a real
Saturday-night rush would still expose.

Findings are graded by *blast radius*, not difficulty. Sections are
ordered by gating: Critical (release blocker) → Major UX → High-risk
operational → Medium → Mobile → Realtime → Security → Performance →
i18n/a11y → Conversion.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` shipped · `[-]` won't fix

---

## How to use this file

Same shape as the earlier phase plans. Each item has *Where / What /
Why / Fix steps / Verification / Done when*, with a leading `[ ]`
checkbox. Tick when shipped to `main` and write the PR number next to
the box. `[DB]` tag = needs a migration + regenerated types in the same
PR.

If you want to turn this into a Phase 7 / Phase 8 split, the natural
cut points are:

- **Phase 7 (gating a public release)** — CR1, CR2, CR3, H1, S5
- **Phase 8 (high-leverage follow-up)** — H2, H3, H4, H5, H6, M3, M5, S4 [DB]
- **Phase 9 (polish + conversion ceiling)** — M1, M2, M4, Y1–Y5, MO1–MO4, CV1–CV3

---

## CR1. `qrToken` is a tenant-bearer secret persisted to localStorage with no TTL or scope

- [x] **Where.**
  - [apps/customer-web/src/store/delivery-store.ts:13,29-69,71-74](../apps/customer-web/src/store/delivery-store.ts#L13-L74)
  - [apps/customer-web/src/store/delivery-store.ts:78-93](../apps/customer-web/src/store/delivery-store.ts#L78-L93) (cross-tab sync)
  - [apps/customer-web/src/hooks/use-delivery-context.ts](../apps/customer-web/src/hooks/use-delivery-context.ts) (consumer)
  - [apps/customer-web/src/components/cart/delivery-cart-screen.tsx:169](../apps/customer-web/src/components/cart/delivery-cart-screen.tsx#L169) (clear path)
- [x] **What.** `useDeliveryStore` writes `qrToken` into `localStorage` under the bare `'delivery-storage'` key via `zustand/persist`. The token is **tenant-binding bearer credential** — the server derives `tenant_id` from it (see `useDeliveryContext`). It is only cleared via `clearQrToken()` which fires only after a *successful* order submit. Tab close, crash, "browse menu then leave" — all leave the bearer in localStorage indefinitely.
- [x] **Why it matters.** Customer scans a delivery QR on a friend's phone and hands it back. Friend's localStorage now holds a valid bearer for tenant A; they can navigate to `/delivery/menu` later and place a delivery against that token without ever scanning. Cross-tab `storage` listener auto-syncs the bearer to any same-origin tab. XSS on the customer-web origin also reads the value cleanly.
- [x] **Fix steps.**
  1. Move `qrToken` (and only `qrToken`; the form PII fields are a separate concern — see CR2) to `sessionStorage` so it dies with the tab. Mirrors the `delivery-order-token:` pattern already used in [delivery-order-status.tsx:39-57](../apps/customer-web/src/components/order/delivery-order-status.tsx#L39-L57).
  2. Easier alternative: keep `qrToken` in memory only (drop the `persist` middleware for that field; persist only `lastOrderId` if anything). The token is in the URL when the customer scans; on tab reopen they'll naturally re-scan.
  3. Validate the parsed shape (Zod schema) in the cross-tab `handleDeliveryStorageSync` handler before piping into the store. Or remove the cross-tab sync entirely — confirm with the team that no UX depends on it.
  4. Update `cart-store.ts` partition logic: if the partition is `{ flow: 'delivery', tenantId }` and the `qrToken` source has been wiped, the cart should be flushed too to avoid orphan items keyed against a tenant the customer no longer has access to.
- [x] **Verification.**
  - Scan delivery QR for tenant A → close tab → reopen `/delivery/menu` in same browser → page should require re-scan (no auto-resolved tenant).
  - Cross-tab test: scan QR in Tab 1 → open Tab 2 to `/delivery` → Tab 2 should NOT see the bearer (sessionStorage is per-tab).
- [x] **Done when.** `qrToken` never reaches localStorage; cross-tab leak path closed. ✓ `delivery-store.ts` reads/writes `qrToken` via `sessionStorage`; `partialize` restricts `persist` to `{ lastOrderId }`. Cross-tab listener was removed entirely (obviates S2).

---

## CR2. Delivery PII (`customerName`, `customerPhone`, `deliveryAddress`) persists across abandoned sessions on shared devices

- [x] **Where.**
  - [apps/customer-web/src/store/delivery-store.ts:29-70](../apps/customer-web/src/store/delivery-store.ts#L29-L70)
  - [apps/customer-web/src/components/cart/delivery-cart-screen.tsx:168](../apps/customer-web/src/components/cart/delivery-cart-screen.tsx#L168) (only call site for clear)
  - [apps/customer-web/src/app/delivery/page.tsx:29-61](../apps/customer-web/src/app/delivery/page.tsx#L29-L61) (form rehydrate)
- [x] **What.** Phase 4 S1 wipes PII on **successful** order via `clearCustomerInfo()`. There is no analogous wipe on abandoned flows: tab-close before submit, browser crash, customer browses then leaves, browser memory pressure killing the tab. The next user on a shared device (kiosk, family iPad, restaurant counter tablet) sees the prior customer's name, phone, and home address pre-filled.
- [x] **Why it matters.** Privacy / GDPR. The S1 fix closed the success path; this is the abandoned-path leak. Just as bad UX-wise — and arguably worse compliance-wise, because abandoned-cart PII is harder to attest "the customer accepted the data flow."
- [x] **Fix steps.**
  1. Add a write-time timestamp: when `setCustomerInfo` fires, also set `lastEditedAt: Date.now()`. Persist it.
  2. On `/delivery` mount, check: if `lastOrderId == null` AND `Date.now() - lastEditedAt > STALE_PII_MS` (suggest 30 min), call `clearCustomerInfo()` before reading the store into local form state.
  3. Alternative (simpler, stricter): drop persistence for the PII fields entirely — only persist `lastOrderId`. Customers re-enter on a fresh visit. Trade-off: convenience for repeat delivery customers vs. shared-device safety. Recommend the strict version unless analytics show high repeat-delivery rate from same device.
  4. Update [delivery-store.ts](../apps/customer-web/src/store/delivery-store.ts) `persist` config with a `partialize` to whitelist what gets persisted: probably only `lastOrderId` (and *not* `qrToken` per CR1).
- [x] **Verification.**
  - Open `/delivery?token=X`, fill name/phone/address, close tab without submitting → reopen `/delivery?token=X` → form should be empty.
  - Submit a successful order → next visit within 30 min should still be empty (the post-success wipe already handles this).
- [x] **Done when.** Form does not auto-fill from a prior abandoned session. ✓ Took the strict option from step 3 — PII fields are in-memory only, `partialize` persists only `{ lastOrderId }`. Stronger than the stale-wipe approach: abandoned PII never reaches disk, not just wiped after 30 min.

---

## CR3. Order-confirmation overlay is lost on refresh during the confirmation window

- [x] **Where.**
  - [apps/customer-web/src/store/order-confirmation-store.ts:44-48](../apps/customer-web/src/store/order-confirmation-store.ts#L44-L48)
  - [apps/customer-web/src/components/order/order-confirmation-overlay.tsx:21,33-40](../apps/customer-web/src/components/order/order-confirmation-overlay.tsx#L21-L40)
  - [apps/customer-web/src/hooks/use-place-order.ts:127](../apps/customer-web/src/hooks/use-place-order.ts#L127) (cart-clear sequencing)
- [x] **What.** The Phase 3 M1 overlay (`useOrderConfirmationStore`) is an in-memory Zustand singleton with **no persistence**. A page refresh, navigation, or iOS-memory-pressure tab-kill during the 8-second auto-dismiss window destroys the overlay state. The cart was already `clearCart()`-ed in `handlePlaceOrder` *before* the overlay renders (see use-place-order.ts:127 — `clearCart()` runs synchronously after `showConfirmation`). Result: customer lands on an empty cart with no order number visible, may resubmit thinking nothing happened.
- [x] **Why it matters.** Defeats the purpose of M1. The whole reason the overlay exists is to give the customer something durable to see during the post-submit gap; if it dies on a refresh, the customer is back in the pre-M1 "did it work?" anxiety state. Real failure mode on flaky 3G where the customer's browser may itself reload the tab mid-overlay.
- [x] **Fix steps.**
  1. Persist `pending` to `sessionStorage` in [order-confirmation-store.ts](../apps/customer-web/src/store/order-confirmation-store.ts). Use zustand's `persist` middleware with `createJSONStorage(() => sessionStorage)`. Key: `'order-confirmation'`.
  2. On hydration, if `pending` exists, the overlay renders immediately on next page load.
  3. Clear sessionStorage in `dismiss()` and at the destination of `trackHref` (the order-status page can fire a `dismiss()` on mount once it confirms it's showing the right order).
  4. Optional: bump the auto-dismiss from 8 s to 15 s (see Y5 below).
- [x] **Verification.**
  - Place a delivery order → mid-overlay, force a reload of the tab → overlay should re-render with the same order number, items, total, and Track Order button.
  - Tap Track Order → land on tracking page → refresh → overlay must NOT re-render (already dismissed).
- [x] **Done when.** Overlay survives a refresh until dismissed or trackHref-navigated. ✓ `order-confirmation-store.ts` uses `persist` + `createJSONStorage(() => sessionStorage)`. Tracking page calls `dismiss()` on mount (`delivery-order-status.tsx:53-57`). Pairs with Y5 (auto-dismiss bumped to 15 s).

---

## H1. No polling fallback when realtime is dead persistently

- [x] **Where.**
  - [apps/customer-web/src/hooks/use-order.ts:36,186-225](../apps/customer-web/src/hooks/use-order.ts)
  - [apps/customer-web/src/hooks/use-delivery.ts:32-156](../apps/customer-web/src/hooks/use-delivery.ts)
  - [apps/customer-web/src/components/ui/reconnecting-banner.tsx](../apps/customer-web/src/components/ui/reconnecting-banner.tsx)
- [x] **What.** When `rtStatus` flips to `TIMED_OUT`/`CHANNEL_ERROR` and stays there (Supabase realtime outage, corporate firewall blocking WSS, ISP throttle), the customer sees a persistent "Reconnecting…" banner. There is no automatic fallback to polling. The customer can tap "Refresh" manually but most won't. A 20-minute realtime outage = 20 minutes of every customer in the restaurant seeing stale order status.
- [x] **Why it matters.** Realtime is a single point of failure for the order-tracking UX. Phase 2 H1 added a banner; this closes the actual reliability gap.
- [x] **Fix steps.**
  1. In `useOrder` and `useDeliveryOrder`, add an effect that watches `rtStatus`. When it has been non-`SUBSCRIBED` for >60 s, start a `setInterval(query.refetch, 30_000)`. Clear the interval as soon as `rtStatus === 'SUBSCRIBED'`.
  2. Reuse the existing `dataUpdatedAt` / `refresh` plumbing — the polling fallback should just call the same `refresh` that the banner's CTA already calls.
  3. Optional: surface a slightly different banner copy when polling is active ("Reconnecting · refreshing every 30 s") to reassure the customer that they're not stuck.
- [x] **Verification.**
  - Open order-status, mid-session block the WSS websocket via DevTools network conditions → after 60 s the polling kicks in → kitchen advances order status → customer screen reflects within 30 s without manual tap.
  - When WSS recovers → polling stops automatically.
- [x] **Done when.** Realtime outage doesn't leave the customer screen frozen. ✓ `use-order.ts:267-288` and `use-delivery.ts:188-206` — `setTimeout(60_000)` gate then `setInterval(30_000)` calling the same `refresh` as the banner CTA; both torn down when `rtStatus === 'SUBSCRIBED'`.

---

## H2. `useOrderEta` doesn't ratchet — countdown can jump backward on clock skew

- [x] **Where.** [apps/customer-web/src/hooks/use-order-eta.ts:42-91](../apps/customer-web/src/hooks/use-order-eta.ts#L42-L91)
- [x] **What.** `elapsedMs = now - new Date(createdAt).getTime()` with `Math.max(0, longestPrep - elapsedMin)`. Two failure modes:
  - Phone clock is wrong (iOS just woke from a long sleep and `Date.now()` lags before NTP sync). `elapsedMin` can be negative; `minutesRemaining` jumps **up**.
  - The `created_at` from the server changes downstream (e.g. staff reopens / re-times an order). The customer sees the countdown reset.
- [x] **Why it matters.** Trust hit. "12 min" → blink → "18 min." Customer assumes their order was deprioritized.
- [x] **Fix steps.**
  1. Add a `useRef` tracking the highest previously-observed `elapsedMin` (per orderId).
  2. Return `Math.max(0, longestPrep - Math.max(prevElapsed, elapsedMin))` so the countdown can only ratchet forward, never back.
  3. Reset the ref when `order.id` changes (new order).
  4. On phone wake (visibility-restore — already wired), force-refetch `created_at` from the server and let the ref ratchet update naturally.
- [x] **Verification.**
  - Advance device clock 2 h forward mid-`preparing` → countdown should not jump backward.
  - Advance device clock 1 h backward → countdown should not reset upward.
- [x] **Done when.** ETA is monotonic-forward across all clock-skew and refresh scenarios. ✓ `use-order-eta.ts:67-78,109-110` — `ratchetRef` keyed on `orderId` clamps `effectiveElapsedMin = max(rawElapsedMin, prev)`; reset when `order.id` changes.

---

## H3. Cart restore from localStorage doesn't validate that menu items still exist or are available

- [x] **Where.**
  - [apps/customer-web/src/store/cart-store.ts:95-114](../apps/customer-web/src/store/cart-store.ts#L95-L114) (`loadPartition`)
  - [apps/customer-web/src/store/cart-store.ts:202-220](../apps/customer-web/src/store/cart-store.ts#L202-L220) (`setPartition` consumer)
  - [apps/customer-web/src/hooks/use-menu.ts](../apps/customer-web/src/hooks/use-menu.ts) (live menu source)
- [x] **What.** Cart loads from localStorage by `menu_item_id`, restoring full `CartItem` records that include a snapshot of the menu item. No cross-check against current `useMenuItems` to drop items that have been deleted, disabled, or had their price changed. On submit, the server rejects the item (RLS or `is_available` check), customer sees a generic "Something went wrong."
- [x] **Why it matters.** A customer adds items at 19:00, locks their phone, returns at 20:15 (still in the 4 h TTL). Meanwhile staff disabled "Fish of the Day" (ran out). Cart restores the item; place-order rejects; customer doesn't know which item is the problem.
- [x] **Fix steps.**
  1. After `setPartition` loads items, cross-check each `menuItem.id` against the live `useMenuItems` data. Drop any item whose id is missing or whose `is_available` is false.
  2. Update price snapshot if it's diverged — or flag the item as "price changed" with a banner before submit.
  3. Surface a one-time toast: "1 item from your cart is no longer available and has been removed."
  4. Tricky bit: `useMenuItems` is async. Either gate the validation in a `useEffect` triggered when `menuItems` resolves, or do the cross-check at submit time inside `handlePlaceOrder` as a last-line defense.
- [x] **Verification.**
  - Add a menu item to cart. From staff-web, disable that menu item. Reload the customer page (within 4 h). Cart should auto-remove the item with a toast.
  - Place order with an outdated-price item → either price should auto-update or customer should see an explicit "price changed" prompt, not a server reject.
- [x] **Done when.** Stale-cart submits no longer surface as cryptic errors. ✓ New hook `use-cart-menu-sync.ts` cross-checks cart against `useMenuItems`, removes stale items, fires a localized toast (`cart.staleItemsRemoved_one/_other`). Mounted in `cart-screen.tsx:44`, `delivery-cart-screen.tsx:39`, `menu-screen.tsx:112`.

---

## H4. Cross-tab "Place Order" race produces per-tab idempotency keys

- [x] **Where.**
  - [apps/customer-web/src/hooks/use-place-order.ts:48-57](../apps/customer-web/src/hooks/use-place-order.ts#L48-L57)
  - [apps/customer-web/src/components/cart/delivery-cart-screen.tsx:58-67](../apps/customer-web/src/components/cart/delivery-cart-screen.tsx#L58-L67)
- [x] **What.** `useStableClientRequestId` and the per-item ref Map live in component state — per tab. Two tabs of the same `/table/T01/cart` produce two independent `client_request_id` values. If the customer taps Place Order in both (or two devices on the same table), the server-side `(tenant_id, client_request_id)` partial-unique index sees two distinct ids → two orders created.
- [x] **Why it matters.** Phase 1 C1 closed *single-tab* duplicate orders. Multi-tab is the residual class.
- [x] **Fix steps.** New hook `useCrossTabPlaceOrderKeys(partition)` persists the order + per-item idempotency keys to localStorage scoped by partition (`dine_in:${tableId}` / `delivery:${qrToken}`). Both same-origin tabs read the same id; on submit success, `markSubmitted()` overwrites the entry with `{ submittedAt }` so sibling tabs' `storage` event flips `submittedByOtherTab=true` and disables their Place Order button with a localized banner. Lock TTL is 5 minutes. Wired through `usePlaceOrder` (dine-in cart-screen + menu-cart-sidebar) and inline in `delivery-cart-screen`.
- [x] **Verification.**
  - Open `/table/T01/cart` in two tabs of the same browser. Add items. Tap Place Order in tab 1 → confirmation in tab 1, tab 2's submit button should disable / show "Already submitted."
  - Two devices on the same table → server-side dedup is still the ultimate guard; client UX should at least show a clear "another tab/device just submitted this order" rather than a generic error.
- [x] **Done when.** Two-tab submission yields exactly one order and no confusing error.

---

## H5. `useTable(tableId)` 404 silently degrades — staff renaming/deleting a table mid-meal breaks the customer screen

- [x] **Where.**
  - [apps/customer-web/src/hooks/use-table.ts](../apps/customer-web/src/hooks/use-table.ts)
  - [apps/customer-web/src/components/order/order-status.tsx:45-46](../apps/customer-web/src/components/order/order-status.tsx#L45)
  - [apps/customer-web/src/components/cart/cart-screen.tsx](../apps/customer-web/src/components/cart/cart-screen.tsx) (similar)
- [x] **What.** `useTable` throws on 404. Consumers do `table?.id || ''`. Downstream `useOrder('')` is correctly disabled, but the customer screen renders an empty/stuck state with no explanation. The customer doesn't know whether the page is loading or broken.
- [x] **Why it matters.** Staff who reorganize tables mid-shift (rename T05 → T05B, merge two tables, delete an unused one) silently break every active customer screen at that table.
- [x] **Fix steps.** New `TableNotActiveScreen` renders an explicit "table no longer active" UI with a hard-refresh CTA. Mounted at the layout level (`app/table/[tableId]/layout.tsx`) so it gates every nested screen instead of letting the `LoadingSpinner` branch spin forever. Defensive checks also added in `OrderStatus` and `CartScreen` for the same `isAppError(err) && err.code === 'NOT_FOUND'` predicate. Reload CTA is the recovery path; a server-side waiter call would 404 the same way.
- [x] **Verification.**
  - Customer on `/table/T05/menu`. From staff-web, delete table T05. Customer's next render should show the explicit "table no longer active" UI, not a frozen loading state.
- [x] **Done when.** Table-deletion mid-session is graceful, not a black hole.

---

## H6. Waiter call has no persistent acknowledgment — customers spam-tap during noise

- [x] **Where.**
  - [apps/customer-web/src/components/waiter/call-staff-modal.tsx:64-69](../apps/customer-web/src/components/waiter/call-staff-modal.tsx#L64-L69) (1.5 s auto-close)
  - [apps/customer-web/src/store/waiter-call-store.ts:37-40](../apps/customer-web/src/store/waiter-call-store.ts#L37-L40) (`reset()` after success)
  - [apps/customer-web/src/hooks/use-waiter-call.ts:60](../apps/customer-web/src/hooks/use-waiter-call.ts#L60)
- [x] **What.** Modal shows "success" for 1.5 s then closes; no persistent badge, no banner, no ETA. The idempotency store `reset()`s on success — so the *next* tap (e.g. 30 s later when the waiter hasn't shown up) mints a fresh `client_request_id` and creates a second `waiter_calls` row. Customer thinks they're calling again "to be heard"; staff sees duplicate calls.
- [x] **Why it matters.** Phase 1 C2 closed *within-cycle* dedup. The cycle-resets-on-success behavior makes spam-after-success straightforward. Operationally chaotic during rush.
- [x] **Fix steps.** New `useOpenWaiterCallsForTable(tableId)` queries `waiter_calls` filtered by `(table_id, status='pending')` via the wrapper's existing `findByTable`. A `waiter_calls` realtime channel filtered by `table_id=eq.${tableId}` invalidates the query on every INSERT/UPDATE/DELETE so the FAB unlocks the moment staff flips `status → acknowledged`. The hook returns `{ hasOpenCall, openCall }`. Wired into: the layout FAB (icon swaps to `<Check />` + "Waiter notified" label and disables); the in-order `Call Staff` button (same swap); the `CallStaffModal` (opens directly into the success / already-notified state rather than letting the customer pick a fresh reason).
- [x] **Verification.**
  - Tap Call Staff → modal succeeds and closes → FAB shows persistent "Waiter notified" chip → tap again → no second row created (button is disabled).
  - From staff-web, acknowledge the call → FAB chip clears → next tap creates a new call.
- [x] **Done when.** Spam-tap during rush no longer fans out into duplicate `waiter_calls` rows; staff queue is clean.

---

## M1. Menu-item modal supports only quantity + free-text notes — no modifiers, no variants, no half/half

- [ ] **Where.** [apps/customer-web/src/components/menu/menu-item-modal.tsx:25-232](../apps/customer-web/src/components/menu/menu-item-modal.tsx)
- [ ] **What.** Real restaurant orders need: "size: S/M/L," "spice level: mild/medium/hot," "remove onions," "extra cheese (+₺5)," "choose 2 of 4 sides." Customer has none of these — only qty and free-text notes. Kitchen routinely misses note-based modifiers; staff falls back to walking over.
- [ ] **Why it matters.** This is the #1 conversion ceiling. A diner ordering "Adana Kebab with half spicy, half mild salsa" can't express it. They call a waiter. QR ordering loses its point.
- [ ] **Fix steps.** **Out of scope for a one-PR fix.** This is a spec'd feature:
  1. Schema design: `menu_item_options` table (id, menu_item_id, name, type: 'single'/'multi'/'required', min_select, max_select); `menu_item_option_values` (id, option_id, label, price_delta).
  2. UI design: option groups inside the modal with proper validation (required groups can't be skipped; max_select enforced).
  3. Order-items schema: store selected options as JSONB on `order_items.options` or a join table.
  4. Pricing: `item_price` + sum of selected `price_delta` per option value.
  5. i18n: option group labels need localization through the existing `*_translations` columns.
- [ ] **Verification.** Worth a separate phase plan; flagged here as a known gap.
- [ ] **Done when.** Spec is approved and scoped into a separate phase.

---

## M2. Adding an item closes the modal — multi-item ordering is 3+ extra taps per item

- [x] **Where.** [apps/customer-web/src/components/menu/menu-item-modal.tsx:47-53](../apps/customer-web/src/components/menu/menu-item-modal.tsx#L47-L53)
- [x] **What.** `handleAdd` does `addItem` → `onClose` → toast. To add a second item, customer taps back into the menu, finds another item, taps card, opens modal, etc. For a 4-item order: 4 modal-opens + 4 toast acknowledgments.
- [x] **Why it matters.** Standard food-delivery UX (Wolt, Uber Eats) keeps the customer in flow with an "Added · keep shopping / Go to cart (₺Total)" footer transition.
- [x] **Fix steps.** `handleAdd` no longer calls `onClose` — it bumps a new `addedCount` state and swaps the modal body for a confirmation strip: a Check chip ("Added N × Kebab"), an inline "+ Add another of this item" button that resets the strip back to the qty stepper, plus a two-button footer ("Browse menu" / "Cart · N items · ₺Total"). The cart route is passed down from `MenuScreen` via the new `cartHref` prop on `MenuItemCard` → `MenuItemModal` (`/table/${tableId}/cart` for dine-in, `/delivery/cart` for delivery). X-button / backdrop / Esc still close the modal cleanly; closing resets `addedCount`/`quantity`/`notes` so the next mount starts fresh. New i18n keys (`menuItem.addedTitle_one|_other`, `menuItem.keepShoppingHint`, `menuItem.addAnotherOfSame`, `menuItem.addAnother`, `menuItem.goToCart_one|_other`) shipped to all 20 locales.
- [x] **Verification.** Manual UX flow — adding 4 items goes from ~12 taps to ~7.
- [x] **Done when.** Multi-item flow doesn't require revisiting the cart between adds.

---

## M3. Minimum-order warning only shows in cart sidebar, after customer has invested in adding items

- [x] **Where.**
  - [apps/customer-web/src/components/menu/menu-cart-sidebar.tsx:194-204](../apps/customer-web/src/components/menu/menu-cart-sidebar.tsx#L194-L204)
  - Delivery counterpart: [apps/customer-web/src/components/cart/delivery-cart-screen.tsx](../apps/customer-web/src/components/cart/delivery-cart-screen.tsx)
- [x] **What.** Customer adds 3 items (₺35), scrolls down, finally sees "Minimum order ₺50." Feels like bait-and-switch.
- [x] **Why it matters.** Trust signal. Customers want to know the rules before they start ordering.
- [x] **Fix steps.** `MenuScreen` now renders a minimum-order chip directly below the search bar — visible before the customer adds anything. The chip reads `minimum_delivery_amount` when the screen mounted for delivery (`tableId === '__delivery__'`) and `minimum_order_amount` otherwise. The cart total it compares against uses the same `taxMultiplier` math as the cart summary so the displayed number matches what the customer eventually sees in the cart. Below-threshold variant uses a yellow "Min. {{min}} · You: {{current}}" copy; once `currentTotal >= minimumAmount`, the chip flips to a green Check + "Min. order met". When the setting is 0/null the chip doesn't render at all. New i18n keys `menu.minimumChipBelow` and `menu.minimumChipMet` shipped to all 20 locales.
- [x] **Verification.** Customer can see they're below minimum before adding the first item; the chip updates live as they add.
- [x] **Done when.** Threshold is visible from the menu, not only the cart.

---

## M4. Single-item cancel UX requires a quantity modal — hostile to a "cancel one of three" intent

- [x] **Where.** [apps/customer-web/src/components/order/order-status.tsx:64-69,180-198](../apps/customer-web/src/components/order/order-status.tsx)
- [x] **What.** Cancelling 1 of 3 burgers: navigate to /order → find item row → tap Cancel → modal opens → adjust quantity slider → confirm. Five interactions for a one-tap intent.
- [x] **Why it matters.** The common case is "cancel one." The slider modal serves the rare case "cancel 2 of 5."
- [x] **Fix steps.** Per-row X button now fires a dedicated `setCancelOneConfirm({ id, name })` and a slim "Are you sure?" dialog calls `cancelItem.mutateAsync({ ..., cancelQty: 1 })` on confirm. The dialog has its own focus trap (`cancelOneConfirmRef`), `role=dialog`, and aria-labelledby — same a11y shape as the existing modal. The slider modal is now only reachable from a new "Cancel partial" affordance, rendered as a text button next to the X **only when `item.quantity > 1`** (cancelling all of a quantity-1 row is the X button's job). The original modal logic / focus trap / cancel-loading state are untouched for the partial-cancel path. New i18n keys (`orderStatus.cancelOneAria`, `orderStatus.cancelPartialAria`, `orderStatus.cancelPartial`, `orderStatus.cancelOneTitle`, `orderStatus.cancelOneConfirm`) shipped to all 20 locales.
- [x] **Verification.** Cancelling 1 item from a 3-item order is now a 2-tap operation (tap ✕, confirm) instead of 5.
- [x] **Done when.** Common-case cancel is fast; rare-case partial-cancel still has the modal.

---

## M5. No "Adding to active order" indicator on cart/menu when an order is already in flight

- [x] **Where.**
  - [apps/customer-web/src/hooks/use-place-order.ts:75-104](../apps/customer-web/src/hooks/use-place-order.ts#L75-L104) (logic exists)
  - [apps/customer-web/src/components/cart/cart-screen.tsx](../apps/customer-web/src/components/cart/cart-screen.tsx) (no banner)
  - [apps/customer-web/src/components/menu/menu-screen.tsx](../apps/customer-web/src/components/menu/menu-screen.tsx) (no banner)
- [x] **What.** `usePlaceOrder` correctly appends to an existing order when one is active — but the cart and menu screens give no indication. Customer doesn't know whether they're starting a new order or appending. Phase 3 M7 added the indicator on `table-landing.tsx` but not deeper in the flow.
- [x] **Why it matters.** Conversion: customer who realized they forgot a drink needs to *trust* that they're adding to their existing order, not creating a duplicate.
- [x] **Fix steps.**
  1. When `useOrder(actualTableId).data` resolves to a non-null active order, banner the top of `CartScreen` and the menu screen with "Adding to order #A123 · est. ready in N min."
  2. Pull `est. ready` from `useOrderEta` (already wired in `OrderStatus`).
  3. Tap on the banner = navigate to `/table/${tableId}/order` to see the active order detail.
  4. Place Order button copy in this state: "Add to order #A123" instead of "Place Order."
- [x] **Verification.**
  - Place a dine-in order, navigate back to menu, add another item, open cart → banner should clearly say "Adding to order #A123."
- [x] **Done when.** Append-to-active is unambiguous on cart and menu, not just table-landing. ✓ Shared `ActiveOrderBanner` (`components/order/active-order-banner.tsx`) renders on `cart-screen.tsx:147-152` and `menu-screen.tsx:348-352` (via `MenuActiveOrderBanner`). Place-order button copy flips to `cart.addToOrder` when an active order exists (`menu-cart-sidebar.tsx:240-247`).

---

## Y1. `console.warn` in middleware leaks to production server logs

- [x] **Where.** [apps/customer-web/src/middleware.ts:49-51](../apps/customer-web/src/middleware.ts#L49-L51)
- [x] **What.** Fires on every request when `NEXT_PUBLIC_API_BASE_URL` is unset. Flood-logs without structure.
- [x] **Why it matters.** Build-guard in `next.config.js` prevents this in prod, so this only triggers on misconfigured dev/staging — but should still go through Sentry, not stdout.
- [x] **Fix steps.**
  1. Route through `Sentry.captureMessage('NEXT_PUBLIC_API_BASE_URL unset', { level: 'error', tags: { surface: 'middleware' } })`. Mirror the pattern in [api-routes.ts:23-26](../apps/customer-web/src/lib/api-routes.ts#L23-L26).
  2. Dedup the message at the cold-start level (e.g. module-level flag) so it fires once per process, not per request.
- [x] **Verification.** Unset the env var locally, hit several pages → exactly one Sentry event.
- [x] **Done when.** No `console.warn` in production middleware. ✓ `middleware.ts:8,57-63` — `Sentry.captureMessage(...)` gated by module-level `hasReportedMissingApiBaseUrl` so it fires once per cold-start. No `console.warn` in the file.

---

## Y2. Emojis used as semantic UI (waiter-call reasons, empty states, prep-time label)

- [x] **Where.**
  - [apps/customer-web/src/components/waiter/call-staff-modal.tsx:36-40](../apps/customer-web/src/components/waiter/call-staff-modal.tsx#L36-L40)
  - [apps/customer-web/src/components/menu/menu-screen.tsx:382-386](../apps/customer-web/src/components/menu/menu-screen.tsx)
  - [apps/customer-web/src/components/menu/menu-item-modal.tsx:152](../apps/customer-web/src/components/menu/menu-item-modal.tsx#L152)
  - [apps/customer-web/src/components/menu/menu-cart-sidebar.tsx:65](../apps/customer-web/src/components/menu/menu-cart-sidebar.tsx#L65)
- [x] **What.** `'💬'`, `'🧾'`, `'❓'`, `'⚠️'`, `'🚨'` for waiter reasons; `'🔍' / '🍽️'` for empty states; `'⏱️'` for prep time; `'🛒'` for empty cart. Screen readers announce raw Unicode names; font rendering varies wildly across Android; emoji is *not* internationalization-neutral.
- [x] **Why it matters.** A11y + polish. Lucide icons are already in the bundle.
- [x] **Fix steps.**
  1. Replace with `lucide-react` icons:
     - `💬` → `<MessageSquare />`, `🧾` → `<Receipt />`, `❓` → `<HelpCircle />`, `⚠️` → `<AlertTriangle />`, `🚨` → `<AlarmClock />` or `<Siren />`
     - `🔍` → `<Search />`, `🍽️` → `<UtensilsCrossed />` (already imported in table-landing)
     - `⏱️` → `<Clock />` (inline `mr-1`)
     - `🛒` → `<ShoppingCart />`
  2. Update i18n keys if the emoji is part of the translated string.
- [x] **Verification.** Screen-reader pass on the waiter-call modal — each reason should be announced by its label, not an emoji name.
- [x] **Done when.** No semantic emoji in the customer flows. ✓ All four spec'd surfaces now use Lucide: waiter reasons (`call-staff-modal.tsx:53-69`), menu empty states (`menu-screen.tsx:525-531`), prep-time clock (`menu-item-modal.tsx:224`), empty cart (`menu-cart-sidebar.tsx:66`). Residual non-spec emojis (`📝` in cart-item notes, `📋` category fallback) are decorative, not semantic.

---

## Y3. Allergen list overflows on long-locale languages

- [x] **Where.** [apps/customer-web/src/components/menu/menu-item-modal.tsx:143](../apps/customer-web/src/components/menu/menu-item-modal.tsx#L143)
- [x] **What.** `{item.allergens.join(', ')}` with `text-xs` and no width constraint. German/Russian/Turkish translations easily wrap to 3+ lines or overflow on a 320 px viewport.
- [x] **Why it matters.** Customers with allergies are exactly the customers who *must* read this. Truncation is a safety issue, not just polish.
- [x] **Fix steps.**
  1. Add `break-words` and `line-clamp-3` to the allergen `<p>`.
  2. If `> 3 allergens` collapses, show a "+N more" expander that toggles to full list.
  3. Consider an icon-per-allergen layout (chip strip) for higher density.
- [x] **Verification.** Set locale to DE, view an item with 6+ allergens on iPhone SE → all allergens reachable, no horizontal overflow.
- [x] **Done when.** Allergen text is always fully accessible on the smallest supported viewport. ✓ `menu-item-modal.tsx:202-215` — `flex flex-wrap`, `break-words`, `min-w-0 flex-1`. Skipped `line-clamp-3` deliberately: this is a safety surface, full wrap is preferred over a hidden tail.

---

## Y4. Cart-price-summary fixed footer missing `safe-area-inset-bottom` and `max-w` centering

- [x] **Where.** [apps/customer-web/src/components/cart/cart-price-summary.tsx:34](../apps/customer-web/src/components/cart/cart-price-summary.tsx#L34)
- [x] **What.** `fixed bottom-0 left-0 right-0 ...` without `pb-[env(safe-area-inset-bottom)]` and without `max-w-2xl mx-auto`. On iPhone with home indicator or in landscape, the Place Order button sits under the indicator.
- [x] **Why it matters.** Touch interception by iOS; button looks tappable but home-swipe fires instead.
- [x] **Fix steps.**
  1. Wrap inner content in a `max-w-2xl mx-auto`.
  2. Add `pb-[max(1rem,env(safe-area-inset-bottom))]` to the footer padding.
  3. Same audit for any other fixed-bottom UI: [reconnecting-banner.tsx](../apps/customer-web/src/components/ui/reconnecting-banner.tsx), confirmation overlay sticky elements.
- [x] **Verification.** iPhone 14 Pro Max in landscape, cart screen → Place Order button must be fully above the home indicator.
- [x] **Done when.** No iOS notch / indicator interception on any fixed-bottom UI. ✓ `cart-price-summary.tsx:43-47` — `paddingBottom: 'max(1rem, env(safe-area-inset-bottom))'` + inner `mx-auto max-w-2xl`.

---

## Y5. Confirmation overlay auto-dismiss at 8 s is too short on flaky networks

- [x] **Where.** [apps/customer-web/src/components/order/order-confirmation-overlay.tsx:21](../apps/customer-web/src/components/order/order-confirmation-overlay.tsx#L21)
- [x] **What.** Customer waits 5 s on 3G for confirmation to render, has 3 s to read the order number before auto-nav fires.
- [x] **Why it matters.** The whole point of M1 (overlay > toast) was "don't let the customer wonder." 8 s defeats it on a slow phone.
- [x] **Fix steps.**
  1. Bump `AUTO_DISMISS_MS` to 15_000.
  2. Alternative: drop auto-dismiss entirely; require explicit tap on "Track Order." Safer — but means the overlay sits there if the customer ignores it. Probably fine; the overlay is a positive signal.
  3. Pair with CR3 (persistence) — auto-dismiss + persistence means even if the customer walks away, the order number is in their session history.
- [x] **Verification.** Throttle network to slow 3G, place order → overlay must render fully and stay visible for at least 10 s.
- [x] **Done when.** Overlay reading time is comfortable on slow networks. ✓ `order-confirmation-overlay.tsx:26` — `AUTO_DISMISS_MS = 15_000`. CR3 sessionStorage persistence carries the order across the longer window.

---

## MO1. Free-text inputs lack `autoCorrect="off"` and `spellCheck={false}`

- [x] **Where.**
  - [apps/customer-web/src/app/delivery/page.tsx](../apps/customer-web/src/app/delivery/page.tsx) (address textarea)
  - [apps/customer-web/src/components/menu/menu-item-modal.tsx:202-211](../apps/customer-web/src/components/menu/menu-item-modal.tsx#L202-L211) (notes)
  - [apps/customer-web/src/components/cart/cart-screen.tsx](../apps/customer-web/src/components/cart/cart-screen.tsx) (order notes)
  - [apps/customer-web/src/components/cart/delivery-cart-screen.tsx](../apps/customer-web/src/components/cart/delivery-cart-screen.tsx) (order notes)
  - [apps/customer-web/src/components/waiter/call-staff-modal.tsx:149-156](../apps/customer-web/src/components/waiter/call-staff-modal.tsx#L149-L156) (additional notes)
- [x] **What.** iOS aggressively autocorrects street names, special characters, non-English words ("Aşxabad" → "Asxabad"). Customer's free-text notes and addresses get mangled before they hit submit.
- [x] **Why it matters.** Wrong address = wrong delivery. Notes that say "with onions" instead of "without onions" because of autocomplete = wrong food.
- [x] **Fix steps.** Add `autoCorrect="off" autoCapitalize="off" spellCheck={false}` on:
  - Address textarea (DON'T disable `autoCapitalize`; addresses do benefit from sentence case in some locales — pick `sentences` instead).
  - Order/item notes textareas: full `off` everywhere.
- [x] **Verification.** iOS Safari, type "12/A Aşxabad cəd." in address → no autocorrect mangling.
- [x] **Done when.** Customer-typed free text is preserved verbatim. ✓ Address textarea (`delivery/page.tsx:176-188`) keeps `autoCapitalize="sentences"` + adds `autoCorrect="off" spellCheck={false}`. All notes textareas (`menu-item-modal.tsx:279-282`, `cart-screen.tsx:183-191`, `delivery-cart-screen.tsx:277-285`, `menu-cart-sidebar.tsx:165-173`, `call-staff-modal.tsx:199-209`, `delivery/page.tsx:192-204`) use the full `off` triplet.

---

## MO2. Quantity-decrement disabled state is too subtle on dark glass

- [x] **Where.** [apps/customer-web/src/components/menu/menu-item-modal.tsx:170-172](../apps/customer-web/src/components/menu/menu-item-modal.tsx#L170-L172)
- [x] **What.** `disabled:opacity-30` on a dark glass button → looks like a normal inactive control. Customer taps repeatedly waiting for feedback.
- [x] **Fix steps.**
  1. `disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/[0.03]` and remove `active:scale-95` on disabled.
  2. Audit same pattern in `menu-cart-sidebar.tsx` qty controls.
- [x] **Verification.** Open modal with qty=1 → minus button reads clearly as inactive.
- [x] **Done when.** Disabled state is unambiguous on dark glass. ✓ `menu-item-modal.tsx:253-256` — `disabled:opacity-50 disabled:bg-white/[0.02] disabled:cursor-not-allowed disabled:active:scale-100 disabled:[&_svg]:text-white/30`. Layered (background drop + icon wash-out + cursor + no scale) so the inactive state reads from across the room. Menu-cart-sidebar qty controls have no disabled path (qty=0 removes the row), so no parallel change needed.

---

## MO3. Call-staff modal has no focus trap

- [x] **Where.** [apps/customer-web/src/components/waiter/call-staff-modal.tsx:76-200](../apps/customer-web/src/components/waiter/call-staff-modal.tsx)
- [x] **What.** Phase 5 added `useFocusTrap` to other modals (menu-item-modal, cancel-order, cancel-item). The call-staff modal — *high-stakes, urgent* — was missed.
- [x] **Fix steps.**
  1. Add `const modalRef = useRef<HTMLDivElement | null>(null);`
  2. `useFocusTrap(modalRef, { active: isOpen, onClose: handleClose });`
  3. Attach the ref to the modal container with `role="dialog" aria-modal="true" aria-labelledby={titleId}`.
- [x] **Verification.** Tab order is confined to the modal when open; Esc closes.
- [x] **Done when.** Modal has focus-trap parity with other Phase 5 modals. ✓ `call-staff-modal.tsx:55-64` — `useFocusTrap(dialogRef, { active: isOpen, onClose: handleClose })`. Container has `role="dialog" aria-modal="true" aria-labelledby={titleId}` and `tabIndex={-1}`; `<h2 id={titleId}>` carries the label. Esc routes through the same `handleClose` reset path as the X-button.

---

## MO4. RTL icon rotation is inconsistent across components

- [x] **Where.** Multiple files:
  - [apps/customer-web/src/components/menu/menu-screen.tsx:148](../apps/customer-web/src/components/menu/menu-screen.tsx#L148) (has `rtl:rotate-180`)
  - [apps/customer-web/src/components/cart/delivery-cart-screen.tsx:197](../apps/customer-web/src/components/cart/delivery-cart-screen.tsx#L197) (missing)
  - Spot-check all `<ArrowLeft />`, `<ArrowRight />`, `<ChevronRight />`, `<ChevronLeft />` instances
- [x] **What.** Some back arrows flip in RTL, others don't. Direction-symbolic icons (edit pencil, trash) shouldn't flip; directional ones must.
- [x] **Fix steps.**
  1. Grep all directional icons. Add `className="rtl:rotate-180"` to each.
  2. Add a Biome / ESLint custom rule (or a CI grep test) that catches `<ArrowLeft` and `<ArrowRight` without the `rtl:rotate-180` class. Mirror the realtime-filter-guard pattern.
- [x] **Verification.** Switch locale to `ar` / `fa`; every directional arrow points the correct way.
- [x] **Done when.** RTL audit is clean; CI guard catches future regressions. ✓ `delivery-cart-screen.tsx:212` now has `rtl:rotate-180`; same on `cart-screen.tsx:131`, `menu-screen.tsx:236`, `order-confirmation-overlay.tsx:123`, and `active-order-banner.tsx:56`. CI-guard rule remains as a follow-up.

---

## RT1. `order_items` realtime event can arrive before the local `orders` row exists

- [x] **Where.** [apps/customer-web/src/hooks/use-order.ts:108-167](../apps/customer-web/src/hooks/use-order.ts)
- [x] **What.** Customer's order create succeeds; local cache invalidates. Realtime channel opens for `order:${orderId}`. If the kitchen pre-adds a courtesy item (or staff bulk-adds) before the customer's order query refetch completes, the `order_items` echo fires and the debounced invalidate runs against an order the local cache doesn't yet have.
- [x] **Why it matters.** Edge case but real: optimistic UI clobber, stale read race. The Phase 6 P1 debounce makes this less likely (most echoes coalesce) but doesn't fix the root.
- [x] **Fix steps.**
  1. In the `scheduleInvalidate` body, guard with `if (!queryClient.getQueryData([QUERY_KEYS.ORDER, tableId])) return;` — wait for the order to land before processing item-level events.
  2. Alternative: skip the `order_items` subscription until `query.data?.id` matches the subscribed `orderId`. The current effect already keys on `orderId`; this is more of a state-machine cleanup.
- [x] **Verification.** Reproducing this race is hard manually; add a unit test that fires the `order_items` callback when `queryClient.getQueryData` returns `undefined` and assert no invalidate.
- [x] **Done when.** Realtime callbacks no-op when the local order is missing. ✓ `use-order.ts:120-135` and `use-delivery.ts:85-96` — `scheduleInvalidate` early-returns when `queryClient.getQueryData(...)` is undefined.

---

## RT2. Rapid visibility-restore can leak realtime channels

- [x] **Where.** [apps/customer-web/src/hooks/use-order.ts:209-227](../apps/customer-web/src/hooks/use-order.ts#L209-L227)
- [x] **What.** Each visibility-restore: synchronous `removeChannel` then bump `resubscribeNonce`. If three restores fire in <500 ms (iOS rapid app-switch), the cleanup timers stack, and the `channelRef.current?.orderId === orderId` early-return can skip a reopen that should have happened.
- [x] **Why it matters.** Realtime channel leak; on iOS App Switcher this is a real path.
- [x] **Fix steps.**
  1. Add a 250 ms leading-edge throttle on the visibility handler so three rapid restores collapse to one. A simple `lastResubscribeTsRef` check: `if (Date.now() - lastResubscribeTsRef.current < 250) return;`.
  2. Same fix in `useDeliveryOrder`.
- [x] **Verification.** Hard to repro manually; add unit test driving `visibilitychange` events at <100 ms intervals and assert single channel open at the end.
- [x] **Done when.** Channel count is stable across rapid visibility flips. ✓ `use-order.ts:84-93,236-239` and `use-delivery.ts:40-43,161-163` — `lastResubscribeTsRef` with 250 ms leading-edge gate in both hooks.

---

## RT3. Cross-tab same-customer adds produce visible duplicate-flash invalidations

- [x] **Where.** [apps/customer-web/src/lib/realtime-dedup.ts:34](../apps/customer-web/src/lib/realtime-dedup.ts#L34)
- [x] **What.** Dedup registry is per-tab in-memory. Two tabs of the same table: Tab A adds an item → records crid in A's map. Realtime echo fires in both tabs; B has no crid → invalidates → flicker.
- [x] **Why it matters.** Marginal. Most customers don't have two tabs of the same cart. Worth flagging as a known limitation.
- [x] **Fix steps.**
  - Option A: leave it. Document.
  - Option B: sync via `BroadcastChannel('realtime-dedup')` so a `recordRecent...` in one tab fires across all tabs of the same origin.
- [x] **Verification.** Open two tabs of same cart; add item in tab 1; verify tab 2 still flickers (current) or doesn't (with fix).
- [x] **Done when.** Decision documented either way. ✓ Took Option B — `realtime-dedup.ts:33-56,73-86,97-107` syncs via `BroadcastChannel('realtime-dedup')` with shape-validated `onmessage`. Sibling tabs now share the dedup registry.

---

## RT4. `useOrder.staleTime: 10s` is overkill given realtime + visibility-restore + reconnect

- [x] **Where.** [apps/customer-web/src/hooks/use-order.ts:31-38](../apps/customer-web/src/hooks/use-order.ts#L31-L38), [apps/customer-web/src/hooks/use-delivery.ts:26-31](../apps/customer-web/src/hooks/use-delivery.ts#L26-L31)
- [x] **What.** With Phase 6's debounced realtime + visibility-restore (Phase 2 H2) + `refetchOnReconnect: 'always'` (Phase 2 H2), a 10 s stale window causes frequent refetches on flaky networks.
- [x] **Why it matters.** Battery + bandwidth + server load. Not user-visible but adds up across 100 customers on a Saturday night.
- [x] **Fix steps.** Aligned both `useOrder` and `useDeliveryOrder` to `staleTime: 60_000` (the global default in `providers.tsx`). Realtime + visibility-restore + reconnect carries freshness; the staleTime now only fires when *all three* fail, which is the rare safety-net case it was designed for.
- [x] **Verification.** Refetch volume on a stable connection drops to the visibility / reconnect / realtime-callback triggers; the 30s-cadence refetches that the 10s window induced are gone.
- [x] **Done when.** No regression on freshness; refetch volume reduced.

---

## S1. (See CR1.) `qrToken` in localStorage is a tenant-bearer XSS surface

(Same issue as CR1. Listed in security section for completeness.)

---

## S2. Cross-tab `storage` listener in `delivery-store` lacks shape validation

- [x] **Where.** [apps/customer-web/src/store/delivery-store.ts:78-93](../apps/customer-web/src/store/delivery-store.ts#L78-L93)
- [x] **What.** Handler accepts any `e.newValue` and pipes it into the store after `JSON.parse`. Same-origin only, so a real attacker needs XSS first — but the listener is defensively naive.
- [x] **Fix steps.**
  1. Validate the parsed shape with a Zod schema before `setState`.
  2. Or remove the cross-tab sync entirely if no UX depends on it (confirm with team).
- [x] **Verification.** Set malformed `delivery-storage` JSON via DevTools → handler ignores without setting state.
- [x] **Done when.** Cross-tab listener is shape-safe. ✓ Took option 2 — listener removed entirely (CR1 moved `qrToken` to sessionStorage, killing the cross-tab UX premise). `cleanupDeliveryStoreSync` kept as a no-op to avoid breaking test imports. No listener means nothing to validate.

---

## S3. `sessionStorage` `delivery-order-token:` entries accumulate on long-running tabs

- [x] **Where.** [apps/customer-web/src/components/order/delivery-order-status.tsx:93-97](../apps/customer-web/src/components/order/delivery-order-status.tsx#L93-L97)
- [x] **What.** Cleared only on terminal status (`delivered`/`cancelled`). Stuck or never-completed orders leave bearers indefinitely (tab-lifetime).
- [x] **Why it matters.** Marginal — sessionStorage is per-tab — but a shared device with a long-running tab can accumulate stale bearers.
- [x] **Fix steps.**
  1. Encode a timestamp in the stored value: `JSON.stringify({ token, ts: Date.now() })`.
  2. On mount, iterate `sessionStorage`, drop any `delivery-order-token:*` entry older than 24 h.
- [x] **Verification.** Place a delivery, leave the tab open for 24 h (or fake the timestamp) → next mount clears it.
- [x] **Done when.** Bearers don't accumulate indefinitely. ✓ Sweep helper in `apps/customer-web/src/lib/delivery-order-token-storage.ts`; `delivery-order-status.tsx:60-65` calls `sweepStaleDeliveryOrderTokens()` on mount. Terminal-status clear path (lines 90-94) remains the primary cleanup.

---

## S4. Feedback form has no idempotency [DB]

- [x] **Where.**
  - [apps/customer-web/src/components/feedback/feedback-form.tsx:40-52](../apps/customer-web/src/components/feedback/feedback-form.tsx#L40-L52)
  - [apps/customer-web/src/lib/api-routes.ts:227-232](../apps/customer-web/src/lib/api-routes.ts#L227-L232)
  - Server route: `apps/staff-web/src/app/api/v1/customer/feedback/route.ts`
  - Schema: `supabase/migrations/*customer_feedback*.sql`
- [x] **What.** Comment in code acknowledges: "feedback table doesn't carry a `client_request_id` column today, so the API path can't dedupe server-side." Upstash limiter caps at 3/5min/IP, but within that window a customer can double-submit.
- [x] **Why it matters.** Operational integrity. Duplicate complaints in the staff queue look like two separate issues, get analyzed twice, double-ding the restaurant in metrics.
- [x] **Fix steps.**
  1. Migration: add `client_request_id uuid` column to `customer_feedback` + partial unique index `(tenant_id, client_request_id) WHERE client_request_id IS NOT NULL`. Pattern mirrors `orders` and `waiter_calls`.
  2. Update Zod schema in `@gustri/database/schemas/inputs/customer-feedback.ts` to accept `client_request_id`.
  3. Update server route to consume the id and let the unique index handle dedup.
  4. Update `apiRoutes.customerFeedback.create` to stamp via `getOrCreateClientRequestId`.
  5. Update `FeedbackForm` to use `useStableClientRequestId` from `@gustri/queries`.
  6. Regenerate types: `pnpm db:types:generate`.
- [x] **Verification.** Rapidly tap submit → server creates exactly one row.
- [x] **Done when.** Feedback dedup is at parity with orders/waiter-calls. ✓ Migration `supabase/migrations/20260517000001_feedback_idempotency.sql` adds `client_request_id` + partial unique index. `feedback-form.tsx:37,58,61` uses `useStableClientRequestId` and stamps the id on submit.

---

## S5. Verify Sentry SDK PII scrub config

- [x] **Where.**
  - [apps/customer-web/sentry.client.config.ts](../apps/customer-web/sentry.client.config.ts) (NOT in src/, lives at project root)
  - [apps/customer-web/sentry.server.config.ts](../apps/customer-web/sentry.server.config.ts)
  - [apps/customer-web/sentry.edge.config.ts](../apps/customer-web/sentry.edge.config.ts)
  - [apps/customer-web/src/lib/sentry-scrub.ts](../apps/customer-web/src/lib/sentry-scrub.ts)
- [x] **What.** Couldn't fully verify in the audit pass that Sentry has a `beforeSend` hook stripping delivery PII from request bodies. Mutation bodies for `/api/v1/customer/orders` (delivery type) contain `delivery_phone`, `delivery_address`, `delivery_customer_name`. If any of these reach Sentry uncrubbed, that's a third-party PII leak.
- [x] **Why it matters.** Compliance + customer trust.
- [x] **Fix steps.**
  1. Open `sentry.client.config.ts`, confirm `beforeSend` exists and denylists: `customer_phone`, `customer_name`, `delivery_address`, `delivery_phone`, `delivery_customer_name`, `qr_token`, `delivery_access_token`, `client_request_id` (low-risk but identifying).
  2. Audit `Sentry.captureException` / `Sentry.captureMessage` call sites for accidentally-included PII in `extra` / `tags` / `contexts`.
  3. Confirm Sentry SDK's default `RequestData` integration is configured to strip bodies, or override with a custom integration.
  4. Add a unit test (or Sentry-side rule) that captures a fake event with PII and asserts the redaction.
- [x] **Verification.** Trigger a synthetic order error with PII in the body → inspect Sentry event in the dashboard → confirm fields are `[Filtered]`.
- [x] **Done when.** PII never reaches Sentry in cleartext. ✓ `apps/customer-web/src/lib/sentry-scrub.ts` is the shared scrub helper; wired via `instrumentation-client.ts:47-58` (`beforeSend` + `beforeBreadcrumb`) and the server/edge configs. Note: client SDK now lives at `instrumentation-client.ts` (Sentry SDK v8+ rename) rather than `sentry.client.config.ts`. Unit test in `src/__tests__/lib/sentry-scrub.test.ts`.

---

## P1. `MenuScreen` re-localizes on every `useMenuItems` refetch even when data is shape-identical

- [x] **Where.** [apps/customer-web/src/components/menu/menu-screen.tsx:98-110](../apps/customer-web/src/components/menu/menu-screen.tsx#L98-L110)
- [x] **What.** React Query returns a new array reference on every refetch. The `localizedItems` `useMemo` depends on `[menuItems, language]`. Even when refetched data is identical, the memo busts.
- [x] **Why it matters.** Marginal; 200-item menus on cheap Android phones.
- [x] **Fix steps.** Verified the upstream contract holds: customer-web's `QueryClient` defaults to TanStack Query's structural sharing (no `select` plumbing needed). Locked it in explicitly with `structuralSharing: true` in [providers.tsx](../apps/customer-web/src/components/providers.tsx) so a future upstream-default change or an accidental override can't silently turn the localizedItems memo into a refetch-busts-everything path. Comment in the config calls out the menu-screen dependency so the next person reading it understands why the explicit-default is load-bearing.
- [x] **Verification.** Refetch under React DevTools profiler: `MenuScreen` renders, `localizedItems` `useMemo` returns the same reference; `filteredItems` and child `MenuItemCard`s avoid re-render via their existing memo chain.
- [x] **Done when.** Refetch-without-change is a no-op for render cost.

---

## P2. `useOrder.staleTime: 10s` (see RT4 above — same issue, different lens)

- [x] Closed alongside RT4 in [use-order.ts:32-38](../apps/customer-web/src/hooks/use-order.ts#L32-L38) and [use-delivery.ts:26-31](../apps/customer-web/src/hooks/use-delivery.ts#L26-L31). Both dine-in and delivery now run `staleTime: 60_000`, with the realtime + visibility-restore + `refetchOnReconnect: 'always'` stack still providing freshness when the staleTime safety net would normally trigger.

---

## P3. `OrderConfirmationOverlay` re-renders on every store mutation

- [-] **Where.** [apps/customer-web/src/components/order/order-confirmation-overlay.tsx:27-28](../apps/customer-web/src/components/order/order-confirmation-overlay.tsx#L27-L28)
- [-] **What.** `useOrderConfirmationStore((s) => s.pending)` — selector is fine, but `dismiss` is also subscribed (separate hook call), so any `dismiss()` re-renders.
- [-] **Why it matters.** Trivial. Skip unless profiler flags it.
- [-] **Decision.** Won't fix. Zustand selectors compare by `Object.is`, and `dismiss` is a stable function reference defined once at store creation — subscribing to it does *not* cause re-renders on `dismiss()`. The only re-render trigger is the `pending` slice itself, which is the correct surface to track. Profiler shows no spurious renders. Re-open only if a future store change makes `dismiss` non-stable.

---

## I1. Color contrast on white-on-glass text below WCAG AA

- [x] **Where.** Customer flows audited and bumped:
  - [menu-item-card.tsx](../apps/customer-web/src/components/menu/menu-item-card.tsx) — item description, prep-time chip
  - [menu-cart-sidebar.tsx](../apps/customer-web/src/components/menu/menu-cart-sidebar.tsx) — empty-state icon + sub-text, per-row price/notes, trash button, textarea placeholder, tax disclaimer
  - [menu-item-modal.tsx](../apps/customer-web/src/components/menu/menu-item-modal.tsx) — prep-time line + main description
  - [menu-screen.tsx](../apps/customer-web/src/components/menu/menu-screen.tsx) — search icon + placeholder, filter button, items-found indicator, empty-state icon
  - [order-confirmation-overlay.tsx](../apps/customer-web/src/components/order/order-confirmation-overlay.tsx) — uppercase summary labels
  - [table-landing.tsx](../apps/customer-web/src/components/table/table-landing.tsx) — table info, location chip, active-order metadata, "order at counter" hint, contact/address links, footer attribution
  - [app/error.tsx](../apps/customer-web/src/app/error.tsx) — error body copy
- [x] **What.** `white/30` on near-black ≈ 3.2:1, `white/40` ≈ 3.8:1, `white/50` ≈ 4.1:1 — all below the 4.5:1 AA threshold for body text.
- [x] **Fix steps.** Applied the audit's rule: body-sized labels (text-xs / text-sm / text-base) bumped to `text-white/55` (≈4.7:1) or `text-white/70` for primary content (menu-item modal description). `text-white/40` retained only for `text-[10px]` sub-secondary text that is not primary information (language-picker code label in table-landing). Hover targets bumped in tandem (`hover:text-white/60` → `hover:text-white/70`) so the rest state is the AA floor, not the hover state.
- [x] **Verification.** `pnpm grep "text-white/(20|30|40)"` returns a single non-flagged match (text-[10px] language code, allowed by rule).
- [x] **Done when.** AA-compliant on all customer screens.

---

## I2. Russian/Ukrainian/Arabic `_few`/`_many` plural rules fall back to `_other`

- [-] **Where.** All `t(..., { count })` call sites; specific concern at [use-order-eta.ts](../apps/customer-web/src/hooks/use-order-eta.ts) consumption surfaces (e.g. "5 минут" vs "1 минута").
- [-] **What.** Documented compromise in CLAUDE.md. Russian "1 минут" reads grammatically wrong.
- [-] **Decision — Option A (accept).** [CLAUDE.md](../CLAUDE.md) `### Plural-form support is _one / _other only` documents the compromise explicitly: i18next is configured without `keySeparator` and with EN-style plural rules; RU/UK/AR fall back to `_other` for non-1 counts. RU/UK/AR locale files were spot-checked and contain no `_few` / `_many` variants (would otherwise drift vs the EN source and break the alignment audit). Re-opening this issue requires (1) flipping i18next config to CLDR plural rules, (2) updating *all* 20 locales together, (3) re-baselining the alignment audit — multi-PR lift, no individual cell-fix shortcut.
- [-] **Verification.** Grep `_few|_many` across `packages/i18n/src/locales/` returns no matches; assertion still holds.
- [-] **Done when.** Decision documented either way. ✓ Documented as accepted compromise.

---

## CV1. No active-order chip visible on menu screen

- [x] **Where.** [apps/customer-web/src/components/menu/menu-screen.tsx](../apps/customer-web/src/components/menu/menu-screen.tsx)
- [x] **What.** Phase 3 M7 added the active-order banner on `table-landing.tsx`. The menu screen — where the customer spends most time — has no equivalent. A customer who placed an order then went back to add a drink has no breadcrumb back to their order status.
- [x] **Fix steps.**
  1. Subscribe to `useOrder(actualTableId)` in `MenuScreen` (already used downstream).
  2. When an active order exists, render a slim chip below the header: "Order #A123 · view status →" → links to `/table/${tableId}/order`.
  3. Pair with M5 (cart banner) — same data, two surfaces.
- [x] **Verification.** Place order, navigate to menu, see chip → tap → land on order status.
- [x] **Done when.** Active-order discoverability is consistent across landing/menu/cart. ✓ `MenuActiveOrderBanner` renders the shared `ActiveOrderBanner` below the header for dine-in (delivery flow has no per-table active order).

---

## CV2. Persistent cart icon shows count but not amount

- [x] **Where.** [apps/customer-web/src/components/menu/menu-screen.tsx:155-175](../apps/customer-web/src/components/menu/menu-screen.tsx#L155-L175)
- [x] **What.** The Phase 3 M3 cart icon shows the item count. It doesn't show the running total.
- [x] **Why it matters.** Trust signal. "3 · ₺87" tells the customer what they're about to commit to before they open the cart.
- [x] **Fix steps.**
  1. When `itemCount > 0`, expand the icon to a pill: `<ShoppingCart /> 3 · ₺87`.
  2. Format the price via `useFormatPrice` + `useTaxMultiplier` (already imported).
  3. Truncate gracefully on small viewports — hide the price when width < 360 px.
- [x] **Verification.** Add items, see running total in header; remove items, watch it update.
- [x] **Done when.** Running total is visible without opening the cart. ✓ Pill expands on `hasCartItems`; price is gated by `min-[360px]:inline` so narrow viewports still show the count badge. New aria key `menu.viewCartWithTotal` ships across all 20 locales.

---

## CV3. "Place Order" loses the price during `isPending` state

- [x] **Where.** [apps/customer-web/src/components/menu/menu-cart-sidebar.tsx:206-215](../apps/customer-web/src/components/menu/menu-cart-sidebar.tsx#L206-L215) — also fixed in [apps/customer-web/src/components/cart/cart-price-summary.tsx](../apps/customer-web/src/components/cart/cart-price-summary.tsx) (delivery/dine-in shared footer)
- [x] **What.** Button copy flips to "Placing order…" during the mutation; the price is dropped from the label.
- [x] **Why it matters.** Mid-tap anxiety. The customer wants confirmation of what they're paying for, not less.
- [x] **Fix steps.**
  1. Change copy to "Placing ₺87 order…" (interpolate the same price the idle state showed).
  2. New i18n key: `cart.placingOrderWithPrice` with `{{price}}` interpolation. 20-locale coverage required.
- [x] **Verification.** Throttle network, tap Place Order → spinner state still shows the price.
- [x] **Done when.** Price is never absent during the place-order flow. ✓ Both the menu-side sidebar and the shared `CartPriceSummary` (cart screen + delivery cart) now interpolate the formatted total into the pending-state label.

---

## Top 10 realistic customer failure scenarios

For each:
1. *Scenario*
2. *Trigger*
3. *Customer-visible symptoms*
4. *Restaurant/business impact*
5. *Prevention*

---

**1. Shared-device delivery QR token leak**
- Family iPad: customer A places delivery, leaves; customer B picks up iPad an hour later.
- Trigger: CR1 — `qrToken` persisted in localStorage with no TTL.
- Symptoms: B can place a delivery against tenant A's token without scanning.
- Impact: Multi-tenant boundary breach; deniable abuse vector.
- Prevention: CR1.

**2. Refresh-during-confirmation lost order number**
- 3G customer taps Place Order; phone reloads tab right after.
- Trigger: CR3.
- Symptoms: Empty cart, no order number, customer thinks it failed and re-taps.
- Impact: Second order possible if dedup-key reset; confusing error otherwise.
- Prevention: CR3.

**3. Stale cart submission failure after long browse**
- Customer adds items, locks phone 2 h, returns to submit. Item disabled in interim.
- Trigger: H3.
- Symptoms: Generic "something went wrong"; customer doesn't know which item.
- Impact: Lost conversion; app blame.
- Prevention: H3.

**4. Realtime outage = silent stale tracking**
- Saturday rush, 5-min Supabase realtime hiccup.
- Trigger: H1.
- Symptoms: Order frozen at "Preparing" while kitchen has already marked ready.
- Impact: Cold food, customer flags down waiter, staff confusion.
- Prevention: H1.

**5. ETA jumps backward → customer thinks order reset**
- Phone wakes from 30-min sleep with clock skew.
- Trigger: H2.
- Symptoms: "12 min" → "18 min." Customer assumes they were deprioritized.
- Impact: Trust loss.
- Prevention: H2.

**6. Waiter call spam during noise**
- Crowded bar; customer taps Call Staff; modal flashes and disappears.
- Trigger: H6.
- Symptoms: Customer re-taps 20 s later; two `waiter_calls` rows.
- Impact: Staff queue chaos; calls get stale and missed.
- Prevention: H6.

**7. Table renamed/deleted mid-meal**
- Staff reorganizes during a quiet moment; customer is on `/table/T05/order`.
- Trigger: H5.
- Symptoms: Infinite loading or empty cart.
- Impact: Customer flags down waiter; bad first impression.
- Prevention: H5.

**8. Cross-tab double Place Order**
- Customer has cart open in two tabs; submits in both.
- Trigger: H4.
- Symptoms: Two orders OR a confusing reject.
- Impact: Duplicate kitchen tickets.
- Prevention: H4.

**9. Long-language menu allergen overflow**
- DE locale on small Android, item with 6+ allergens.
- Trigger: Y3.
- Symptoms: Modal overflow, allergens partially hidden.
- Impact: Allergic customer can't see full list — safety issue.
- Prevention: Y3.

**10. Feedback double-submit duplicate complaint**
- Angry customer; accidental double-tap.
- Trigger: S4.
- Symptoms: Two identical complaints.
- Impact: Staff treats as two issues; metrics double-count.
- Prevention: S4 [DB].

---

## Prioritized recommendations table

| # | Item | Impact | Effort |
|---|---|---|---|
| 1 | CR1 — `qrToken` to sessionStorage / in-memory | Security: tenant-bearer leak | S |
| 2 | CR3 — persist confirmation overlay to sessionStorage | Conversion: refresh-loss recovery | S |
| 3 | CR2 — wipe delivery PII on `/delivery` mount when stale | Privacy: GDPR/shared-device | S |
| 4 | H1 — polling fallback when realtime dead >60 s | Reliability: realtime outages | S |
| 5 | H3 — validate cart items against menu on rehydrate | Reliability: stale-cart submit failure | S |
| 6 | H6 — persistent waiter-call acknowledgment chip | Operational: prevents spam | M |
| 7 | M3 — surface minimum-order on menu, not just cart | Conversion | S |
| 8 | M5 — "Adding to order #A123" banner in cart/menu | Conversion: clarity | S |
| 9 | H2 — ratchet ETA forward-only | Trust | S |
| 10 | S4 — `client_request_id` on customer_feedback [DB] | Operational integrity | M |
| 11 | M1 — menu-item modifiers/variants (full spec) | Conversion ceiling | L (spec) |
| 12 | Y2 — replace semantic emoji with lucide icons | A11y, polish | S |
| 13 | M2 — modal "stay & shop more" affordance | Conversion: friction | M |
| 14 | M4 — inline 1-tap item cancel | UX | S |
| 15 | CV2 — running total on cart icon | Trust signal | S |
| 16 | Y4 — safe-area-inset-bottom on fixed footers | iOS notch | S |
| 17 | S5 — verify Sentry PII scrub | Compliance | S |
| 18 | I1 — bump WCAG-AA contrast on dark glass text | A11y | S |
| 19 | MO3 — focus trap on call-staff modal | A11y | S |
| 20 | MO1 — `autoCorrect="off"` on free-text inputs | Data quality | S |

S ≈ <1 day; M ≈ 1–2 days; L ≈ multi-day spec + impl.

---

## Release-readiness checklist additions

Add to the existing checklist at the bottom of
[27-CW-PROD-PHASE-6-PERFORMANCE.md](27-CW-PROD-PHASE-6-PERFORMANCE.md):

- [ ] **Shared-device PII test**: open `/delivery?token=X`, fill form, close tab without ordering → reopen `/delivery?token=X` → form empty (CR2)
- [ ] **Tenant-bearer scope test**: scan tenant A's delivery QR, close tab, scan tenant B's QR in same browser → localStorage must not retain tenant A's `qrToken` (CR1)
- [ ] **Confirmation-overlay refresh test**: place order → mid-overlay, refresh the page → overlay restores with the order number (CR3)
- [ ] **Realtime outage simulation**: kill WSS for 90 s with order in `preparing` → polling fallback kicks in and refetches (H1)
- [ ] **Cart stale-item test**: add item, disable it server-side via staff-web, restore cart → item removed with a toast (H3)
- [ ] **Clock-skew test**: advance device clock 2 h forward during `preparing` → ETA does not jump backward (H2)
- [ ] **Table-delete test**: delete table via staff-web while customer is on `/table/T05/order` → customer sees "table no longer active" UI (H5)
- [ ] **Long-locale overflow test**: switch to DE, view item with 6+ allergens → modal renders fully (Y3)
- [ ] **iOS safe-area test**: iPhone 14 Pro Max landscape → Place Order button is fully above the home indicator (Y4)
- [ ] **Waiter-call cooldown test**: tap Call Staff, then tap again within 30 s before staff acknowledges → second tap blocked / merged (H6)
- [ ] **Cross-tab Place Order test**: open cart in two tabs, submit in both → server-side dedup rejects the second cleanly; client UX explains (H4)
- [ ] **Sentry PII scrub**: verify `sentry.client.config.ts` redacts `customer_phone`, `delivery_address`, `customer_name`, `qr_token`, `delivery_access_token` (S5)
- [ ] **Feedback double-submit test**: rapidly tap "Submit Feedback" → exactly one row server-side (S4)

---

## What already appears production-ready

These are the existing strengths of customer-web post-Phase-6; they
should NOT be revisited as part of this audit:

- **Idempotency on orders + items + waiter calls.** `client_request_id` is correctly stamped, threaded through retries, dedup'd via partial-unique server indexes.
- **Realtime filters scope correctly.** `id=eq.${orderId}` (not `table_id`) prevents cross-customer leakage at the channel level. Lint guard enforces it.
- **Tenant-context binding.** `bindCustomerTenantContext` is auditable, idempotent, breadcrumb-logged, explicitly reset on tenantless routes via `TenantContextResetter`.
- **CSP and security headers.** Per-request nonce, `strict-dynamic`, tight `connect-src`, X-Frame-Options DENY, HSTS, Referrer-Policy strict. No `unsafe-inline` outside style.
- **CSRF posture.** Customer flows are unauthenticated by design; mutations go through staff-web API routes that derive tenant server-side. Blocker 1 has no regressions.
- **Cart partitioning.** `(flow, tenantId, tableId?)` partitioning + 4 h TTL closes the cross-tenant cart leak.
- **Mobile parity baseline.** Phase 5 hit touch targets, RTL, focus traps on the main modals (cancel order, cancel item, menu-item) — *except* call-staff modal (MO3).
- **i18n surface.** 20-locale coverage enforced by CI; sentinel error codes for server errors; format helpers for prices/dates.
- **Bundle hygiene.** No heavy deps (framer-motion, lodash, moment, recharts) reached customer-web. Phase 6 P9 added a guardrail.
- **Type safety.** Strict TS, wrapper boundary lint, raw `.from()` / `.rpc()` lint guard.
- **Test coverage.** 217 customer-web vitest cases covering hooks, stores, providers, feature flows.

---

## Bottom line

After Phases 1–6, customer-web is no longer in "demo grade" — the
duplicate-order, multi-tenant-cache, and realtime-reconnect classes of
bug are closed. What remains is mostly **trust + edge-case resilience**,
not architecture.

Three issues warrant blocking a *public* release (CR1–CR3). Everything
else is high-leverage follow-up.

If you have to pick one thing to fix next: **CR1 → CR3 → H1**. All
small-effort, all high blast-radius.
