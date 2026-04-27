# Phase 9B: Deduplicate Code — Staff-Web Consumers

## Goal

Replace all duplicated constants and utility functions in `apps/staff-web/` with imports from `@gustri/core` (created in Phase 9A).

## Prerequisites

- Phase 9A complete (shared constants and utilities exist in `@gustri/core`)

## Important

- Read each file before editing
- For each file: remove the local definition, add the import from `@gustri/core`, verify all usages still work
- Run `pnpm type-check` after every 2-3 files
- Run `pnpm test` at the end

---

## Step 1: Replace `ORDER_STATUS_KEYS` (6 files)

In each file below, find the local `const ORDER_STATUS_KEYS: Record<string, string> = { ... }` definition (10-line object), delete it, and add `import { ORDER_STATUS_KEYS } from '@gustri/core';` at the top.

Files:
1. `apps/staff-web/src/app/(staff)/kitchen/page.tsx` (~lines 25-35)
2. `apps/staff-web/src/app/(staff)/tables/[id]/page.tsx` (~lines 61-71)
3. `apps/staff-web/src/app/(staff)/orders/[id]/page.tsx` (~lines 76-86)
4. `apps/staff-web/src/components/delivery/delivery-order-card.tsx` (~lines 20-30)
5. `apps/staff-web/src/components/orders/order-list-card.tsx` (~lines 58-68)
6. `apps/staff-web/src/components/takeout/takeout-order-card.tsx` (~lines 19-29)

For each file:
- Read the file
- Check if `@gustri/core` is already imported (if so, just add `ORDER_STATUS_KEYS` to the existing import)
- Delete the local `ORDER_STATUS_KEYS` definition
- Verify no usage changes are needed (the variable name and shape are identical)

---

## Step 2: Replace `ACTIVE_STATUSES` Inline Arrays (5+ locations)

In each file, find the inline `['pending_approval', 'new', 'preparing', 'ready', 'served']` array and replace with the appropriate constant from `@gustri/core`.

**Dine-in variant** (`ACTIVE_ORDER_STATUSES`):
1. `apps/staff-web/src/app/(staff)/tables/[id]/page.tsx` — find the inline array(s) at ~line 114 and ~line 645. Replace with `ACTIVE_ORDER_STATUSES`. Also check if it's used in a `.includes()` call — the `as const` array needs `[...ACTIVE_ORDER_STATUSES]` or a type assertion if used with `.includes()` on a `string` value.
2. `apps/staff-web/src/app/(staff)/tables/page.tsx` — ~line 84
3. `apps/staff-web/src/components/modals/table-transfer-modal.tsx` — ~line 41

**Takeout variant** (`ACTIVE_TAKEOUT_STATUSES`):
4. `apps/staff-web/src/app/(staff)/takeout/page.tsx` — ~line 40

**Delivery variant** (`ACTIVE_DELIVERY_STATUSES`):
5. `apps/staff-web/src/app/(staff)/delivery/page.tsx` — ~line 55

For each: add the import from `@gustri/core`, replace the inline array.

If any usage passes the array to a function that expects `string[]` (not `readonly string[]`), spread it: `[...ACTIVE_ORDER_STATUSES]`.

---

## Step 3: Replace `getRoleBadgeColor` (5 files)

In each file, find the local `getRoleBadgeColor` function (or inline switch statement mapping roles to Tailwind classes), delete it, and import from `@gustri/core`.

Files:
1. `apps/staff-web/src/components/layout/sidebar.tsx` (~lines 209-222)
2. `apps/staff-web/src/app/(staff)/staff/page.tsx` (~lines 47-58)
3. `apps/staff-web/src/components/layout/user-menu.tsx` (~lines 29-40)
4. `apps/staff-web/src/app/(staff)/settings/page.tsx` (~lines 78-89)
5. `apps/staff-web/src/app/(staff)/staff/[id]/page.tsx` (~lines 188-197)

For each file:
- Read the file to find the exact function
- Compare its cases with the `@gustri/core` version — they should match since Phase 9A used the most complete version
- Delete the local function
- Add `import { getRoleBadgeColor } from '@gustri/core';`
- Search the file for all call sites and verify they pass the same arguments

---

## Step 4: Replace `getStatusColor` / `getCardColor` (5 files)

In each file, find the local `getStatusColor` function mapping order statuses to Tailwind classes. Delete and import `getOrderStatusColor` from `@gustri/core`.

Files:
1. `apps/staff-web/src/components/orders/order-list-card.tsx` (~lines 70-91)
2. `apps/staff-web/src/components/delivery/delivery-order-card.tsx` (~lines 32-51)
3. `apps/staff-web/src/components/takeout/takeout-order-card.tsx` (~lines 31-48)
4. `apps/staff-web/src/app/(staff)/tables/[id]/page.tsx` (~lines 317-330)
5. `apps/staff-web/src/app/(staff)/orders/[id]/page.tsx` (~lines 210-233)

For each:
- Read the file to find the local function
- Note the local function name (it may be `getStatusColor`, `getCardColor`, or similar)
- Delete the local function
- Import `getOrderStatusColor` from `@gustri/core`
- Rename all call sites from the old name to `getOrderStatusColor`. If many call sites use the old name, you can alias the import: `import { getOrderStatusColor as getStatusColor } from '@gustri/core';`

---

## Step 5: Replace `calculateOrderTotal` (5 files)

In each file, find the local `calculateOrderTotal` function. Delete and import from `@gustri/core`.

Files:
1. `apps/staff-web/src/components/orders/order-list-card.tsx` (~lines 38-44)
2. `apps/staff-web/src/components/delivery/delivery-order-card.tsx` (~lines 64-70)
3. `apps/staff-web/src/components/tables/table-card.tsx` (~lines 38-44)
4. `apps/staff-web/src/components/takeout/takeout-order-card.tsx` (~lines 57-63)
5. `apps/staff-web/src/app/(staff)/tables/[id]/page.tsx` — inline variant at ~line 232

For file 5, the inline version may just be `order.order_items.filter(...).reduce(...)` without a named function. Replace with `calculateOrderTotal(order)`.

For `apps/staff-web/src/app/(staff)/orders/[id]/page.tsx` (~lines 177-185): this version is different — it calls `calculateSubtotal()` and adds tax. Do NOT replace this one; it has different logic.

---

## Step 6: Replace Time Formatting Utilities (4+ files)

### `formatDuration` → `formatElapsedTime`

Files:
1. `apps/staff-web/src/components/tables/table-card.tsx` (~lines 47-58) — find `formatDuration`, delete, import `formatElapsedTime` from `@gustri/core`, rename call sites
2. `apps/staff-web/src/app/(staff)/tables/[id]/page.tsx` (~lines 306-314) — same

### `formatTime`

Files:
3. `apps/staff-web/src/components/delivery/delivery-order-card.tsx` (~line 53)
4. `apps/staff-web/src/components/orders/order-list-card.tsx` (~line 51)
5. `apps/staff-web/src/components/takeout/takeout-order-card.tsx` (~line 50)
6. `apps/staff-web/src/app/(staff)/orders/[id]/page.tsx` (~line 193)

For files 3-6: check if `formatTime` is defined as a local function or used inline. If local, delete and import from `@gustri/core`. If inline (`new Date(x).toLocaleTimeString(...)`) replace the inline call with `formatTime(x)` and add the import.

### `formatTimeAgo`

7. `apps/staff-web/src/app/(staff)/calls/page.tsx` (~lines 77-89) — this reimplements elapsed-time logic. Replace with `formatElapsedTime` from `@gustri/core` if the output format matches. Read both implementations to confirm compatibility.

---

## Step 7: Replace Cart Logic with `useStaffCart` Hook (2 files)

### File: `apps/staff-web/src/app/(staff)/tables/[id]/page.tsx`

Find the cart state and functions (~lines 195-229):
```
const [cart, setCart] = useState<CartItem[]>([]);
const addToCart = ...
const removeFromCart = ...
const getCartQuantity = ...
```

Replace all 4 with:
```typescript
const { cart, setCart, addToCart, removeFromCart, getCartQuantity, clearCart } = useStaffCart();
```

Add `import { useStaffCart } from '@/hooks/use-staff-cart';`

Search the file for `setCart([])` calls (cart clearing) and replace with `clearCart()`.

### File: `apps/staff-web/src/app/(staff)/orders/[id]/add-items/page.tsx`

Same replacement at ~lines 55-89. Same pattern.

---

## Final Verification

```bash
pnpm type-check
pnpm test
pnpm check
```

Manually verify staff-web renders correctly on key pages:
- Tables list and table detail (uses `calculateOrderTotal`, `formatElapsedTime`, `ACTIVE_ORDER_STATUSES`, `ORDER_STATUS_KEYS`, `getOrderStatusColor`, `getRoleBadgeColor`, cart logic)
- Orders list and order detail
- Kitchen page
- Staff page
- Calls page

## Commit

Commit with message: `refactor(staff-web): replace duplicated constants and utilities with shared imports from @gustri/core`
