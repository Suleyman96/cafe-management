# customer-web Phase 3 — Major Customer UX

Index: [21-CW-PROD-AUDIT-OVERVIEW.md](21-CW-PROD-AUDIT-OVERVIEW.md)

Seven items. Conversion + trust during the high-stakes moments — checkout,
ordering, and tracking. Ships *after* Phase 2. Each item maps to a measurable
customer outcome (less abandonment, fewer support calls, less anxiety).

Status legend: `[ ]` not started · `[~]` in progress · `[x]` shipped · `[-]` won't fix

---

## M1. No persistent order-confirmation surface after submit

- [ ] **Where.**
  - Dine-in submit: [apps/customer-web/src/hooks/use-place-order.ts:79-82](../apps/customer-web/src/hooks/use-place-order.ts#L79-L82)
  - Delivery submit: [apps/customer-web/src/components/cart/delivery-cart-screen.tsx:121-125](../apps/customer-web/src/components/cart/delivery-cart-screen.tsx#L121-L125)
- [ ] **What.** `toast.success(...)` (auto-dismissed by sonner in ~3s) then `router.push(...)`. On a slow mobile network the route transition takes several seconds during which the customer sees nothing definitive. "Did my order go through?" anxiety.
- [ ] **Why it matters.** This is the single highest-anxiety moment in the flow. Anxiety = retry. Retry = (if Phase 1 C1 isn't shipped) duplicate orders. Even with C1 shipped, retry = wasted server load and customer mental load.
- [ ] **Fix steps.**
  1. Introduce a transient confirmation surface — a full-screen overlay that shows:
     - Big check mark
     - Order number (from `order.order_number`, immediate)
     - "Your table will be notified" (dine-in) / "We're confirming with the restaurant" (delivery)
     - Total + item count
     - A "Track Order" button that does the navigation when the customer is ready
  2. Implement as a Zustand slice or a single `useOrderConfirmation` ref so it survives the route transition. Auto-dismiss after 8s OR on Track Order tap.
  3. **Don't** block on the route push — the confirmation is the UI; the navigation can happen on Track Order tap (preferred) or auto-fire at 8s (acceptable).
  4. Move the toast call to a *fallback* for when the mutation fails *after* the optimistic confirmation (rare but possible — could happen if `addOrderItems` succeeds but client crashes before navigation).
- [ ] **Verification.**
  - Throttle network to 3G → confirmation appears immediately on tap. Customer sees order number even while the route is still transitioning.
  - Tap Track Order → routes to `/table/[id]/order` with the right order pre-fetched.
- [ ] **Done when.** Confirmation surface renders, dine-in + delivery both use it, route transition feels instant.

---

## M2. `MenuCartSidebar` shows `'...'` as the place-order loading state

- [ ] **Where.** [apps/customer-web/src/components/menu/menu-cart-sidebar.tsx:182](../apps/customer-web/src/components/menu/menu-cart-sidebar.tsx#L182)
- [ ] **What.** `{isPlacing ? '...' : t('cart.placeOrder', { price })}`. Three dots is jarring on a high-stakes button.
- [ ] **Why it matters.** Visual polish on the most consequential button in the app. "Powered by gustri" customers judge the platform on this exact moment.
- [ ] **Fix steps.**
  1. Replace with the same pattern [CartPriceSummary](../apps/customer-web/src/components/cart/cart-price-summary.tsx#L69-L73) uses:
     ```tsx
     {isPlacing ? (
       <>
         <LoadingSpinner size="sm" className="mr-2" />
         {t('placingOrder', { ns: 'common' })}
       </>
     ) : (
       t('cart.placeOrder', { price: priceDisplay(total) })
     )}
     ```
  2. The `placingOrder` key already exists in `common.json` across all 20 locales (used by CartPriceSummary).
- [ ] **Verification.**
  - Slow network → button shows spinner + "Placing order…" instead of "...".
- [ ] **Done when.** Both surfaces (cart-screen + menu-cart-sidebar) use the same loading pattern.

---

## M3. Persistent cart icon in menu header

- [ ] **Where.** [apps/customer-web/src/components/menu/menu-screen.tsx:120-187](../apps/customer-web/src/components/menu/menu-screen.tsx#L120-L187)
- [ ] **What.** The menu's sticky header has back-arrow + restaurant name + empty `w-9` spacer (right-aligned). Cart only becomes visible at the bottom of the screen *after* the customer adds an item. First-time visitors don't know where the cart lives.
- [ ] **Why it matters.** Discovery problem. Conversion hit: customers who tap an item, then close the modal without confirming, lose visibility of any items they did add.
- [ ] **Fix steps.**
  1. Replace the `w-9` spacer in the top row ([menu-screen.tsx:141](../apps/customer-web/src/components/menu/menu-screen.tsx#L141)) with a cart icon button.
  2. Show a count badge when `itemCount > 0` (use the existing `useCartStore.getItemCount()`).
  3. On tap: scroll the bottom cart section into view if items exist; otherwise open the `MenuCartSidebar` empty state (which prompts to browse the menu — currently never visible).
  4. **Keep the bottom split intact** when items exist. The header icon is an *affordance*, not a duplicate cart.
- [ ] **Verification.**
  - Open menu with 0 items → cart icon visible in header with no badge.
  - Add 2 items → badge shows "2".
  - Tap → smooth-scroll to cart.
- [ ] **Done when.** Cart icon + badge in header, taps work, no visual regression.

---

## M4. Per-flow / per-tenant cart partition

- [ ] **Where.** [apps/customer-web/src/store/cart-store.ts](../apps/customer-web/src/store/cart-store.ts)
- [ ] **What.** Single in-memory cart store, keyed nowhere. A customer who scans a dine-in QR (tenant A), adds items, then opens `/delivery?token=B` (or even just navigates to `/delivery` without changing tenant) carries items forward. They'll submit against tenant B's `qr_token`; server rejects because `menu_item_id` is tenant-scoped via RLS, but the customer sees a generic error.
- [ ] **Why it matters.** Failure scenario #4 (cart lost on tab kill) AND the cross-flow leak. The comment in `cart-store.ts:4-26` already anticipates this fix path.
- [ ] **Fix steps.**
  1. **Decision:** persistence on, partitioned by `(flow, tenantId, tableId?)`. Flow is `'dine_in' | 'delivery'`. Storage key shape: `cart:dine_in:<tenantId>:<tableId>` or `cart:delivery:<tenantId>`.
  2. Custom Zustand `persist` storage adapter that:
     - Reads the bound tenant id from the wrapper (`db.getTenantId()`).
     - Reads the active table id from the URL pathname (`/table/[tableId]/...`) or sentinel `__delivery__`.
     - Picks the right key.
  3. On tenant/table change (detected by the layout's `useEffect`), call `useCartStore.setState({ items: [] })` to reset to the new partition's contents (which may be empty).
  4. **Decision: TTL.** Carts auto-expire after 4h of inactivity. A `lastTouchedAt` field is stamped on every mutation; the storage adapter reads it on load and ignores stale state.
  5. Update the comment at the top of the file to reflect the new design.
- [ ] **Verification.**
  - Scan tenant A QR, add items, navigate to `/delivery?token=B` → cart is empty.
  - Reload `/table/A/menu` after adding items → cart preserved.
  - Manually advance the system clock by 5h → cart cleared on next load.
- [ ] **Done when.** Per-partition persistence works, TTL respected, no cross-flow leaks.

---

## M5. Realtime echo dedup — don't double-invalidate on the customer's own writes

- [ ] **Where.**
  - [apps/customer-web/src/hooks/use-order.ts:82-108](../apps/customer-web/src/hooks/use-order.ts#L82-L108)
  - [apps/customer-web/src/hooks/use-delivery.ts:61-87](../apps/customer-web/src/hooks/use-delivery.ts#L61-L87)
- [ ] **What.** When the customer mutates (add item, cancel item), the mutation's `onSuccess` invalidates the query immediately. The realtime echo of that same write fires ~200ms later and re-invalidates. Result: brief skeleton flash then content twice.
- [ ] **Why it matters.** UI flicker on every mutation. Cumulative annoyance. Also costs an extra RPC per write.
- [ ] **Fix steps.**
  1. Track recently-applied `client_request_id`s in a `Set` (per orderId, max 16 entries, FIFO eviction).
  2. In the realtime callback, inspect `payload.new.client_request_id` (assuming the column is on the row — it is, per the schema). If it's in the recent set, skip the invalidate.
  3. Add an `onSuccess` hook in each mutation that records the id into the set.
  4. **Alternative:** use `setQueryData` to apply the optimistic update; the realtime event then matches the existing data and skips refetch via React Query's normal "no diff" path. This is the cleaner design but requires modeling the optimistic shape per mutation (orders, items, statuses). The Set-of-ids approach is simpler and ships in one PR.
- [ ] **Verification.**
  - Add an item → no double-invalidate observed in React DevTools Profiler.
  - Staff-side update (different `client_request_id`) → invalidates normally.
- [ ] **Done when.** Customer-own mutations don't cause echo flicker; staff updates still propagate.

---

## M6. Estimated wait time on order tracking

- [ ] **Where.** [apps/customer-web/src/components/order/order-status.tsx](../apps/customer-web/src/components/order/order-status.tsx)
- [ ] **What.** `preparation_time` exists per `menu_item` and is shown on menu cards. It's never aggregated into a customer-facing ETA.
- [ ] **Why it matters.** Restaurants live on perceived speed. "Your food is ready in ~12 minutes" reduces "how much longer?" anxiety dramatically.
- [ ] **Fix steps.**
  1. Compute ETA from `order.order_items` + `order.created_at`:
     - For `pending_approval` / `new`: `max(item.preparation_time)` from non-cancelled items.
     - For `preparing`: `created_at + max(prep_time) - now()` (countdown).
     - For `ready` / `served`: hide.
  2. Render under the status banner. Copy: `t('orderStatus.eta.preparing', { minutes })`.
  3. Recompute every 30s via a `setInterval` (or `useEffect` with `useState<number>` ticking).
  4. **Don't** show ETA when `preparation_time` is null on any item — fall back to the existing "We're preparing your order" banner.
  5. Add the new keys to all 20 locales: `orderStatus.eta.preparing`, `orderStatus.eta.almostReady` (< 2 min).
- [ ] **Verification.**
  - Order with 3 items (10, 15, 12 min) → ETA reads "~15 min" while `pending_approval`.
  - As order ages → ETA decreases.
- [ ] **Done when.** ETA renders correctly, all locales translated, no flicker on tick.

---

## M7. Order total in the active-order banner on table-landing

- [ ] **Where.** [apps/customer-web/src/components/table/table-landing.tsx:303-362](../apps/customer-web/src/components/table/table-landing.tsx#L303-L362)
- [ ] **What.** The banner shows order number, status label, item count. Total is missing. Customers want to know "did I order enough" without tapping in.
- [ ] **Why it matters.** Cheap conversion win. Lowers the cost of confirming "yes I'm done ordering."
- [ ] **Fix steps.**
  1. Add `activeOrder.total` formatted via `useFormatPrice()` to the banner subtitle row.
  2. Use the existing `useFormatPrice` hook so currency formatting matches the tenant's settings.
  3. Keep the layout tight — banner is already cramped on small phones. Consider truncating the status label and putting total on a second line if needed.
  4. Also fix the fragile `t(...).split('•').pop()?.trim()` parsing at [line 339-347](../apps/customer-web/src/components/table/table-landing.tsx#L339-L347) while you're in there — pass `count` directly into a structured prop instead of string-splitting a translation.
- [ ] **Verification.**
  - Active order with 3 items @ $42 → banner shows `$42 · 3 items · Preparing`.
  - Switch to RU/AR → no broken bullets or fallback strings.
- [ ] **Done when.** Total visible, fragile split removed, all 20 locales render cleanly.

---

## Phase 3 exit gate

All seven items shipped. Manual end-to-end test:

- Dine-in: scan QR, add items, see persistent cart icon, place order, see confirmation surface with order number, land on order-status with ETA visible.
- Delivery: capture token, browse, place order, see confirmation surface, land on tracking with ETA.
- Two-tab test: separate tenants, cart partitions distinct.
- Throttle network: place order with 2G → still feels deliberate (no `'...'` flicker, confirmation appears immediately).

Once Phase 3 ships, hand off to [25-CW-PROD-PHASE-4-SECURITY.md](25-CW-PROD-PHASE-4-SECURITY.md).
