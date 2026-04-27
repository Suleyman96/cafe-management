# Phase 9C: Deduplicate Code — Mobile Consumers + Theme Colors

## Goal

Replace duplicated constants in `apps/mobile/` with imports from `@gustri/core`, unify `ROLE_COLORS`, add a `useCurrencySymbol` hook, and centralize inline hex color codes through the theme.

## Prerequisites

- Phase 9A complete (shared constants exist in `@gustri/core`)

## Important

- Read each file before editing
- Run `pnpm type-check` after every 3-4 files
- Run `pnpm test` at the end

---

## Step 1: Replace `STATUS_LABEL_KEYS` (4 files)

Import `ORDER_STATUS_KEYS` from `@gustri/core` and replace the local `STATUS_LABEL_KEYS` in each file.

Files:
1. `apps/mobile/src/screens/orders/OrdersListScreen.tsx` (~lines 37-47) — full set, direct replacement
2. `apps/mobile/src/screens/delivery/DeliveryListScreen.tsx` (~lines 35-43) — subset (missing `served`, `closed`). Since `ORDER_STATUS_KEYS` has all keys, the subset usage still works — `.map()` or lookup will just return `undefined` for unused keys, which is fine if the rendering handles it. Read the usage to confirm.
3. `apps/mobile/src/screens/takeout/TakeoutListScreen.tsx` (~lines 24-31) — subset
4. `apps/mobile/src/components/ui/StatusBadge.tsx` (~lines 18-54) — this may use a different structure (nested with colors). Read the file to determine if `ORDER_STATUS_KEYS` is a direct replacement or if this component needs its own mapping.

For each: delete local definition, add `import { ORDER_STATUS_KEYS } from '@gustri/core';`, rename usages from `STATUS_LABEL_KEYS` to `ORDER_STATUS_KEYS`.

---

## Step 2: Replace `ACTIVE_STATUSES` (4 files)

Import the appropriate constant from `@gustri/core`:

1. `apps/mobile/src/screens/tables/TablesListScreen.tsx` (~line 16) — uses `['pending_approval', 'new', 'preparing', 'ready', 'served']` → `ACTIVE_ORDER_STATUSES`
2. `apps/mobile/src/screens/tables/TableDetailScreen.tsx` (~line 38) — same array → `ACTIVE_ORDER_STATUSES`
3. `apps/mobile/src/screens/delivery/DeliveryListScreen.tsx` (~line 33) — uses `['pending_approval', 'new', 'preparing', 'ready', 'out_for_delivery']` → `ACTIVE_DELIVERY_STATUSES`
4. `apps/mobile/src/screens/takeout/TakeoutListScreen.tsx` (~line 33) — uses `['pending_approval', 'new', 'preparing', 'ready']` → `ACTIVE_TAKEOUT_STATUSES`

For each: delete local `ACTIVE_STATUSES`, add import, update usages. If the constant is used in `.includes()` with a `string` argument, you may need to spread it `[...ACTIVE_ORDER_STATUSES]` or use a type assertion since `as const` arrays are `readonly`.

---

## Step 3: Unify `ROLE_COLORS` (2 files with conflicting values)

The two definitions use **different hex values** for every role:
- `StaffCard.tsx`: `owner: '#8b5cf6', admin: BRAND_PRIMARY, waiter: '#10b981', kitchen: '#f59e0b'`
- `ProfileScreen.tsx`: `admin: '#7c3aed', owner: '#dc2626', waiter: '#2563eb', kitchen: '#d97706'`

### Fix:

**File:** `apps/mobile/src/theme/index.ts`

Read the file. Add a `ROLE_COLORS` export to the theme (pick the `StaffCard.tsx` version as canonical since it's used in more places):

```typescript
export const ROLE_COLORS: Record<string, string> = {
  owner: '#8b5cf6',
  admin: '#7c3aed',
  waiter: '#10b981',
  kitchen: '#f59e0b',
};
```

Read both files to decide which colors look more intentional. Use one consistent set.

**File:** `apps/mobile/src/components/staff-management/StaffCard.tsx`
- Delete local `ROLE_COLORS` definition
- Import from `@/theme`

**File:** `apps/mobile/src/screens/profile/ProfileScreen.tsx`
- Delete local `ROLE_COLORS` definition
- Import from `@/theme`

---

## Step 4: Create `useCurrencySymbol` Hook (eliminates 14 identical lines)

The pattern `settings?.currency_symbol || '$'` appears in **14 screen files**.

**File:** Create `apps/mobile/src/hooks/use-currency-symbol.ts`

```typescript
import { useCafeSettings } from '@gustri/queries';

/**
 * Returns the currency symbol from cafe settings, defaulting to '$'.
 */
export function useCurrencySymbol(): string {
  const { data: settings } = useCafeSettings();
  return settings?.currency_symbol || '$';
}
```

Read one of the source files (e.g., `TablesListScreen.tsx`) to confirm:
- The hook used is `useCafeSettings` from `@gustri/queries`
- The exact fallback is `|| '$'` (not `?? '$'`)
- The settings object field is `currency_symbol`

Export from `apps/mobile/src/hooks/index.ts`.

Then update all 14 files. In each file:
1. Read the file
2. Find `const { data: settings } = useCafeSettings();` or similar
3. Find `const currencySymbol = settings?.currency_symbol || '$';`
4. Replace with `const currencySymbol = useCurrencySymbol();`
5. If `settings` is still used for other fields, keep the `useCafeSettings` call. If `settings` was ONLY used for `currency_symbol`, remove the `useCafeSettings` import/call.
6. Add `import { useCurrencySymbol } from '@/hooks/use-currency-symbol';`

Files to update:
1. `apps/mobile/src/screens/tables/TableDetailScreen.tsx`
2. `apps/mobile/src/screens/tables/TablesListScreen.tsx`
3. `apps/mobile/src/screens/expenses/ExpensesListScreen.tsx`
4. `apps/mobile/src/screens/menu-management/MenuManagementScreen.tsx`
5. `apps/mobile/src/screens/delivery/DeliveryListScreen.tsx`
6. `apps/mobile/src/screens/orders/OrdersListScreen.tsx`
7. `apps/mobile/src/screens/orders/AddItemsScreen.tsx`
8. `apps/mobile/src/screens/orders/OrderDetailScreen.tsx`
9. `apps/mobile/src/screens/orders/OrderPaymentScreen.tsx`
10. `apps/mobile/src/screens/stock/StockListScreen.tsx`
11. `apps/mobile/src/screens/waste/WasteListScreen.tsx`
12. `apps/mobile/src/screens/staff-management/StaffDetailScreen.tsx`
13. `apps/mobile/src/screens/takeout/TakeoutListScreen.tsx`
14. `apps/mobile/src/screens/reports/ReportsScreen.tsx`

Also check and fix the 2 files using `|| '¥'` fallback (wrong fallback):
- `apps/mobile/src/components/cafe-settings/OrderSettingsSection.tsx`
- `apps/mobile/src/components/cafe-settings/DeliverySection.tsx`

These should also use `useCurrencySymbol()` for consistency.

Also update components that receive `currencySymbol` as a prop with default `'$'`. Read each component and if it accepts `currencySymbol?: string` with a default, check if the parent always passes it from `useCurrencySymbol()`. If so, the prop default is fine as-is (it's a fallback). Leave component prop defaults alone — they're fine as safety nets.

---

## Step 5: Centralize Inline Hex Colors in Theme (~67 files)

This is the largest change. The theme file at `apps/mobile/src/theme/index.ts` already exists but doesn't export semantic color constants for common UI colors.

### 5a: Add semantic colors to theme

**File:** `apps/mobile/src/theme/index.ts`

Read the file. Add a `COLORS` export:

```typescript
export const COLORS = {
  // Backgrounds
  background: '#f8fafc',
  card: '#ffffff',
  
  // Text
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#6b7280',
  textLight: '#9ca3af',
  
  // Semantic
  danger: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#3b82f6',
  
  // Borders
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  
  // Primary (check if BRAND_PRIMARY already exists and reuse)
  primary: '#2563eb',
} as const;
```

Read the existing theme file to see what's already exported (e.g., `BRAND_PRIMARY`, `ORDER_STATUS_COLORS`). Don't duplicate — reference existing values.

### 5b: Update components to use theme colors

This is a large mechanical change across ~67 files. **Do NOT attempt to update all 67 files at once.** Instead, update the most repeated offenders — files with 5+ inline hex values:

Priority files (read each, replace inline hex with `COLORS.xxx`):
1. `apps/mobile/src/components/ui/TimeElapsed.tsx` — `getTimeColor` function has 4 hardcoded hex values
2. `apps/mobile/src/screens/kitchen/KitchenDisplayScreen.tsx`
3. `apps/mobile/src/screens/orders/OrderDetailScreen.tsx`
4. `apps/mobile/src/screens/tables/TableDetailScreen.tsx`
5. `apps/mobile/src/screens/reports/ReportsScreen.tsx`
6. `apps/mobile/src/screens/stock/StockListScreen.tsx`
7. `apps/mobile/src/screens/expenses/ExpensesListScreen.tsx`
8. `apps/mobile/src/screens/tasks/TasksListScreen.tsx`
9. `apps/mobile/src/screens/schedules/SchedulesScreen.tsx`
10. `apps/mobile/src/screens/waste/WasteListScreen.tsx`

For each file:
- Read the `StyleSheet.create({...})` block at the bottom
- Replace exact hex matches: `'#f8fafc'` → `COLORS.background`, `'#1e293b'` → `COLORS.textPrimary`, `'#6b7280'` → `COLORS.textMuted`, `'#ef4444'` → `COLORS.danger`, `'#10b981'` → `COLORS.success`, `'#f59e0b'` → `COLORS.warning`
- Also check inline `style={{ color: '#xxx' }}` in JSX
- Add `import { COLORS } from '@/theme';`

Leave remaining files for a follow-up — the pattern is established and easily greppable.

---

## Step 6: Replace `calculateOrderTotal` in Mobile (2 files)

1. `apps/mobile/src/components/delivery/DeliveryOrderCard.tsx` (~lines 40-48)
2. `apps/mobile/src/components/takeout/TakeoutOrderCard.tsx` (~lines 35-43)

Read each file. The mobile versions may check `total_amount` instead of `total`. Compare with the `@gustri/core` version added in Phase 9A:

- If the logic matches: delete local function, import `calculateOrderTotal` from `@gustri/core`
- If it checks `total_amount` instead of `total`: the `@gustri/core` version uses `order.total` — read the mobile Order type to check if the field is `total` or `total_amount`. If different field name, you'll need to adapt the call: `calculateOrderTotal({ ...order, total: order.total_amount })`

---

## Final Verification

```bash
pnpm type-check
pnpm test
pnpm check
```

## Commit

Commit with message: `refactor(mobile): deduplicate constants, add useCurrencySymbol hook, centralize theme colors`
