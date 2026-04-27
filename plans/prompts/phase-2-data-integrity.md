# Phase 2 Prompt: Data Integrity Fixes (SCALE-3 + SCALE-4 + SCALE-5)

Copy everything below the line and paste it as the prompt for a new Claude Code session.

---

## Task

Implement Phase 2 (SCALE-3, SCALE-4, SCALE-5) from `plans/07-SCALING-AND-ARCHITECTURE-fixes.md`. Read that file for full context, but this prompt contains the verified details you need. Do NOT blindly copy the SQL/code from the plan — use the verified details below.

## What you're fixing and why

Three data integrity problems:
1. **Race condition**: When a staff member updates an item status, client-side JS calculates the new order status from potentially stale local state, then fires a second mutation. Two staff members doing this simultaneously can produce incorrect order status.
2. **Silent failures**: `cleanupEmptyOrders()` cancels orders then tries to free tables in separate queries. If the table update fails, the order is cancelled but the table stays "occupied" forever.
3. **Invisible mutation errors**: All mutation hooks accept `onError` as optional. Many call sites don't provide one. Failed mutations vanish silently.

---

## SCALE-3: Atomic order status transitions

### Goal
Move order status calculation from client-side JS into a database trigger. When an item status changes, the trigger automatically syncs the parent order status. This eliminates the race condition because the database handles it atomically.

### Current state (verified)

**The race condition** is in `apps/staff-web/src/app/(staff)/orders/[id]/page.tsx`, function `handleItemStatusUpdate` at lines 288-333:

```typescript
// Line 290-293: First mutation — update item status
await updateItemStatus.mutateAsync({
  itemId,
  status: newStatus as 'pending' | 'preparing' | 'ready' | 'served',
});

// Lines 296-327: Then calculate order status from LOCAL state (may be stale!)
if (order?.order_items) {
  const updatedItems = order.order_items.map((item: OrderItem) =>
    item.id === itemId ? { ...item, status: newStatus } : item,
  );
  // ... filter non-cancelled, check allServed, allReadyOrServed, anyPreparing
  // ... fire second mutation:
  await updateOrderStatus.mutateAsync({ orderId, status: targetStatus });
}
```

Between the two mutations, another user could change another item, making the local `order.order_items` stale.

**Existing triggers on orders/order_items** (from baseline migration):
- `cascade_order_status_trigger` — AFTER UPDATE OF `status` ON `orders`: cascades order status DOWN to items (e.g., order→cancelled means items→cancelled). Defined at baseline.sql line 2142, function at lines 142-183.
- `recalculate_on_item_insert/update/delete` — AFTER changes on `order_items`: calls `recalculate_order_total()` to recalc subtotal/tax/total. Defined at baseline.sql lines 2158-2166.
- `update_table_on_order` — AFTER INSERT/UPDATE on `orders`: updates table status. Defined at baseline.sql line 2210.
- `recalculate_on_discount_change` — AFTER UPDATE of discount fields on `orders`. Defined at baseline.sql line 2154.

**There is NO existing trigger that syncs item status UP to order status.** This is currently done entirely client-side in the page component.

**The mutation hooks** (verified in `packages/queries/src/mutations/use-order-mutations.ts`):
- `useUpdateOrderItemStatus` (line 95): calls `db.orderItems.updateStatus(id, status)`, then `invalidateOrders(queryClient)`
- `useUpdateOrderStatus` (line 7): calls `db.orders.updateStatus(id, status)`, then `invalidateOrdersAndTables(queryClient)`

### Implementation steps

**Step 1** — Create migration `supabase/migrations/YYYYMMDD_sync_order_status_from_items.sql`:

```sql
-- Sync order status UP from items when an item status changes.
-- This replaces the client-side logic in orders/[id]/page.tsx lines 296-327.
CREATE OR REPLACE FUNCTION public.sync_order_status_from_items()
RETURNS TRIGGER AS $$
DECLARE
  v_current_status TEXT;
  v_all_served BOOLEAN;
  v_all_ready_or_served BOOLEAN;
  v_any_preparing BOOLEAN;
  v_non_cancelled_count INT;
  v_target_status TEXT;
BEGIN
  -- Get current order status
  SELECT status INTO v_current_status
  FROM public.orders
  WHERE id = NEW.order_id;

  -- Don't sync if order is in a terminal or non-syncable state
  IF v_current_status IN ('closed', 'cancelled', 'delivered', 'out_for_delivery', 'pending_approval') THEN
    RETURN NEW;
  END IF;

  -- Aggregate item statuses (exclude cancelled items)
  SELECT
    COUNT(*),
    BOOL_AND(status = 'served'),
    BOOL_AND(status IN ('ready', 'served')),
    BOOL_OR(status = 'preparing')
  INTO v_non_cancelled_count, v_all_served, v_all_ready_or_served, v_any_preparing
  FROM public.order_items
  WHERE order_id = NEW.order_id
    AND status != 'cancelled';

  -- No non-cancelled items, nothing to sync
  IF v_non_cancelled_count = 0 THEN
    RETURN NEW;
  END IF;

  -- Determine target status (same logic as the client-side code)
  v_target_status := NULL;
  IF v_all_served AND v_current_status != 'served' THEN
    v_target_status := 'served';
  ELSIF v_all_ready_or_served AND NOT v_all_served AND v_current_status != 'ready' THEN
    v_target_status := 'ready';
  ELSIF v_any_preparing AND v_current_status = 'new' THEN
    v_target_status := 'preparing';
  END IF;

  -- Update order status if needed
  IF v_target_status IS NOT NULL THEN
    UPDATE public.orders
    SET status = v_target_status, updated_at = NOW()
    WHERE id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Trigger fires after item status changes
DROP TRIGGER IF EXISTS trg_sync_order_status_from_items ON public.order_items;
CREATE TRIGGER trg_sync_order_status_from_items
  AFTER UPDATE OF status ON public.order_items
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sync_order_status_from_items();
```

**Important interaction to verify:** The `cascade_order_status_trigger` on orders fires when order status changes and cascades DOWN to items. The new trigger fires when item status changes and syncs UP to order. This could cause a loop:
- Item→served triggers `sync_order_status_from_items` → sets order→served
- Order→served triggers `cascade_order_status_to_items` → tries to set items→served
- Items already served → `cascade_order_status_to_items` has no effect (only updates items with status IN ('pending','preparing','ready'))

This is safe because `cascade_order_status_to_items` only updates items that are in earlier statuses. Items already at the target status won't be changed, so the trigger won't re-fire. But verify by testing.

**Step 2** — Remove client-side order status sync from `apps/staff-web/src/app/(staff)/orders/[id]/page.tsx`.

Replace the `handleItemStatusUpdate` function (lines 288-333) with:

```typescript
const handleItemStatusUpdate = async (itemId: string, newStatus: string) => {
  try {
    await updateItemStatus.mutateAsync({
      itemId,
      status: newStatus as 'pending' | 'preparing' | 'ready' | 'served',
    });
    setOpenItemMenu(null);
    // Order status is now synced by database trigger (trg_sync_order_status_from_items).
    // Realtime subscription + invalidateOrders will pick up the change.
    toast.success(t('orders.itemStatusUpdated', { status: newStatus }));
  } catch (_error) {
    toast.error(t('orders.failedUpdateItemStatus'));
  }
};
```

This removes lines 296-327 entirely. The `updateOrderStatus` call within this function is no longer needed.

**Step 3** — Verify that `useUpdateOrderItemStatus` in `packages/queries/src/mutations/use-order-mutations.ts` (line 95) already calls `invalidateOrders(queryClient)` on success. It does (line 102). This means the UI will refetch the order after the item update, picking up the trigger-applied order status change.

**Step 4** — The `useUpdateOrderStatus` hook and `updateOrderStatus` variable (line 102 of the page) should remain — it's still used by `handleStatusUpdate` (line 336) for manual order status changes (approve, close, etc.). Only remove the `updateOrderStatus` call from WITHIN `handleItemStatusUpdate`.

### Verification
- Open the same order in two browser tabs
- In tab 1: set item A to "preparing"
- In tab 2: set item B to "ready"
- Both tabs should show correct order status (should be "preparing" since not all items are ready)
- Set all items to "served" → order status should automatically become "served"
- Run `pnpm test && pnpm type-check && pnpm check`

---

## SCALE-4: Fix silent failures that orphan data

### Goal
Make `cleanupEmptyOrders()` atomic so that if the table update fails, the order cancellation is also rolled back. Also fix fire-and-forget `.catch(console.warn)` calls in `use-auth.ts` to log to Sentry.

### Current state (verified)

**cleanupEmptyOrders** in `packages/api-client/src/wrapper/orders.ts` lines 535-585:
- Line 555-559: Cancels order (UPDATE orders SET status = 'cancelled')
- Line 561: If cancel succeeded, pushes to `cancelledIds`
- Lines 565-578: Then checks for other active orders on the same table, and if none, frees the table
- Line 575-578: The table update has NO error handling — if it fails, the order is already cancelled but the table stays occupied

**use-auth.ts** in `apps/staff-web/src/hooks/use-auth.ts`:
- Line 17: `db.staff.updateLastLogin(staffId).catch(console.warn)` — silent
- Line 24: `db.schedules.markInProgress(schedule.id, ...).catch(console.warn)` — silent
- Line 28: Schedule lookup `.catch(console.warn)` — silent
- Line 47: `loadAndSwitchLanguage(...).catch(console.warn)` — acceptable (UI preference, not critical)
- Line 52-53: `db.tenants.getCurrent().catch(console.warn)` — silent
- Sentry IS already imported at line 4: `import * as Sentry from '@sentry/nextjs'`

### Implementation steps

**Step 1** — Create migration `supabase/migrations/YYYYMMDD_cleanup_empty_orders_function.sql`:

```sql
-- Atomic cleanup of empty orders + table freeing.
-- Replaces the multi-step JS logic in packages/api-client/src/wrapper/orders.ts.
CREATE OR REPLACE FUNCTION public.cleanup_empty_orders(
  p_tenant_id UUID,
  p_older_than_minutes INT DEFAULT 2
)
RETURNS TABLE(cancelled_order_id UUID, freed_table_id UUID) AS $$
DECLARE
  r RECORD;
  v_other_active INT;
BEGIN
  FOR r IN
    SELECT o.id AS order_id, o.table_id
    FROM public.orders o
    LEFT JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.tenant_id = p_tenant_id
      AND o.status IN ('new', 'pending_approval')
      AND o.created_at < NOW() - (p_older_than_minutes || ' minutes')::INTERVAL
    GROUP BY o.id, o.table_id
    HAVING COUNT(oi.id) = 0
  LOOP
    -- Cancel the order
    UPDATE public.orders
    SET status = 'cancelled',
        internal_notes = 'Auto-cancelled: empty order',
        updated_at = NOW()
    WHERE id = r.order_id;

    cancelled_order_id := r.order_id;
    freed_table_id := NULL;

    -- Free the table if no other active orders on it
    IF r.table_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_other_active
      FROM public.orders
      WHERE table_id = r.table_id
        AND id != r.order_id
        AND status IN ('pending_approval', 'new', 'preparing', 'ready', 'served');

      IF v_other_active = 0 THEN
        UPDATE public.tables
        SET status = 'free', occupied_at = NULL
        WHERE id = r.table_id;

        freed_table_id := r.table_id;
      END IF;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';
```

This runs as a single transaction — if the table update fails, the entire function rolls back.

**Step 2** — Replace the JS implementation in `packages/api-client/src/wrapper/orders.ts`. Replace the `cleanupEmptyOrders` method (lines 535-585) with an RPC call:

```typescript
cleanupEmptyOrders: async (olderThanMinutes = 2) => {
  const { data, error } = await ctx.anyClient.rpc('cleanup_empty_orders', {
    p_tenant_id: /* need tenant_id — see note below */,
    p_older_than_minutes: olderThanMinutes,
  });

  if (error) throw handleSupabaseError(error);
  return (data || []).map((row: { cancelled_order_id: string }) => row.cancelled_order_id);
},
```

**Important:** The current `cleanupEmptyOrders` doesn't take a tenant_id — it relies on RLS to scope queries. The RPC function uses `SECURITY DEFINER` which bypasses RLS, so it needs an explicit tenant_id parameter. Two options:
- Option A: Add `tenantId` to `WrapperContext` (check if it's already there or obtainable)
- Option B: Make the function `SECURITY INVOKER` instead, so RLS still applies. Then remove the `p_tenant_id` parameter and the `WHERE o.tenant_id = p_tenant_id` clause.

Check which approach other RPC functions in this codebase use. Look at `packages/api-client/src/wrapper/rpc.ts` for precedent. If other RPCs pass tenant_id explicitly, do the same. If they rely on RLS, use Option B.

**Step 3** — Fix fire-and-forget calls in `apps/staff-web/src/hooks/use-auth.ts`. Replace `.catch(console.warn)` with `.catch(err => Sentry.captureException(err, { tags: { context: '...' } }))` for the important ones:

Line 17 — `updateLastLogin`:
```typescript
db.staff.updateLastLogin(staffId).catch((err) => {
  Sentry.captureException(err, { tags: { context: 'post-login-update-last-login' } });
});
```

Lines 20-28 — schedule marking:
```typescript
(db.schedules.findByStaffAndDate(staffId, today) as Promise<StaffSchedule[]>)
  .then((schedules) => {
    for (const schedule of schedules) {
      if (schedule.status === 'scheduled') {
        db.schedules.markInProgress(schedule.id, new Date().toISOString()).catch((err) => {
          Sentry.captureException(err, { tags: { context: 'post-login-mark-schedule' } });
        });
      }
    }
  })
  .catch((err) => {
    Sentry.captureException(err, { tags: { context: 'post-login-find-schedules' } });
  });
```

Lines 50-53 — tenant plan fetch:
```typescript
db.tenants
  .getCurrent()
  .then((tenant) => setTenantPlan(tenant.plan as any))
  .catch((err) => {
    Sentry.captureException(err, { tags: { context: 'post-login-tenant-plan' } });
  });
```

Line 47 — language loading: Keep as `.catch(console.warn)` — this is a UI preference, not critical data. Sentry noise is not worth it here.

### Verification
- Run `pnpm test && pnpm type-check && pnpm check`
- Test cleanup: create an order with no items, wait 2+ minutes, trigger cleanup, verify both the order is cancelled AND the table is freed
- Temporarily make the table update fail (e.g., add a constraint), verify the order is NOT cancelled (transaction rollback)
- Check Sentry test mode: verify post-login errors would be captured

---

## SCALE-5: Global mutation error handler

### Goal
Add a default `onError` handler to React Query's `QueryClient` so that mutations without an explicit `onError` callback still show a toast and report to Sentry. This is a safety net — individual mutations can still override.

### Current state (verified)

**providers.tsx** (`apps/staff-web/src/app/providers.tsx`):
- Lines 30-43: `QueryClient` created with only `queries` defaults — NO `mutations` defaults
- Line 52: `<Toaster position="bottom-right" />` is rendered (sonner)
- Sentry is NOT imported in this file currently
- `toast` from sonner is NOT imported in this file currently (but `Toaster` component is)

**Mutation hooks pattern** (all 14 files in `packages/queries/src/mutations/`):
- Every mutation hook accepts `options?: MutationCallbacks`
- `MutationCallbacks` type (from `packages/queries/src/mutations/types.ts`): `{ onError?: (error: Error) => void }`
- Every hook sets `onError: options?.onError` — which is `undefined` when no callback provided
- When `onError` is undefined, React Query's default behavior is to do nothing (error is only in the query state)

**Error classes** (from `packages/core/src/errors.ts`):
- `AppError` base class with `message`, `code`, `statusCode`
- `isAppError(error)` type guard
- Exported from `@gustri/core`

### Implementation steps

**Step 1** — Update `apps/staff-web/src/app/providers.tsx` to add a global mutation error handler:

```typescript
'use client';

import { isAppError } from '@gustri/core';
import { I18nextProvider, i18n } from '@gustri/i18n';
import { DbProvider } from '@gustri/queries';
import * as Sentry from '@sentry/nextjs';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Toaster, toast } from 'sonner';
import '@/lib/i18n';
import { db } from '@/lib/supabase/wrapped-client';
```

Then add `mutations` to the default options:

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      onError: (error) => {
        Sentry.captureException(error);
        toast.error(
          isAppError(error) ? error.message : 'An unexpected error occurred',
        );
      },
    },
  },
}),
```

**Step 2** — That's it. This is a one-file change. The global `onError` acts as a fallback. When a mutation hook provides its own `onError` via `MutationCallbacks`, React Query calls BOTH the mutation-level and the global handler. This means:
- Mutations with custom `onError` (e.g., showing a specific toast) will show BOTH the custom toast AND the global toast.

To avoid double-toasting, there are two approaches:
- **Option A (simpler):** Accept the double toast. The global one is generic ("An unexpected error occurred"), the custom one is specific. Users see both — not ideal but not harmful.
- **Option B (cleaner):** Change the global handler to only fire if no mutation-level handler was set. React Query doesn't support this natively, but you can use the `meta` field:

```typescript
// In the global handler:
mutations: {
  onError: (error, _variables, _context, mutation) => {
    // Skip if mutation has its own onError (set via options)
    if (mutation.options.onError) return;
    Sentry.captureException(error);
    toast.error(isAppError(error) ? error.message : 'An unexpected error occurred');
  },
},
```

Wait — React Query's global `onError` for mutations has a different signature. Check the TanStack React Query v5 docs. In v5, the global `mutationCache` `onError` callback receives `(error, variables, context, mutation)`. The `defaultOptions.mutations.onError` only receives `(error, variables, context)`.

**Correct approach for v5:** Use `MutationCache` instead of `defaultOptions`:

```typescript
new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Only fire global handler if no mutation-level onError is set
      if (!mutation.options.onError) {
        Sentry.captureException(error);
        toast.error(
          isAppError(error) ? error.message : 'An unexpected error occurred',
        );
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
}),
```

Add `MutationCache` to the import from `@tanstack/react-query`:
```typescript
import { MutationCache, QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
```

**Step 3** — Verify the import `isAppError` is available from `@gustri/core`. It is (confirmed in `packages/core/src/errors.ts` line 59).

### Verification
- Run `pnpm type-check && pnpm check`
- Temporarily break an API endpoint (e.g., stop Supabase), trigger a mutation that has NO custom onError (e.g., update a menu item), verify:
  - A toast appears with the error message
  - Sentry receives the error
- Trigger a mutation that HAS a custom onError (e.g., in the order detail page), verify:
  - Only the custom toast appears, NOT the global one
  - Sentry still receives the error (from the custom handler if it calls Sentry, otherwise not — acceptable)
- Run `pnpm test` — all pass

---

## General rules

- Follow existing code patterns exactly — look at how other wrappers, hooks, and pages are structured before writing new code
- Use Biome formatting: 2-space indent, single quotes, trailing commas. Run `pnpm check:fix` before considering done
- Migration filenames: use format `YYYYMMDD000001_description.sql` with today's date. Check existing migrations in `supabase/migrations/` for the latest date prefix to avoid collisions
- Do NOT add comments, docstrings, or type annotations beyond what's needed
- Do NOT refactor surrounding code — only change what's needed for these three issues
- Run `pnpm test && pnpm type-check && pnpm check` at the end to verify everything passes
