# Phase 9A: Deduplicate Code — Shared Constants & Utilities

## Goal

Extract duplicated constants and utility functions into shared packages so they exist in exactly one place. This phase creates the shared definitions; subsequent phases update consumers.

## Important

- Read each file before editing
- Run `pnpm type-check && pnpm test` after completing all steps
- This phase only adds new exports to packages — it does NOT touch app code yet

---

## Step 1: Add `ORDER_STATUS_KEYS` to `@gustri/core`

This exact object is copy-pasted into **6 staff-web files** and **4 mobile files** (as `STATUS_LABEL_KEYS`).

**File:** `packages/core/src/constants.ts`

Read the file first. Add this constant (verify the exact keys/values match what's in `apps/staff-web/src/app/(staff)/kitchen/page.tsx` lines 25-35):

```typescript
/** Maps order status enum values to i18n translation keys */
export const ORDER_STATUS_KEYS: Record<string, string> = {
  pending_approval: 'orders.pendingApproval',
  new: 'orders.new',
  preparing: 'orders.preparing',
  ready: 'orders.ready',
  served: 'orders.served',
  out_for_delivery: 'orders.outForDelivery',
  delivered: 'orders.delivered',
  closed: 'orders.closed',
  cancelled: 'orders.cancelled',
};
```

Verify it's exported from `packages/core/src/index.ts`.

---

## Step 2: Add `ACTIVE_STATUSES` Constants to `@gustri/core`

This array is defined inline in **9+ locations** across staff-web and mobile with 3 variants (dine-in, takeout, delivery).

**File:** `packages/core/src/constants.ts`

Add these constants (verify the arrays match what's used in app code):

```typescript
/** Active order statuses for dine-in tables */
export const ACTIVE_ORDER_STATUSES = [
  'pending_approval',
  'new',
  'preparing',
  'ready',
  'served',
] as const;

/** Active order statuses for takeout orders */
export const ACTIVE_TAKEOUT_STATUSES = [
  'pending_approval',
  'new',
  'preparing',
  'ready',
] as const;

/** Active order statuses for delivery orders */
export const ACTIVE_DELIVERY_STATUSES = [
  'pending_approval',
  'new',
  'preparing',
  'ready',
  'out_for_delivery',
] as const;
```

---

## Step 3: Add `getRoleBadgeColor` to `@gustri/core`

This function is defined in **5 staff-web files** with slight variations. Unify into one canonical version.

**File:** `packages/core/src/utils.ts`

Read all 5 definitions first to pick the most complete one. Add:

```typescript
/**
 * Returns Tailwind CSS classes for a staff role badge.
 * Used in staff lists, sidebars, and profile views.
 */
export function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'owner':
      return 'bg-purple-100 text-purple-800';
    case 'admin':
      return 'bg-red-100 text-red-800';
    case 'kitchen':
      return 'bg-orange-100 text-orange-800';
    case 'waiter':
    default:
      return 'bg-blue-100 text-blue-800';
  }
}
```

Read the existing definitions to confirm the exact Tailwind classes used. Pick the version from `sidebar.tsx` (lines 209-222) as it handles all 4 roles. If some files use different classes (e.g., `bg-purple-50` vs `bg-purple-100`), prefer the most commonly used variant.

---

## Step 4: Add `getOrderStatusColor` to `@gustri/core`

This function exists in **5 staff-web files** mapping order statuses to Tailwind color classes.

**File:** `packages/core/src/utils.ts`

Read the most complete version (likely `apps/staff-web/src/app/(staff)/orders/[id]/page.tsx` lines 210-233) and consolidate:

```typescript
/**
 * Returns Tailwind CSS classes for an order status badge/card.
 */
export function getOrderStatusColor(status: string): string {
  switch (status) {
    case 'pending_approval':
      return 'bg-yellow-100 text-yellow-800';
    case 'new':
      return 'bg-blue-100 text-blue-800';
    case 'preparing':
      return 'bg-orange-100 text-orange-800';
    case 'ready':
      return 'bg-green-100 text-green-800';
    case 'served':
      return 'bg-teal-100 text-teal-800';
    case 'out_for_delivery':
      return 'bg-indigo-100 text-indigo-800';
    case 'delivered':
      return 'bg-emerald-100 text-emerald-800';
    case 'closed':
      return 'bg-gray-100 text-gray-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
```

Read all 5 existing definitions and merge their cases into one superset. The exact Tailwind classes must match the existing code — don't invent new colors.

---

## Step 5: Add `calculateOrderTotal` to `@gustri/core`

This function is defined in **5 staff-web files** and **2 mobile files** with the same logic.

**File:** `packages/core/src/utils.ts`

Read `apps/staff-web/src/components/orders/order-list-card.tsx` lines 38-44 for the canonical version. Add (using proper types from `@gustri/database`):

```typescript
/**
 * Calculate order total — uses order.total if available, falls back to summing non-cancelled items.
 */
export function calculateOrderTotal(order: {
  total?: number | null;
  order_items?: Array<{
    status?: string | null;
    quantity: number;
    item_price: number;
  }> | null;
}): number {
  if (order?.total != null) return order.total;
  if (!order?.order_items) return 0;
  return order.order_items
    .filter((item) => item.status !== 'cancelled')
    .reduce((sum, item) => sum + item.quantity * item.item_price, 0);
}
```

Use a structural type parameter (not `any`) so it works with both `OrderWithItems` and `OrderWithDetails` without importing them.

---

## Step 6: Add Time Formatting Utilities to `@gustri/core`

`formatDuration` and `formatTime` are duplicated across 4+ staff-web files each.

**File:** `packages/core/src/utils.ts`

Read `apps/staff-web/src/components/tables/table-card.tsx` lines 47-58 for `formatDuration`. Add:

```typescript
/**
 * Format elapsed time from a start date to now as "Xm" or "Xh Ym".
 */
export function formatElapsedTime(startDate: string | Date): string {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const diffMs = Date.now() - start.getTime();
  const minutes = Math.floor(diffMs / 1000 / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}

/**
 * Format a date/time string to localized time (e.g., "02:30 PM").
 */
export function formatTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
```

Read the existing implementations to verify the exact logic. Some variants use different rounding or include seconds — pick the most common version.

---

## Step 7: Add `addToCart` / `removeFromCart` Hook to Staff-Web

This cart management logic is byte-for-byte identical in 2 staff-web pages. Extract into a reusable hook.

**File:** Create `apps/staff-web/src/hooks/use-staff-cart.ts`

Read the cart logic from `apps/staff-web/src/app/(staff)/tables/[id]/page.tsx` lines 195-229 (including the `cart` state and the `CartItem` type import). Create:

```typescript
import { useState, useCallback } from 'react';
import type { CartItem, MenuItem } from '@/types';

export function useStaffCart() {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = useCallback((menuItem: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map((item) =>
          item.menuItem.id === menuItem.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, { menuItem, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((menuItemId: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.menuItem.id === menuItemId);
      if (existing && existing.quantity > 1) {
        return prev.map((item) =>
          item.menuItem.id === menuItemId ? { ...item, quantity: item.quantity - 1 } : item,
        );
      }
      return prev.filter((item) => item.menuItem.id !== menuItemId);
    });
  }, []);

  const getCartQuantity = useCallback(
    (menuItemId: string) => {
      return cart.find((item) => item.menuItem.id === menuItemId)?.quantity || 0;
    },
    [cart],
  );

  const clearCart = useCallback(() => setCart([]), []);

  return { cart, setCart, addToCart, removeFromCart, getCartQuantity, clearCart };
}
```

Read both source files to confirm the exact logic matches. Adjust the `CartItem` type import path based on what exists.

---

## Final Verification

```bash
pnpm type-check   # Ensure new exports compile
pnpm test          # All existing tests still pass
pnpm check         # Biome lint + format
```

## Commit

Commit with message: `refactor: extract duplicated constants and utilities into shared packages`
