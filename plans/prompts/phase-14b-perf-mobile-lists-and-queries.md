# Phase 14B: Performance — Mobile List Optimization and Unfiltered Queries

## Goal

Fix mobile performance issues:
1. `TablesListScreen` fetches ALL orders unfiltered just to count active ones per table
2. All 5 `FlashList` usages are missing `estimatedItemSize` (required for optimal layout)
3. `AddItemsScreen` uses `Dimensions.get` at module level (stale on orientation change)
4. `ReportsScreen` recreates `PRESETS` array on every render
5. Kitchen page `_currentTime` state forces unnecessary full re-renders

## Important

- Read each file before editing
- Run `pnpm type-check` after each step
- Test on a device/simulator after changes to verify list performance

---

## Step 1: Filter Orders by Active Status in `TablesListScreen`

**File:** `apps/mobile/src/screens/tables/TablesListScreen.tsx`

Find ~line 27:
```typescript
const { data: orders } = useOrders();
```

This fetches ALL orders — hundreds of historical records — just to client-side filter by table and active status at ~lines 42-64.

### Fix: Pass active status filter to the hook

Read how `useOrders` works — check `apps/mobile/src/hooks/use-orders.ts` or the shared hook from `@gustri/queries`. See if it accepts a `statuses` filter parameter.

If the hook accepts filters:
```typescript
const { data: orders } = useOrders({
  statuses: [...ACTIVE_ORDER_STATUSES],
});
```

Import `ACTIVE_ORDER_STATUSES` from `@gustri/core` (added in Phase 9A). If Phase 9A hasn't been completed, use the inline array:
```typescript
const { data: orders } = useOrders({
  statuses: ['pending_approval', 'new', 'preparing', 'ready', 'served'],
});
```

If the hook does NOT accept a `statuses` filter, check the underlying `db.orders.findAll()` in `packages/api-client/src/wrapper/orders.ts` — it accepts `{ statuses?: string[] }`. The mobile hook should pass this through. You may need to update the mobile `useOrders` hook to accept and forward the filter.

Read the `useMemo` that processes orders (~lines 42-64). After adding the server-side filter, the client-side `ACTIVE_ORDER_STATUSES` filter is still fine as a safety net but the heavy lifting is done server-side.

---

## Step 2: Add `estimatedItemSize` to All FlashList Instances

**FlashList requires `estimatedItemSize` for optimal performance.** Without it, FlashList must measure every item on first render and logs a warning.

For each file, read the component to estimate the item height, then add the prop:

### 2a: `apps/mobile/src/screens/kitchen/KitchenDisplayScreen.tsx` — ~line 209
Read the `KitchenOrderCard` component to estimate its height. Kitchen cards are typically tall (~200-250px). Add:
```tsx
<FlashList
  estimatedItemSize={220}
  ...
/>
```

### 2b: `apps/mobile/src/screens/tables/TablesListScreen.tsx` — ~line 71
Table cards are typically medium-height (~120px). Add:
```tsx
<FlashList
  estimatedItemSize={120}
  ...
/>
```

### 2c: `apps/mobile/src/screens/orders/OrdersListScreen.tsx` — ~line 99
Order list items are typically ~100px. Add:
```tsx
<FlashList
  estimatedItemSize={100}
  ...
/>
```

### 2d: `apps/mobile/src/screens/delivery/DeliveryListScreen.tsx` — ~line 193
Delivery cards ~120px. Add:
```tsx
<FlashList
  estimatedItemSize={120}
  ...
/>
```

### 2e: `apps/mobile/src/screens/calls/WaiterCallsScreen.tsx` — ~line 62
Call items ~80px. Add:
```tsx
<FlashList
  estimatedItemSize={80}
  ...
/>
```

For each: read the `renderItem` component or its StyleSheet to get a more accurate height estimate. The value doesn't need to be exact — it's a hint for pre-allocation.

---

## Step 3: Replace `Dimensions.get` with `useWindowDimensions`

**File:** `apps/mobile/src/screens/orders/AddItemsScreen.tsx`

Find ~line 306 (at module scope, outside the component):
```typescript
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
```

And the StyleSheet that uses it at ~line 311:
```typescript
menuSectionHalf: { height: SCREEN_HEIGHT * 0.45, flex: 0 },
```

### Fix:

Move the dimension reading inside the component using the hook:

```typescript
import { useWindowDimensions } from 'react-native';

export default function AddItemsScreen(...) {
  const { height: screenHeight } = useWindowDimensions();
  
  // ... rest of component
}
```

The StyleSheet can't use a dynamic value. Convert the affected style to an inline style or use `useMemo`:

```typescript
const dynamicStyles = useMemo(() => ({
  menuSectionHalf: { height: screenHeight * 0.45, flex: 0 as const },
}), [screenHeight]);
```

Then in JSX, replace `styles.menuSectionHalf` with `dynamicStyles.menuSectionHalf`.

Keep the rest of the StyleSheet static — only extract the dimension-dependent styles.

Remove the module-level `Dimensions.get` line.

---

## Step 4: Memoize `PRESETS` in ReportsScreen

**File:** `apps/mobile/src/screens/reports/ReportsScreen.tsx`

Find ~lines 34-39:
```typescript
const PRESETS = [
  { label: t('reports.today'), days: 0 },
  { label: t('reports.7days'), days: 7 },
  { label: t('reports.30days'), days: 30 },
  { label: t('reports.thisMonth'), days: -1 },
];
```

This is inside the component body and creates a new array on every render.

### Fix:

Wrap in `useMemo`:
```typescript
const PRESETS = useMemo(() => [
  { label: t('reports.today'), days: 0 },
  { label: t('reports.7days'), days: 7 },
  { label: t('reports.30days'), days: 30 },
  { label: t('reports.thisMonth'), days: -1 },
], [t]);
```

The `t` function is stable from `useTranslation` (it's memoized internally by i18next), so this `useMemo` will effectively only recompute when the language changes.

---

## Step 5: Fix Kitchen Page `_currentTime` Re-render Trigger

**File:** `apps/staff-web/src/app/(staff)/kitchen/page.tsx`

Find ~lines 31 and 36-41:
```typescript
const [_currentTime, setCurrentTime] = useState(new Date());

useEffect(() => {
  const interval = setInterval(() => {
    setCurrentTime(new Date());
  }, 60000);
  return () => clearInterval(interval);
}, []);
```

The state `_currentTime` is never read (prefixed with `_`). Its only purpose is to force a re-render every 60 seconds to refresh elapsed time displays. But it causes a FULL re-render of the entire kitchen page including all order cards.

### Fix: Use `useReducer` with a counter for clarity, or keep the interval but reduce its blast radius

**Option A (simplest — keep the pattern but make it explicit):**
```typescript
const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

useEffect(() => {
  const interval = setInterval(forceUpdate, 60000);
  return () => clearInterval(interval);
}, []);
```

This is functionally identical but semantically clearer — no unused `_currentTime` variable.

**Option B (better performance — only re-render time displays):**

Extract the elapsed time display into a self-contained component that manages its own interval:
```typescript
function ElapsedTime({ since }: { since: string }) {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  
  useEffect(() => {
    const interval = setInterval(forceUpdate, 60000);
    return () => clearInterval(interval);
  }, []);

  return <span>{calculateElapsedTime(since)}</span>;
}
```

This way only the small `ElapsedTime` components re-render every minute, not the entire kitchen grid. But this requires finding all places where elapsed time is displayed and wrapping them.

Option A is the quick fix. Option B is ideal for a busy kitchen with many order cards. Choose based on the number of cards typically displayed.

---

## Final Verification

```bash
pnpm type-check
pnpm test
pnpm check
```

Manual testing:
- **Mobile tables screen:** Verify table cards show correct active order counts (filtered data)
- **Mobile lists:** Verify no FlashList warnings in console about missing `estimatedItemSize`
- **Mobile add items:** Rotate device — verify layout adjusts
- **Staff-web kitchen:** Verify elapsed times still update every minute

## Commit

Commit with message: `perf: filter orders query, add FlashList estimatedItemSize, fix stale Dimensions, optimize kitchen re-renders`
