# Phase 11B: Error Handling — Fix Silently Swallowed Errors

## Goal

Several catch blocks only log to Sentry or console without showing the user any feedback. The user sees nothing — a spinner just stops. Fix by adding appropriate toast/alert notifications.

## Important

- Read each file before editing
- Match the existing toast pattern used in the same file or nearby handlers
- Run `pnpm type-check` after all changes
- Do NOT change any logic besides adding user-visible error feedback

---

## Step 1: Customer-Web — `order-status.tsx` Cancel Handlers

**File:** `apps/customer-web/src/components/order/order-status.tsx`

### 1a: `handleCancelOrder` (~lines 83-98)

Find the catch block:
```typescript
} catch (error) {
  Sentry.captureException(error);
}
```

Add a toast after Sentry. Look at `handleCallStaff` in the same file (~lines 66-81) for the exact toast pattern. It should use something like:
```typescript
} catch (error) {
  Sentry.captureException(error);
  toast.error(t('orderStatus.cancelFailed'));
}
```

Check what translation keys exist. Search for `cancelFailed` or `failedCancel` in the i18n files. If no key exists, use a generic one like `t('common.error')` or add the key.

### 1b: `handleCancelItem` (~lines 100-115)

Same fix — find the catch block and add a toast:
```typescript
} catch (error) {
  Sentry.captureException(error);
  toast.error(t('orderStatus.cancelItemFailed'));
}
```

---

## Step 2: Staff-Web — `split-payment-modal.tsx` Complete Order Handler

**File:** `apps/staff-web/src/components/modals/split-payment-modal.tsx`

Find `handleCompleteOrder` (~lines 237-252), specifically the catch block:
```typescript
} catch (error) {
  Sentry.captureException(error);
}
```

Look at `handlePayment` in the same file (~line 213) for the toast pattern. It uses `toast.error(message)`. Add:
```typescript
} catch (error) {
  Sentry.captureException(error);
  toast.error(t('payment.completeFailed'));
}
```

Check existing i18n keys or use a generic error key.

---

## Step 3: Customer-Web — `setTableContext` RPC Error Not Inspected

**File:** `apps/customer-web/src/lib/supabase.ts`

Find `setTableContext` (~lines 58-62):
```typescript
export async function setTableContext(qrToken: string) {
  await (supabase.rpc as Function)('set_table_context', { qr_token: qrToken });
}
```

The RPC returns `{ data, error }` but the result is not destructured. Fix by inspecting the error:

```typescript
export async function setTableContext(qrToken: string) {
  const { error } = await supabase.rpc('set_table_context', { qr_token: qrToken });
  if (error) {
    throw handleSupabaseError(error);
  }
}
```

Import `handleSupabaseError` from `@gustri/core` if not already imported.

Now check the caller. Read `apps/customer-web/src/components/table/table-landing.tsx` to find where `setTableContext` is called (~line 59):
```typescript
.catch(console.warn)
```

Replace with proper error handling:
```typescript
.catch((err: unknown) => {
  Sentry.captureException(err);
})
```

Import `Sentry` if not already imported. Note: don't add a toast here since this is a background context-setting call — the user will see a downstream error if queries fail without the context. But the error should be tracked.

---

## Step 4: Mobile — Realtime Callback Table Lookups

### 4a: `use-orders.ts`

**File:** `apps/mobile/src/hooks/use-orders.ts`

Find the INSERT callback handler (~lines 81-101). The table lookup has no error handling:
```typescript
const { data } = await supabase
  .from('tables')
  .select('table_number')
  .eq('id', newRecord.table_id as string)
  .single();
```

Wrap in try/catch. The notification should still work (with a fallback) even if the table lookup fails:

```typescript
let tableNumber = '';
try {
  const { data, error } = await supabase
    .from('tables')
    .select('table_number')
    .eq('id', newRecord.table_id as string)
    .single();
  if (!error && data) {
    tableNumber = (data as { table_number: string }).table_number;
  }
} catch {
  // Table lookup failed — continue with order number only
}

await notifyNewOrder(
  newRecord.order_number as string,
  tableNumber || (newRecord.order_number as string),
);
```

Read the existing code to match the exact notification call signature. The key change: the notification fires regardless of whether the table lookup succeeds, using a fallback value.

### 4b: `use-waiter-calls.ts`

**File:** `apps/mobile/src/hooks/use-waiter-calls.ts`

Find the INSERT callback handler (~lines 44-63). Same pattern — wrap the table lookup in try/catch:

```typescript
let tableNumber = '';
try {
  const { data, error } = await supabase
    .from('tables')
    .select('table_number')
    .eq('id', newRecord.table_id as string)
    .single();
  if (!error && data) {
    tableNumber = (data as { table_number: string }).table_number;
  }
} catch {
  // Table lookup failed — continue with call type only
}

if (tableNumber) {
  await notifyWaiterCall(
    tableNumber,
    (newRecord.call_type as string) ?? 'assistance',
  );
}
```

Read the existing code for the exact callback structure.

---

## Step 5: Mobile — `auth.ts` `updateLastLogin` Blocking Login

**File:** `apps/mobile/src/lib/auth.ts`

Find the `login` function (~lines 9-24). The `updateLastLogin` call at ~line 21 can block login if it throws:

```typescript
const staff = (await db.staff.findByAuthId(data.user.id)) as Staff;
await db.staff.updateLastLogin(staff.id);  // <-- can throw and block login
return { user: data.user, staff };
```

Make `updateLastLogin` fire-and-forget — login should succeed even if the timestamp update fails:

```typescript
const staff = (await db.staff.findByAuthId(data.user.id)) as Staff;

// Fire-and-forget — don't block login for a non-critical timestamp update
db.staff.updateLastLogin(staff.id).catch(() => {});

return { user: data.user, staff };
```

---

## Step 6: Mobile — `sound.ts` Double Unload Fix

**File:** `apps/mobile/src/lib/sound.ts`

Read the full file. The issue: `setupSounds` assigns the same `Audio.Sound` object to both `newOrderSound` and `waiterCallSound` (~line 17: `waiterCallSound = orderSound`). Then `cleanupSounds` calls `unloadAsync()` on both — unloading the same object twice.

Fix `cleanupSounds` (~lines 46-53):

```typescript
export async function cleanupSounds() {
  try {
    if (newOrderSound) {
      await newOrderSound.unloadAsync();
    }
  } catch {
    // Sound may already be unloaded
  }

  // Only unload waiterCallSound if it's a different object than newOrderSound
  if (waiterCallSound && waiterCallSound !== newOrderSound) {
    try {
      await waiterCallSound.unloadAsync();
    } catch {
      // Sound may already be unloaded
    }
  }

  newOrderSound = null;
  waiterCallSound = null;
  soundsAvailable = false;
}
```

Key changes:
1. Add identity check `waiterCallSound !== newOrderSound` to prevent double unload
2. Wrap each unload in try/catch for resilience
3. Set refs to `null` after cleanup (prevents stale reference usage)
4. Set `soundsAvailable = false` to prevent play attempts on dead objects

---

## Step 7: Staff-Web — Reports Page Role Check Order

**File:** `apps/staff-web/src/app/(staff)/reports/page.tsx`

Find the loading/role check (~lines 416-432):
```typescript
const loading = revenueLoading || itemsLoading || ...;

if (loading) {
  return <LoadingSpinner />;
}

if (currentUser?.role !== 'owner') {
  return <p>{t('reports.ownerAccessRequired')}</p>;
}
```

The role check runs AFTER data loads. Non-owners trigger 5 expensive data fetches (revenue, items, expenses, waste, staff performance) before being denied.

Fix: move the role check BEFORE the loading check:

```typescript
if (currentUser?.role !== 'owner') {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-500">{t('reports.ownerAccessRequired')}</p>
    </div>
  );
}

const loading = revenueLoading || itemsLoading || ...;

if (loading) {
  return (
    <div className="flex items-center justify-center h-screen">
      <LoadingSpinner />
    </div>
  );
}
```

Additionally, find the 5 data-fetching hooks earlier in the component. Add `enabled` guards so they never fire for non-owners:

```typescript
const isOwner = currentUser?.role === 'owner';

const { data: revenue, isLoading: revenueLoading } = useRevenueSummary({
  // ... existing params
  enabled: isOwner,  // <-- add this
});
```

Read the hook signatures to confirm they accept an `enabled` option. If they use React Query's `useQuery` internally, they should. If they don't expose `enabled`, the role check before loading is still sufficient — the data fetches still run but the non-owner user won't see the results.

---

## Step 8: Customer-Web — Delivery Order Empty Token

**File:** `apps/customer-web/src/app/delivery/order/[orderId]/page.tsx`

Find (~lines 12-13):
```typescript
return <DeliveryOrderStatus orderId={params.orderId} accessToken={searchParams.token ?? ''} />;
```

When `token` is missing, `?? ''` passes an empty string. The hook has `enabled: !!accessToken` which is `false` for `""`, so the query never fires and the user sees "Order not found" with no explanation.

Fix: pass `undefined` instead and let the component handle the missing-token case:

```typescript
return <DeliveryOrderStatus orderId={params.orderId} accessToken={searchParams.token} />;
```

Then in the `DeliveryOrderStatus` component, add a missing-token check before the "not found" fallback. Read the component to find where it renders "not found" and add:

```typescript
if (!accessToken) {
  return (
    <div className="...">
      <p>{t('delivery.missingAccessToken')}</p>
    </div>
  );
}
```

Check if this translation key exists. If not, use a descriptive fallback or add the key.

---

## Final Verification

```bash
pnpm type-check
pnpm test
pnpm check
```

## Commit

Commit with message: `fix: add user-visible error feedback for silently swallowed errors across all apps`
