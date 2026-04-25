# Phase 9D: Deduplicate Code — Customer-Web Components

## Goal

Extract duplicated component logic in `apps/customer-web/` into shared components and hooks: dietary badges, status timeline, cart order placement, and cart item notes editing.

## Prerequisites

- Phase 9A complete (shared constants exist)

## Important

- Read each file before editing
- Run `pnpm type-check` after each step
- Run `pnpm test` at the end
- These are customer-facing components — be extra careful not to change visual behavior

---

## Step 1: Extract `DietaryBadges` Component

Two files render identical dietary badge sets with only size differences:
- `apps/customer-web/src/components/menu/menu-item-card.tsx` (~lines 127-176) — smaller: `px-1.5 py-0.5 text-[10px]`, icon `h-2.5 w-2.5`
- `apps/customer-web/src/components/menu/menu-item-modal.tsx` (~lines 99-145) — larger: `px-2.5 py-1 text-[11px]`, icon `h-3 w-3`

Both check `is_vegetarian`, `is_vegan`, `is_spicy`, `is_gluten_free` and render identical badges with the same `rgba()` color scheme.

### Create shared component

**File:** Create `apps/customer-web/src/components/menu/dietary-badges.tsx`

Read both files to get the exact badge markup. Create a component with a `size` prop:

```typescript
'use client';

import { Flame, Leaf, WheatOff } from 'lucide-react';

interface DietaryBadgesProps {
  item: {
    is_vegetarian?: boolean | null;
    is_vegan?: boolean | null;
    is_spicy?: boolean | null;
    is_gluten_free?: boolean | null;
  };
  size?: 'sm' | 'md';
}

export function DietaryBadges({ item, size = 'sm' }: DietaryBadgesProps) {
  // Use the exact JSX from menu-item-card.tsx for 'sm' 
  // and from menu-item-modal.tsx for 'md'
  // Size tokens: sm = { badge: 'px-1.5 py-0.5 text-[10px]', icon: 'h-2.5 w-2.5' }
  //              md = { badge: 'px-2.5 py-1 text-[11px] font-semibold', icon: 'h-3 w-3' }
  
  const styles = size === 'sm' 
    ? { badge: 'px-1.5 py-0.5 text-[10px]', icon: 'h-2.5 w-2.5' }
    : { badge: 'px-2.5 py-1 text-[11px] font-semibold', icon: 'h-3 w-3' };

  return (
    <div className="flex flex-wrap gap-1">
      {/* Copy the exact badge elements from the source files, using styles.badge and styles.icon */}
    </div>
  );
}
```

Read both source files and copy the **exact** badge JSX (rgba colors, icon components, conditional rendering). The only variation should be the size tokens.

### Update consumers

**File:** `apps/customer-web/src/components/menu/menu-item-card.tsx`
- Delete the inline badge section (~lines 127-176)
- Replace with `<DietaryBadges item={item} size="sm" />`

**File:** `apps/customer-web/src/components/menu/menu-item-modal.tsx`
- Delete the inline badge section (~lines 99-145)
- Replace with `<DietaryBadges item={item} size="md" />`

---

## Step 2: Extract `OrderTimeline` Component

Two files render near-identical status step timelines:
- `apps/customer-web/src/components/order/order-status.tsx` — `statusSteps` at ~lines 134-140, rendering loop at ~line 216
- `apps/customer-web/src/components/order/delivery-order-status.tsx` — `statusSteps` at ~lines 38-45, rendering loop at ~line 112

The rendering loop is pixel-identical. The only difference is which steps are in the array and which i18n keys are used.

### Create shared component

**File:** Create `apps/customer-web/src/components/order/order-timeline.tsx`

Read both files thoroughly — focus on the rendering loop JSX. Create:

```typescript
'use client';

import { CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface StatusStep {
  key: string;
  label: string;
  icon: LucideIcon;
}

interface OrderTimelineProps {
  steps: StatusStep[];
  currentStatus: string;
}

export function OrderTimeline({ steps, currentStatus }: OrderTimelineProps) {
  const currentStepIndex = steps.findIndex((step) => step.key === currentStatus);

  return (
    // Copy the exact rendering loop JSX from order-status.tsx
    // The loop renders each step with:
    // - Active/completed/future state based on currentStepIndex
    // - Circle icon, connecting line, label
    // - Green check for completed steps
  );
}
```

Copy the **exact** JSX from the rendering loop. Include all Tailwind classes, transition classes, and conditional logic.

### Update consumers

**File:** `apps/customer-web/src/components/order/order-status.tsx`
- Keep the local `statusSteps` definition (it uses dine-in-specific i18n keys)
- Delete the rendering loop JSX
- Replace with `<OrderTimeline steps={statusSteps} currentStatus={order.status} />`

**File:** `apps/customer-web/src/components/order/delivery-order-status.tsx`
- Keep the local `statusSteps` definition (it uses delivery-specific i18n keys)
- Delete the rendering loop JSX
- Replace with `<OrderTimeline steps={statusSteps} currentStatus={order.status} />`

---

## Step 3: Extract `usePlaceOrder` Hook

Three files contain near-identical order placement logic:
- `apps/customer-web/src/components/cart/cart-screen.tsx` (~lines 46-92)
- `apps/customer-web/src/components/menu/menu-cart-sidebar.tsx` (~lines 48-92)
- `apps/customer-web/src/components/cart/delivery-cart-screen.tsx` (~lines 43-89) — delivery variant, different mutations

`cart-screen.tsx` and `menu-cart-sidebar.tsx` are essentially the same function. Extract the shared flow.

### Create shared hook

**File:** Create `apps/customer-web/src/hooks/use-place-order.ts`

Read both `cart-screen.tsx` and `menu-cart-sidebar.tsx` to compare their `handlePlaceOrder` functions line-by-line. Create a hook that encapsulates the shared logic:

```typescript
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateOrder, useAddOrderItems } from './use-order';
import { useCartStore } from '@/store/cart-store';
import { useFormatPrice } from './use-format-price';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface UsePlaceOrderOptions {
  tableId: string;
  tenantId: string | undefined;
  minimumOrderAmount: number | undefined;
  onOrderPlaced?: () => void;
}

export function usePlaceOrder({ tableId, tenantId, minimumOrderAmount, onOrderPlaced }: UsePlaceOrderOptions) {
  const router = useRouter();
  const { t } = useTranslation();
  const formatPrice = useFormatPrice();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const createOrder = useCreateOrder();
  const addOrderItems = useAddOrderItems();

  const handlePlaceOrder = useCallback(async () => {
    // Copy the shared logic from cart-screen.tsx:
    // 1. Guard: items.length === 0, missing tableId/tenantId
    // 2. Check minimum order amount
    // 3. createOrder.mutateAsync(...)
    // 4. addOrderItems.mutateAsync(...)
    // 5. clearCart()
    // 6. onOrderPlaced?.()
    // 7. router.push(...)
  }, [/* deps */]);

  const isPlacing = createOrder.isPending || addOrderItems.isPending;

  return { handlePlaceOrder, isPlacing };
}
```

Read both source files carefully and use the most complete version. Include error handling, loading states, and all edge cases.

### Update consumers

**File:** `apps/customer-web/src/components/cart/cart-screen.tsx`
- Delete the local `handlePlaceOrder` function and related state
- Use `const { handlePlaceOrder, isPlacing } = usePlaceOrder({ tableId, tenantId, minimumOrderAmount });`
- Update the button's loading prop to use `isPlacing`

**File:** `apps/customer-web/src/components/menu/menu-cart-sidebar.tsx`
- Same replacement. The `onOrderPlaced` callback prop should be passed to the hook.

Do NOT touch `delivery-cart-screen.tsx` — it uses different mutations (`createDeliveryOrder`). It's a legitimate variant, not a duplicate.

---

## Step 4: Extract Cart Item Notes Editing Logic

Both `cart-screen.tsx` and `delivery-cart-screen.tsx` duplicate the same notes editing state management:
- `editingNotes` / `setEditingNotes` state
- `tempNotes` / `setTempNotes` state
- `onEditNotes`, `onCancelEditNotes`, `onSaveNotes`, `onTempNotesChange` callbacks

### Create shared hook

**File:** Create `apps/customer-web/src/hooks/use-cart-item-notes.ts`

Read `apps/customer-web/src/components/cart/cart-screen.tsx` lines ~28-29 and ~155-177 for the exact logic:

```typescript
import { useState, useCallback } from 'react';
import { useCartStore } from '@/store/cart-store';

export function useCartItemNotes() {
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<Record<string, string>>({});
  const updateNotes = useCartStore((s) => s.updateNotes);

  const onEditNotes = useCallback((itemId: string, currentNotes: string) => {
    setEditingNotes(itemId);
    setTempNotes((prev) => ({ ...prev, [itemId]: currentNotes }));
  }, []);

  const onCancelEditNotes = useCallback(() => {
    setEditingNotes(null);
  }, []);

  const onSaveNotes = useCallback((itemId: string) => {
    updateNotes(itemId, tempNotes[itemId] || '');
    setEditingNotes(null);
  }, [tempNotes, updateNotes]);

  const onTempNotesChange = useCallback((itemId: string, value: string) => {
    setTempNotes((prev) => ({ ...prev, [itemId]: value }));
  }, []);

  return {
    editingNotes,
    tempNotes,
    onEditNotes,
    onCancelEditNotes,
    onSaveNotes,
    onTempNotesChange,
  };
}
```

Read both source files to get the exact callback signatures and logic.

### Update consumers

**File:** `apps/customer-web/src/components/cart/cart-screen.tsx`
- Delete local state + callbacks for notes editing
- Use `const { editingNotes, tempNotes, ... } = useCartItemNotes();`
- Pass same props to `CartItemCard`

**File:** `apps/customer-web/src/components/cart/delivery-cart-screen.tsx`
- Same replacement

---

## Final Verification

```bash
pnpm type-check
pnpm test
pnpm check
```

Manual smoke test:
- Customer table landing → menu → add items → cart → place order (tests Steps 1, 3, 4)
- Customer delivery flow → cart → place order
- Order status page (tests Step 2 timeline)
- Menu item card dietary badges (tests Step 1)
- Menu item modal dietary badges

## Commit

Commit with message: `refactor(customer-web): extract shared components and hooks — DietaryBadges, OrderTimeline, usePlaceOrder, useCartItemNotes`
