# Mobile ↔ staff-web Parity Implementation Plan

Derived from the UI/UX consistency audit. Ordered so that earlier phases unblock later ones and the highest operational-impact gaps close first.

Each task lists:
- **Why** — the operational/consistency rationale
- **Files** — primary code touched
- **Effort** — rough t-shirt size (S < 1d, M 1–3d, L 3–5d, XL > 1w)
- **Depends on** — earlier task IDs

---

## Phase 0 — Foundation cleanup (blocking)

Small surgical fixes that remove landmines and unblock the rest of the plan.

### 0.1 Resolve `STATUS_COLORS` vs `ORDER_STATUS_HEX` conflict
- **Why:** [packages/core/src/constants.ts](packages/core/src/constants.ts) defines `STATUS_COLORS.new = '#EF4444'` (red), while [packages/core/src/colors.ts](packages/core/src/colors.ts) defines `ORDER_STATUS_HEX.new = { bg: '#dbeafe', text: '#1e40af' }` (blue). Future devs will pick the wrong one.
- **Action:** Audit all imports of `STATUS_COLORS`. If unused, delete. If used, rename to `STATUS_SOLID_HEX` and document the bg/text-pair vs solid distinction in the file header.
- **Files:** [packages/core/src/constants.ts](packages/core/src/constants.ts) + any importers
- **Effort:** S
- **Depends on:** —

### 0.2 Fix hardcoded English in `StockMovementModal`
- **Why:** Direct violation of CLAUDE.md i18n rule. Strings render as English in all 20 locales.
- **Action:** Replace `'+ Add'` / `'- Remove'` / `'Set To'` literals with `t('stock.movementType.add' | 'remove' | 'setTo')`. Add keys to all 20 `staff.json` files.
- **Files:** [apps/mobile/src/components/stock/StockMovementModal.tsx](apps/mobile/src/components/stock/StockMovementModal.tsx) lines 10–12, [packages/i18n/src/locales/*/staff.json](packages/i18n/src/locales/)
- **Effort:** S
- **Depends on:** —

### 0.3 Add a typed `BadgeConfig` contract in `@gustri/core`
- **Why:** Both `@gustri/ui/badges.ts` (web Tailwind classes) and `apps/mobile/src/components/ui/StatusBadge.tsx` (mobile hex pairs) need to converge on a single shape so variants (outline, pulse, icon) can be added once.
- **Action:** Define in [packages/core/src/colors.ts](packages/core/src/colors.ts):
  ```ts
  export type BadgeConfig = {
    bg: string; text: string; border?: string;
    pulse?: boolean; iconName?: string;
  }
  ```
  Refactor `ORDER_STATUS_HEX` etc. to use it. Update web `badges.ts` to derive Tailwind classes from the same source.
- **Effort:** M
- **Depends on:** 0.1

---

## Phase 1 — Operational impact (highest priority)

The four gaps that materially change a waiter's or cook's ability to do their job on mobile.

### 1.1 Kitchen Display visual urgency on mobile
- **Why:** The single biggest "two products" finding. Web kitchen has dark theme + elapsed-time card backgrounds + `animate-pulse` on new orders + URGENT badge + header summary tiles. Mobile has a flat light-mode list. Kitchen staff cannot triage urgency at a glance.
- **Action:**
  1. Apply `kitchenDarkTheme` (already defined but unused in [apps/mobile/src/theme/index.ts](apps/mobile/src/theme/index.ts)) when route is `KitchenTab`.
  2. In [KitchenOrderCard.tsx](apps/mobile/src/components/kitchen/KitchenOrderCard.tsx), color the card background by `TIME_ELAPSED_THRESHOLDS`: yellow / orange / red bands.
  3. Add `Animated.loop` opacity pulse on cards with `status === 'new'`.
  4. Add a header summary row to [KitchenDisplayScreen.tsx](apps/mobile/src/screens/kitchen/KitchenDisplayScreen.tsx): New / Cooking / Ready counts in colored tiles, matching the web layout.
  5. Split pending-approval orders into a separate rail at the top with amber border + pulse, mirroring [apps/staff-web/src/app/(staff)/kitchen/page.tsx:481-569](apps/staff-web/src/app/(staff)/kitchen/page.tsx).
  6. Bump order-number typography to match web prominence (`fontSize: 28, fontWeight: '900'`).
- **Effort:** L
- **Depends on:** 0.3

### 1.2 Port `FreshnessIndicator` to mobile
- **Why:** Mobile communicates only *negative* connectivity states (offline / degraded banners) but never confirms positive realtime freshness. Staff cannot answer "am I seeing live data?" without inference.
- **Action:**
  1. Create `apps/mobile/src/components/ui/FreshnessIndicator.tsx` mirroring [apps/staff-web/src/components/common/freshness-indicator.tsx](apps/staff-web/src/components/common/freshness-indicator.tsx) — same thresholds (30s amber / 120s red).
  2. Wire it to the same realtime event timestamp source used by `RealtimeStatusBanner`.
  3. Mount on Orders / Kitchen / Tables / Calls list screens. (Requires persistent header — see 2.1.)
- **Effort:** M
- **Depends on:** 2.1 (header) for placement

### 1.3 Item-level payment + tip support on mobile
- **Why:** A waiter at the table cannot split a bill by items or add a tip from their phone. Forces a walk to the web station — the inverse of "shift-time on mobile."
- **Action:**
  1. Refactor [OrderPaymentScreen.tsx](apps/mobile/src/screens/orders/OrderPaymentScreen.tsx) to add a payment-mode segmented control: Full / Partial amount / Specific items, mirroring [split-payment-modal.tsx](apps/staff-web/src/components/modals/split-payment-modal.tsx).
  2. Add a tip input (visible when `cafe_settings.tips_enabled`).
  3. Add an item-picker UI when mode = "Specific items" (checkboxes per order item).
  4. Reuse the same i18n keys (`orders.paymentModeFull`, `orders.paymentModePartial`, `orders.paymentModeItems`).
- **Effort:** L
- **Depends on:** —

### 1.4 Finish `CreateDeliveryModal` parity on mobile
- **Why:** Mobile [CreateDeliveryModal.tsx](apps/mobile/src/components/delivery/CreateDeliveryModal.tsx) currently shows the literal hint "Order will be created without items" — a half-shipped flow. Web supports full menu picker + live total in CTA.
- **Action:**
  1. Add a menu-item picker step (reuse `AddItemsScreen` patterns — category chip bar + FlashList).
  2. Show selected-items preview + running total above the CTA.
  3. Change CTA from "Create Order" to `t('delivery.createDeliveryOrderWithTotal', { total })` matching web's `Create Delivery Order · ${total}`.
  4. Add "save customer" toggle to mirror web's checkbox.
  5. Remove the "without items" hint.
- **Effort:** L
- **Depends on:** —

### 1.5 Table Transfer on mobile
- **Why:** Genuinely shift-time op (waiters move parties between tables constantly). Currently web-only ([table-transfer-modal.tsx](apps/staff-web/src/components/modals/table-transfer-modal.tsx)).
- **Action:**
  1. Create `apps/mobile/src/components/tables/TransferTableModal.tsx`. Use Paper Dialog or new bottom sheet (see 2.3).
  2. Surface from `TableDetailScreen` or table action menu.
  3. Reuse `useTransferTable` mutation from `@gustri/queries`.
  4. Mirror occupied-table warning + "Transfer Anyway" amber CTA.
- **Effort:** M
- **Depends on:** —

---

## Phase 2 — Consistency & wayfinding

Restores the parity that lets staff switch devices without retraining.

### 2.1 Add persistent screen headers on mobile
- **Why:** All mobile stacks set `headerShown: false`. Deep screens have no title, no freshness indicator slot, no consistent back affordance. Blocks 1.2.
- **Action:**
  1. Set `headerShown: true` on stack screens (keep `false` on tab screens with custom layouts).
  2. Build a shared `ScreenHeader` component: title + optional `FreshnessIndicator` + optional right-side action.
  3. Use it across Order Detail, Add Items, Payment, Task detail, Delivery, etc.
- **Effort:** M
- **Depends on:** —

### 2.2 Unify destructive-confirm pattern
- **Why:** Mobile uses 1.5s press-and-hold ([DestructiveConfirmModal.tsx](apps/mobile/src/components/ui/DestructiveConfirmModal.tsx)). Web uses instant click-confirm-click ([confirm-dialog.tsx](apps/staff-web/src/components/modals/confirm-dialog.tsx)). Different muscle memory.
- **Action:** Decide canonical pattern. Recommended: keep press-and-hold on mobile (touch UX is more accident-prone), but add a similar "type the order # to confirm" step on web for high-stakes destructions (full refund, order cancel after preparation). Document in CLAUDE.md.
- **Effort:** S (decision) + M (implementation)
- **Depends on:** —

### 2.3 Introduce bottom-sheet pattern on mobile
- **Why:** Short forms (delivery confirm, kitchen reject reason, payment method picker) feel heavy as full-screen Paper modals. Native bottom sheets feel right for these.
- **Action:**
  1. Add `@gorhom/bottom-sheet` dependency.
  2. Create `apps/mobile/src/components/ui/BottomSheet.tsx` wrapper with `size: 'sm' | 'md' | 'lg'`.
  3. Migrate short modals: `KitchenRejectModal`, payment method picker, table action menu.
  4. Keep full-screen Portal/Modal for long forms (`TaskModal`, `AddItemsScreen`).
- **Effort:** M
- **Depends on:** —

### 2.4 Add outline variant to mobile `StatusBadge`
- **Why:** Web badges have an optional `border-{color}-300` outline (used for grouping). Mobile is always a flat pill.
- **Action:** Extend `StatusBadge` to accept `variant: 'solid' | 'outlined'`. Read `border` field from the `BadgeConfig` introduced in 0.3.
- **Files:** [apps/mobile/src/components/ui/StatusBadge.tsx](apps/mobile/src/components/ui/StatusBadge.tsx)
- **Effort:** S
- **Depends on:** 0.3

### 2.5 Pulse emergency calls + new kitchen orders on mobile
- **Why:** Web pulses both with `animate-pulse`. Mobile uses static styling — emergency signal is operationally weaker.
- **Action:** Add `usePulseAnimation()` hook (loop opacity 1 ↔ 0.6 over 1.2s). Apply to `WaiterCallCard` when `status === 'pending' && reason === 'emergency'`, and to `KitchenOrderCard` when `status === 'new'` and to pending-approval rail (overlaps with 1.1).
- **Effort:** S
- **Depends on:** —

### 2.6 Mirror order-type colored backgrounds on the mobile list
- **Why:** Web's single orders list color-codes by type (white dine-in / orange-50 takeout / purple-50 delivery). Mobile splits into separate routes. Either unify or document the divergence.
- **Action (option A, recommended):** Add a unified "Orders" view on mobile with type filter chips, mirroring web. Keep dedicated Delivery/Takeout tabs for focused workflows. Apply the same hex backgrounds from `@gustri/core`.
- **Effort:** M
- **Depends on:** —

### 2.7 Align typography scale
- **Why:** Mobile is one notch denser than web (`body: 14` vs web `text-base: 16`). Mobile fixed scale, web responsive.
- **Action:** Update mobile [theme/index.ts](apps/mobile/src/theme/index.ts) TYPOGRAPHY to add a `PixelRatio.getFontScale()`-aware multiplier OR bump base sizes one notch to match web's effective rendered sizes. Validate on small-screen Android (`<360dp`).
- **Effort:** S
- **Depends on:** —

---

## Phase 3 — Design-system standardization

Codifies the patterns so future drift is harder than non-drift.

### 3.1 Restructure design packages
- **Why:** `@gustri/ui` is actually `@gustri/ui-web`; mobile components live unnamed in `apps/mobile/src/components/ui/`. No package boundary enforces the shared contract.
- **Action:** Create three packages:
  - `@gustri/design-tokens` — colors, spacing, typography, radii (move from `@gustri/core`)
  - `@gustri/ui-web` — current `@gustri/ui` + `@gustri/ui-web` merged
  - `@gustri/ui-mobile` — extract `apps/mobile/src/components/ui/` into a workspace package
  Both UI packages depend on `@gustri/design-tokens` and implement the same component contract (Button / Badge / Card / Sheet / Spinner with matching prop shapes).
- **Effort:** L
- **Depends on:** 0.3

### 3.2 Codify spacing scale
- **Why:** Both apps use spacing implicitly (Tailwind utilities / hardcoded constants). No shared scale.
- **Action:** In `@gustri/design-tokens`, export `SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32 }`. Mirror as Tailwind theme extension on web.
- **Effort:** S
- **Depends on:** 3.1

### 3.3 Standardize card elevation
- **Why:** Web `shadow-md` is much heavier than mobile's `shadowOpacity: 0.05, elevation: 2`. Cards feel like different products.
- **Action:** Define three elevations (`rest / hover / active`) in tokens. Map to `box-shadow` (web) and `shadowOpacity + elevation` (mobile).
- **Effort:** S
- **Depends on:** 3.1

### 3.4 Unified `Button` component contract
- **Why:** Mobile mixes Paper Button + custom `StatusActions` TouchableOpacity. Web uses CVA Button. Different APIs, different visual finish.
- **Action:** Define `ButtonProps = { variant: 'primary'|'secondary'|'outline'|'ghost'|'destructive'; size: 'sm'|'md'|'lg'|'icon'; loading?: boolean; icon?: ReactNode }` in design tokens. Implement in both UI packages. Migrate `StatusActions` to use it.
- **Effort:** M
- **Depends on:** 3.1

### 3.5 Snapshot test for color consistency
- **Why:** Prevent future drift between `colors.ts` hexes and `badges.ts` Tailwind classes.
- **Action:** Add a Vitest snapshot in `packages/ui` that maps every Tailwind class in `badges.ts` to its computed RGB and asserts it matches the corresponding hex in `colors.ts`. Fails on drift.
- **Effort:** S
- **Depends on:** 3.1

---

## Phase 4 — Polish & native UX

Faster wins; ship as capacity allows.

### 4.1 Add `KeyboardAvoidingView` to mobile modals
- **Files:** [TaskModal.tsx](apps/mobile/src/components/tasks/TaskModal.tsx), [CreateDeliveryModal.tsx](apps/mobile/src/components/delivery/CreateDeliveryModal.tsx), [OrderPaymentScreen.tsx](apps/mobile/src/screens/orders/OrderPaymentScreen.tsx), [StockMovementModal.tsx](apps/mobile/src/components/stock/StockMovementModal.tsx)
- **Effort:** S

### 4.2 Add Gustri logo to mobile drawer header
- **Why:** Brand invisible during 90% of the shift. Five-minute fix.
- **Effort:** S
- **Depends on:** —

### 4.3 Add skeleton loaders to both platforms
- **Why:** Centered spinner on slow network is worse UX than skeletons.
- **Action:** Build `Skeleton` in both UI packages. Apply to Orders list, Tables grid, Kitchen list.
- **Effort:** M
- **Depends on:** 3.1

### 4.4 Reconcile mobile-only drawer routes with the "mobile-only omissions" policy
- **Why:** CLAUDE.md says staff CRUD / billing / menu management / schedules should be web-only. Mobile drawer currently has all of these.
- **Action:** Audit each drawer route. Either: (a) remove from mobile entirely + show a banner pointing to web, (b) update CLAUDE.md to reflect actual policy. Either direction — but consistent.
- **Effort:** S (decision) + M (implementation)
- **Depends on:** —

### 4.5 Add FAB consistency across mobile list screens
- **Why:** Tasks has a FAB; Orders / Tables / Calls do not. Inconsistent "create new" pattern.
- **Action:** Either add FABs to Orders (new order), Tables (new table for admin), or remove the Tasks FAB and use a header action button (after 2.1).
- **Effort:** S
- **Depends on:** 2.1

---

## Phase 5 — Testing & validation

Run after Phases 1–3 ship.

### 5.1 Rush-hour parallel test
30 orders / 10 min on both platforms simultaneously. Measure time-to-urgent-order detection.

### 5.2 Cross-device shift test
Waiter starts on web, switches to mobile mid-shift. Note hesitations / terminology surprises.

### 5.3 Multi-device kitchen comparison
Wall-mounted iPad (mobile) + monitor (web) showing the same queue. Photograph side-by-side. Both should look like the same product.

### 5.4 Low-attention test
5-second flash of each list screen → "which order needs you next?" Both platforms should converge.

### 5.5 One-handed payment test
Take partial cash payment on iPhone 13 mini standing up, keyboard open. CTA stays reachable.

### 5.6 Old-device readability
Mobile on 360dp Android 9 under restaurant lighting. Smallest readable text, badge legibility.

---

## Suggested release sequencing

| Sprint | Deliverable |
|---|---|
| Sprint 1 | Phase 0 + 1.4 (delivery parity — the one already in-flight) |
| Sprint 2 | 1.1 Kitchen visual urgency + 2.1 Persistent headers |
| Sprint 3 | 1.2 Freshness indicator + 1.3 Payment richness |
| Sprint 4 | 1.5 Table transfer + 2.2–2.5 Consistency batch |
| Sprint 5 | Phase 3 (design-system restructure — can run in parallel to Phase 4) |
| Sprint 6+ | Phase 4 polish + Phase 5 testing |

---

## What we are explicitly NOT doing

Per CLAUDE.md "Intentional mobile-only omissions" — these stay web-only and should be reaffirmed (or removed from the mobile drawer per task 4.4):

- Staff CRUD (hire / edit / deactivate)
- Tenant/cafe creation and billing
- Plan upgrades / Stripe portal
- Bulk menu import / category reorganization
- Audit log viewing
- Reports / analytics bulk export (read-only summary cards on mobile are OK)
