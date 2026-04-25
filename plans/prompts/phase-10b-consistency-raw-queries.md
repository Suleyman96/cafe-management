# Phase 10B: Consistency — Replace Raw Supabase Queries with `db` Wrapper

## Goal

The convention is: all database operations go through the `@gustri/api-client` wrapper (`db.orders.findAll()`, `db.tables.findById()`, etc.). Exception: Supabase Realtime channel subscriptions use the raw `supabase` client directly.

Several files bypass this convention with raw `supabase.from(...)` queries. Fix each one.

## Important

- Read each file before editing
- Run `pnpm type-check` after each file
- The raw queries may return slightly different shapes than the wrapper — verify the consuming code handles the wrapper's return shape
- Do NOT change Realtime channel subscription code (`supabase.channel(...)`) — those are intentionally raw

---

## Step 1: Fix Polling Fallback in `notification-provider.tsx`

**File:** `apps/staff-web/src/components/providers/notification-provider.tsx`

Find the polling fallback section (~lines 307-328, inside a `setInterval` callback). It has two raw queries:

```typescript
const { data: newCalls } = await supabase
  .from('waiter_calls')
  .select('id')
  .eq('tenant_id', tenantId)
  .gt('created_at', lastCheck.current)
  .eq('status', 'pending')
  .limit(1);

const { data: newOrders } = await supabase
  .from('orders')
  .select('id, status')
  .eq('tenant_id', tenantId)
  .gt('created_at', lastCheck.current)
  .limit(5);
```

Read the file to understand how `db` is accessed in this component. Check if there's already a `db` or `useDb()` available. The component likely has access to a Supabase wrapper through the provider context.

Replace with wrapper calls. The key challenge: these queries use `gt('created_at', lastCheck.current)` which may not be supported by the wrapper's `findAll` method.

**Option A (preferred):** If the wrapper's `findAll` supports the needed filters (status filter + date filter), use it:
```typescript
const newCalls = await db.waiterCalls.findAll('pending', { limit: 1 });
// Then filter client-side by created_at > lastCheck.current
```

**Option B:** If the wrapper doesn't support the `created_after` filter, add it to the wrapper's `findAll` options in `packages/api-client/src/wrapper/waiter-calls.ts`:
```typescript
findAll: async (status?, options?: { limit?, offset?, createdAfter?: string }) => {
  // ... add .gt('created_at', options.createdAfter) if provided
}
```

**Option C (simplest):** Keep the raw queries but add a comment explaining why the wrapper isn't used (e.g., narrow `select('id')` for performance in a polling loop). This is acceptable for a polling health-check that only needs to know "are there new rows?"

Read both the wrapper methods and the polling logic to decide which option is best. The polling only checks for existence (`.limit(1)` for calls, `.limit(5)` for orders), so the narrow select matters for performance.

If keeping the raw queries (Option C), add a comment:
```typescript
// Raw query intentional — narrow select('id') for polling performance, not a full findAll
```

---

## Step 2: Fix Server Component in `delivery/menu/page.tsx`

**File:** `apps/customer-web/src/app/delivery/menu/page.tsx`

This file has two problems:
1. Raw `supabase.from(...)` queries instead of the wrapper
2. Type mismatch: queries `menu_items` without joining categories, but result is typed as `MenuItemWithCategory[]`

Read the full file (~15 lines):
```typescript
const [{ data: categories }, { data: menuItems }] = await Promise.all([
  supabase.from('categories').select('*').eq('is_active', true).order('display_order'),
  supabase.from('menu_items').select('*').eq('is_available', true).order('display_order'),
]);
```

### Fix:

First, check if the `db` wrapper can be created in a server component. Read `apps/customer-web/src/lib/supabase-server.ts` to see how `createServerSupabase` works. Then check if `createSupabaseWrapper` from `@gustri/api-client` can wrap the server client.

If the wrapper can be used in server components:
```typescript
import { createServerSupabase } from '@/lib/supabase-server';
import { createSupabaseWrapper } from '@gustri/api-client';

export default async function DeliveryMenuPage() {
  const supabase = createServerSupabase();
  const db = createSupabaseWrapper(supabase);

  const [categories, menuItems] = await Promise.all([
    db.categories.findAll(),
    db.menuItems.findAll({ isAvailable: true }),
  ]);

  return (
    <DeliveryMenuContent
      initialCategories={categories.filter(c => c.is_active)}
      initialMenuItems={menuItems ?? []}
    />
  );
}
```

Read `packages/api-client/src/wrapper/menu.ts` to check:
- Does `menuItems.findAll()` support `isAvailable` filter?
- Does `menuItems.findAll()` join categories (returning `MenuItemWithCategory[]`)?
- Does `categories.findAll()` support `isActive` filter?

If `menuItems.findAll()` already joins categories, this also fixes the type mismatch (Problem 7 from the review). If it doesn't join, you'll need to add a category join to the wrapper or keep the raw query with the proper join:

```typescript
supabase.from('menu_items')
  .select('*, category:categories(*)')
  .eq('is_available', true)
  .order('display_order'),
```

### Also fix the inline import type in `menu-screen.tsx`:

**File:** `apps/customer-web/src/components/menu/menu-screen.tsx`

Find (~line 17-21):
```typescript
interface MenuScreenProps {
  tableId: string;
  initialCategories?: import('@gustri/database').Category[];
  initialMenuItems?: import('@gustri/database').MenuItemWithCategory[];
}
```

Replace inline `import()` types with normal imports:
```typescript
import type { Category, MenuItemWithCategory } from '@gustri/database';

interface MenuScreenProps {
  tableId: string;
  initialCategories?: Category[];
  initialMenuItems?: MenuItemWithCategory[];
}
```

---

## Step 3: Fix Mobile Realtime Callback Lookups

**File:** `apps/mobile/src/hooks/use-orders.ts`

Find the realtime callback (~lines 88-93):
```typescript
const { data } = await supabase
  .from('tables')
  .select('table_number')
  .eq('id', newRecord.table_id as string)
  .single();
const tableData = data as { table_number: string } | null;
```

This is a secondary CRUD lookup inside a realtime event callback. Replace with the wrapper:

```typescript
const tableData = await db.tables.findById(newRecord.table_id as string);
```

Check how `db` is available in this hook. Read the hook to see if it receives `db` as a parameter or accesses it through a context/import. If it uses `useDb()`, the wrapper is available. If it imports the raw `supabase` client, you'll need to also import/use `db`.

The `tableData` usage only needs `table_number`, so with the wrapper returning a full `Table` object:
```typescript
const tableData = await db.tables.findById(newRecord.table_id as string);
const tableNumber = tableData?.table_number;
```

Also add error handling — the current code silently fails if the query errors:
```typescript
try {
  const tableData = await db.tables.findById(newRecord.table_id as string);
  // ... notification logic using tableData.table_number
} catch {
  // Table lookup failed — still show notification without table number
}
```

**File:** `apps/mobile/src/hooks/use-waiter-calls.ts`

Find the same pattern (~lines 48-52). Apply identical fix:
```typescript
try {
  const tableData = await db.tables.findById(newRecord.table_id as string);
  // ... notification logic
} catch {
  // fallback
}
```

---

## Step 4: Fix Staff-Web `orders/[id]/page.tsx` Realtime Subscription

**File:** `apps/staff-web/src/app/(staff)/orders/[id]/page.tsx`

Find the manual realtime channel setup (~lines 114-158):
```typescript
useEffect(() => {
  const channel = supabase
    .channel(`order-${orderId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, () => { refetch(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items', filter: `order_id=eq.${orderId}` }, () => { refetch(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'order_payments', filter: `order_id=eq.${orderId}` }, () => { refetch(); })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [orderId, refetch]);
```

Every other page in staff-web uses `useRealtimeSync`. Replace with:

```typescript
useRealtimeSync(`order-detail-${orderId}`, [
  { table: 'orders', filter: `id=eq.${orderId}` },
  { table: 'order_items', filter: `order_id=eq.${orderId}` },
  { table: 'order_payments', filter: `order_id=eq.${orderId}` },
]);
```

Read `apps/staff-web/src/hooks/use-realtime-sync.ts` first to confirm:
- The hook signature accepts a channel name and table array with filters
- The `RealtimeTable` type supports a `filter` property
- The hook handles query invalidation internally (if so, remove the `refetch()` calls)
- The hook handles error/reconnection logic

If `useRealtimeSync` does query invalidation via `queryClient.invalidateQueries()`, check that the query keys used by this page's hooks match what `useRealtimeSync` invalidates. Read the hook to understand the invalidation pattern.

If `useRealtimeSync` doesn't support per-row filters (only `table` and `event`), you may need to extend it to accept a `filter` option, or keep the manual setup with a comment explaining why.

---

## Final Verification

```bash
pnpm type-check
pnpm test
pnpm check
```

## Commit

Commit with message: `refactor: replace raw supabase queries with db wrapper, fix delivery menu type mismatch`
