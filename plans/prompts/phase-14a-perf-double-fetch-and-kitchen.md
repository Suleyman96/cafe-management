# Phase 14A: Performance — Fix Double-Fetching and Sequential Awaits

## Goal

Fix the two highest-impact performance issues:
1. Staff-web `tables/[id]/page.tsx` calls `refetchOrders()` after every mutation that already calls `invalidateOrdersAndTables()` — causing double network requests on every action
2. Mobile `KitchenDisplayScreen` loops over order items with sequential `await` instead of `Promise.all` — N items = N serial round-trips
3. Staff-web `tables/[id]/page.tsx` also has a sequential `await` loop for resolving waiter calls

## Important

- Read each file before editing
- Run `pnpm type-check && pnpm test` after changes
- These are hot-path changes in the most-used screens — test manually

---

## Step 1: Remove Redundant `refetchOrders()` Calls in Table Detail Page

**File:** `apps/staff-web/src/app/(staff)/tables/[id]/page.tsx`

The `refetchOrders` function comes from `useOrders` at ~line 72:
```typescript
const { data: orders, refetch: refetchOrders } = useOrders({ table_id: tableId });
```

Every mutation used on this page (`useUpdateOrderStatus`, `useUpdateOrderItemStatus`, `useCancelOrderItem`, etc.) already calls `invalidateOrdersAndTables(queryClient)` in its `onSettled` callback (defined in `apps/staff-web/src/hooks/use-orders-safe.ts`). This invalidation marks the `orders` query as stale and triggers a background refetch automatically.

The explicit `refetchOrders()` calls cause a **second** fetch for the same data.

### Fix: Remove all manual `refetchOrders()` calls

Find and remove `refetchOrders()` at these lines (exact line numbers may shift — search for `refetchOrders`):
- ~line 171 — inside `handleCreateOrderWithItems`
- ~line 229 — inside `handleAddItemsToOrder`
- ~line 247 — inside `handleStatusUpdate`
- ~line 295 — inside `handleItemStatusUpdate`
- ~line 318 — inside `handleCancelItem`
- ~line 344 — inside `handleCancelOrder`
- ~line 838 — inside `ItemTransferModal.onSuccess`

After removing all calls, check if `refetchOrders` is still used anywhere. If not, remove the destructuring:
```typescript
// Before:
const { data: orders, refetch: refetchOrders } = useOrders({ table_id: tableId });
// After:
const { data: orders } = useOrders({ table_id: tableId });
```

### Verify the invalidation path works

Read `apps/staff-web/src/hooks/use-orders-safe.ts` to confirm each mutation's `onSettled` calls `invalidateOrdersAndTables`. Specifically check:
- `useUpdateOrderStatus` — `onSettled`
- `useUpdateOrderItemStatus` — `onSettled`
- `useCancelOrderItem` — `onSuccess`
- `useCancelOrder` — `onSuccess` or `onSettled`
- `useAddOrderItems` — `onSettled`

If any mutation does NOT have invalidation in its `onSettled`/`onSuccess`, keep that specific `refetchOrders()` call.

---

## Step 2: Replace Sequential Awaits with `Promise.all` in Kitchen Display

**File:** `apps/mobile/src/screens/kitchen/KitchenDisplayScreen.tsx`

### 2a: `handleStartPreparing` (~lines 51-86)

Find the sequential loop:
```typescript
for (const item of items) {
  if (item.status === 'pending') {
    await updateItemStatus.mutateAsync({
      itemId: item.id,
      status: 'preparing',
    });
    succeeded++;
  }
}
```

Replace with `Promise.all`:
```typescript
const pendingItems = items.filter((item) => item.status === 'pending');
const results = await Promise.all(
  pendingItems.map((item) =>
    updateItemStatus.mutateAsync({ itemId: item.id, status: 'preparing' })
      .then(() => true)
      .catch(() => false)
  ),
);
const succeeded = results.filter(Boolean).length;
```

Read the full function to see what happens with `succeeded` count — it's used for a toast message. Preserve the count logic.

Also check: after the item updates, there's an order-level status update:
```typescript
await updateOrderStatus.mutateAsync({ orderId, status: 'preparing' });
```

This should remain sequential (after all items are updated). The `Promise.all` only applies to the item-level updates.

### 2b: `handleMarkAllReady` (~lines 100-134)

Same pattern. Find:
```typescript
for (const item of items) {
  if (item.status === 'pending' || item.status === 'preparing') {
    await updateItemStatus.mutateAsync({ itemId: item.id, status: 'ready' });
    succeeded++;
  }
}
```

Replace with:
```typescript
const qualifyingItems = items.filter(
  (item) => item.status === 'pending' || item.status === 'preparing',
);
const results = await Promise.all(
  qualifyingItems.map((item) =>
    updateItemStatus.mutateAsync({ itemId: item.id, status: 'ready' })
      .then(() => true)
      .catch(() => false)
  ),
);
const succeeded = results.filter(Boolean).length;
```

### 2c: `handleMarkAllServed` (~lines 136-171)

Same pattern. Find:
```typescript
for (const item of items) {
  if (item.status !== 'cancelled' && item.status !== 'served') {
    await updateItemStatus.mutateAsync({ itemId: item.id, status: 'served' });
    succeeded++;
  }
}
```

Replace with the same `Promise.all` approach.

---

## Step 3: Fix Sequential Waiter Call Resolution in Table Detail

**File:** `apps/staff-web/src/app/(staff)/tables/[id]/page.tsx`

Find the inline `onClick` handler for resolving waiter calls (~lines 412-421):
```typescript
onClick={async () => {
  try {
    for (const call of activeCallsForTable) {
      await resolveWaiterCall.mutateAsync({ callId: call.id });
    }
    toast.success(t('calls.resolved'));
  } catch (error) {
    Sentry.captureException(error);
    toast.error(t('calls.failedRespond'));
  }
}}
```

Two issues:
1. Sequential await loop (same as kitchen)
2. Inline async function recreated every render

### Fix:

Extract to a `useCallback` and use `Promise.all`:

```typescript
const handleResolveCalls = useCallback(async () => {
  try {
    await Promise.all(
      activeCallsForTable.map((call) =>
        resolveWaiterCall.mutateAsync({ callId: call.id }),
      ),
    );
    toast.success(t('calls.resolved'));
  } catch (error) {
    Sentry.captureException(error);
    toast.error(t('calls.failedRespond'));
  }
}, [activeCallsForTable, resolveWaiterCall, t]);
```

Then in JSX:
```tsx
onClick={handleResolveCalls}
```

---

## Final Verification

```bash
pnpm type-check
pnpm test
pnpm check
```

Manual testing:
- **Staff-web table detail:** Change order status, add items, cancel items — verify only ONE network request fires per action (check Network tab)
- **Mobile kitchen:** Tap "Start Preparing" on an order with 5+ items — verify all items update nearly simultaneously instead of one-by-one

## Commit

Commit with message: `perf: remove double-fetching in table detail, parallelize item status updates in kitchen`
