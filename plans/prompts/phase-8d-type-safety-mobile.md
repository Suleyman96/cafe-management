# Phase 8D: Type Safety — Mobile App (~60 `any` → 0)

## Goal

Eliminate all ~60 `any` usages in `apps/mobile/src/`. The fixes are mechanical — replacing `any` with proper domain types that already exist in `@gustri/database`.

## Prerequisites

- Phase 8A complete (foundation types exist)
- Phase 8B complete (api-client wrapper types tightened)

## Important

- Read each file before editing
- Run `pnpm type-check` after each group of changes
- Do NOT touch other apps or packages
- Do NOT touch test files
- All domain types are imported from `@gustri/database` (re-exported through `@gustri/api-client`)

---

## Step 1: Fix Mutation Hook Payloads (7 files, ~9 `any` removed)

All 7 mobile update mutation hooks use `Record<string, any>` for their update payload. Replace with the proper `*Update` type from `@gustri/database`.

### File: `apps/mobile/src/hooks/use-staff-management.ts`

Find `useUpdateStaff` mutation — change:
```typescript
{ id: string; data: Record<string, any> }
```
to:
```typescript
{ id: string; data: StaffUpdate }
```

Import `StaffUpdate` from `@gustri/database`. Read the file first to see what's already imported.

### File: `apps/mobile/src/hooks/use-menu-management.ts`

Two mutations:
- `useUpdateMenuItem`: `Record<string, any>` → `MenuItemUpdate` (import `MenuItemUpdate` from `@gustri/database`)
- `useUpdateCategory`: `Record<string, any>` → `CategoryUpdate` (import type — check exact name in `packages/database/src/types/index.ts`, it may be `CategoriesUpdate`)

### File: `apps/mobile/src/hooks/use-expenses.ts`

Two mutations:
- `useUpdateExpense`: `Record<string, any>` → `ExpenseUpdate`
- `useUpdateExpenseCategory`: `Record<string, any>` → `ExpenseCategoryUpdate` (check exact type name in database types)

### File: `apps/mobile/src/hooks/use-schedules.ts`

- `useUpdateSchedule`: `Record<string, any>` → `StaffScheduleUpdate`

### File: `apps/mobile/src/hooks/use-stock.ts`

- `useUpdateStockItem`: `Record<string, any>` → `StockItemUpdate`

**For each file:** Read it first, check what types are already imported, add the missing import, replace the type.

**Verify:** `cd apps/mobile && npx tsc --noEmit`

---

## Step 2: Consolidate `OrderWithJoins` Type (3 files)

Three screens define the same local `OrderWithJoins` type:

- `apps/mobile/src/screens/orders/OrderDetailScreen.tsx` (~line 26-30)
- `apps/mobile/src/screens/orders/OrdersListScreen.tsx` (~line 18-22)
- `apps/mobile/src/screens/tables/TableDetailScreen.tsx` (~line 32-36)

Each defines:
```typescript
type OrderWithJoins = Order & {
  table?: { table_number: string; location: string | null };
  order_items?: OrderItemWithMenuItem[];
  assigned_waiter?: { full_name: string } | null;
};
```

Check if `OrderWithItems` or `OrderWithDetails` from `@gustri/database` has a compatible shape. Read `packages/database/src/types/index.ts` to compare.

If compatible: remove the local type, import from `@gustri/database`, update all usages in the file.

If not compatible (e.g., `OrderWithDetails` doesn't have `table` or `assigned_waiter` join fields): create an `OrderWithJoins` type in `apps/mobile/src/types/index.ts` (check if this file exists — if not, create it) and import from there in all 3 screens.

**Verify:** `cd apps/mobile && npx tsc --noEmit`

---

## Step 3: Type Modal Component Props (8 components, ~12 `any` removed)

### File: `apps/mobile/src/components/schedules/ScheduleModal.tsx`

Read the file. Find the props interface. Replace:
- `onSubmit: (data: any) => void` — check what shape the `handleSubmit` function builds internally, then type `data` to match (likely a schedule insert/update shape)
- `initialData?: any` → `initialData?: StaffSchedule` (import from `@gustri/database`)

Also find any internal `const updateData: any = {` and replace with the proper type.

### File: `apps/mobile/src/components/expenses/ExpenseModal.tsx`

- `initialData?: any` → `initialData?: Expense`

### File: `apps/mobile/src/components/tasks/TaskModal.tsx`

- `onSave: (data: any) => Promise<void>` — read what shape the save handler builds, type accordingly
- Find `(staffList as any[]).filter((s: any) =>` — the staffList comes from a hook that returns `Staff[]`. Remove the casts:
  ```typescript
  staffList.filter((s) => s.is_active)
  ```
- Find `activeStaff.find((s: any) =>` → `activeStaff.find((s) =>`
- Find `{activeStaff.map((s: any) =>` → `{activeStaff.map((s) =>`

### File: `apps/mobile/src/components/menu-management/MenuItemModal.tsx`

- `onSubmit: (data: any) => void` → type the data shape based on what's built in the submit handler
- `initialData?: any` → `initialData?: MenuItem`
- `{categories.map((c: any) =>` → `{categories.map((c) =>`  (or `(c: Category) =>`)

### File: `apps/mobile/src/components/menu-management/CategoryModal.tsx`

- `onSubmit: (data: any) => void` → type based on submit handler
- `initialData?: any` → `initialData?: Category`

### File: `apps/mobile/src/components/stock/StockItemModal.tsx`

- `onSubmit: (data: any) => void` → type based on submit handler
- `initialData?: any` → `initialData?: StockItem`

### File: `apps/mobile/src/components/cafe-settings/ToggleRow.tsx`

- `form: Record<string, any>` → `form: Partial<CafeSettings>` (import `CafeSettings` from `@gustri/database`)
- `updateField: (key: string, value: any) => void` → `updateField: <K extends keyof CafeSettings>(key: K, value: CafeSettings[K]) => void`

If the generic approach causes issues at call sites, use a simpler version:
```typescript
updateField: (key: string, value: boolean | string | number | null) => void
```

### File: `apps/mobile/src/screens/settings/CafeSettingsScreen.tsx`

- `const [form, setForm] = useState<Record<string, any>>({})` → `useState<Partial<CafeSettings>>({})`
- `const updateField = (key: string, value: any) =>` → match the type from ToggleRow above

**Verify:** `cd apps/mobile && npx tsc --noEmit`

---

## Step 4: Type Screen Iteration Callbacks (~25 `any` removed)

For each screen, read the file, find `.map((item: any) =>` and `.filter((item: any) =>` patterns, and replace `any` with the proper domain type. The hooks return typed data — the `any` annotations are unnecessary.

### File: `apps/mobile/src/screens/schedules/SchedulesScreen.tsx`

Find all `(schedules as any[])` casts and `(s: any)` callbacks. The schedules hook returns `StaffSchedule[]` and staff hook returns `Staff[]`. Remove the casts and type annotations:
- `(schedules as any[])` → `schedules` (if already typed) or `(schedules as StaffSchedule[])`
- `(s: any) => s.is_active` → `(s: Staff) => s.is_active`
- `(payload: any) =>` → type based on what ScheduleModal submits (see Step 3)

Also fix: `t('expenses.prev')` and `t('expenses.next')` — these use the wrong i18n namespace. Change to `t('common.prev')` / `t('common.next')` or `t('schedules.prev')` / `t('schedules.next')`. Check the i18n files to see which keys exist.

### File: `apps/mobile/src/screens/stock/StockListScreen.tsx`

Replace all `(item: any)` with `(item: StockItem)` or `(item: StockMovement)` depending on which list is being iterated.

### File: `apps/mobile/src/screens/tasks/TasksListScreen.tsx`

Replace `(t: any) => t.status` with `(task: Task) => task.status` (note: `t` shadows the translation function — rename the variable to `task`).

Replace all other `(item: any)` with proper Task type.

### File: `apps/mobile/src/screens/takeout/TakeoutListScreen.tsx`

Replace `(order: any)` with proper `Order` or `OrderWithItems` type.

### File: `apps/mobile/src/screens/delivery/DeliveryListScreen.tsx`

Same pattern — replace `(order: any)` with proper type.

### File: `apps/mobile/src/screens/menu-management/MenuManagementScreen.tsx`

Replace `(item: any)` with `MenuItem` / `Category` types.

### File: `apps/mobile/src/screens/expenses/ExpensesListScreen.tsx`

- `const handleExpenseSubmit = async (data: any) =>` — type `data` based on what ExpenseModal submits
- Other iteration callbacks → `Expense` / `ExpenseCategory` types

### File: `apps/mobile/src/screens/orders/AddItemsScreen.tsx`

Replace `(item: any)` with `MenuItem` / `OrderItem` / `CartItem` depending on context.

### File: `apps/mobile/src/screens/orders/OrderPaymentScreen.tsx`

Replace `(p: any)` with `OrderPayment` type.

**Verify:** `cd apps/mobile && npx tsc --noEmit`

---

## Step 5: Miscellaneous Fixes

### File: `apps/mobile/src/navigation/DrawerNavigator.tsx`

Find line ~23:
```typescript
drawerContent={(props: any) => <CustomDrawerContent {...props} />}
```

Import `DrawerContentComponentProps` from `@react-navigation/drawer` and use it:
```typescript
drawerContent={(props: DrawerContentComponentProps) => <CustomDrawerContent {...props} />}
```

Read the file to check if this type is already imported or if `CustomDrawerContent` already types its own props.

### File: `apps/mobile/src/components/kitchen/KitchenOrderCard.tsx`

Find line ~131:
```typescript
(order as any).order_type !== 'delivery'
```

The `order` prop already has `order_type` in its type. Remove the cast:
```typescript
order.order_type !== 'delivery'
```

If `order_type` isn't in the prop type, add it to the prop interface.

### File: `apps/mobile/src/lib/notifications.ts`

Find line ~69:
```typescript
data?: any
```

Replace with:
```typescript
data?: Record<string, string>
```

**Verify:** `cd apps/mobile && npx tsc --noEmit`

---

## Final Verification

```bash
pnpm type-check   # Full monorepo
pnpm test          # All tests
pnpm check         # Biome lint + format
```

## Commit

Commit with message: `refactor: eliminate all any usages in mobile app — type 60+ locations with proper domain types`
