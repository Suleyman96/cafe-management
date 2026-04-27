# Phase 8E: Type Safety — Staff Web (~85 `any` → 0)

## Goal

Eliminate all ~85 `any` usages in `apps/staff-web/src/`. This is the largest app-level fix and highest business-critical surface area. Changes are mechanical — replacing `any` with domain types from `@gustri/database`.

## Prerequisites

- Phase 8A complete (foundation types)
- Phase 8B complete (api-client wrapper types)

## Important

- Read each file before editing
- Run `pnpm type-check` frequently — this phase touches ~25 files
- Do NOT touch other apps or packages
- Do NOT touch test files
- All domain types come from `@gustri/database` (typically imported via `@/types` which re-exports them)

---

## Step 1: Type Component Props (~35 `any` removed, 10 files)

For each component: read the file, find the props interface, replace `any` with the correct domain type. Check `apps/staff-web/src/types/index.ts` to see what's already re-exported.

### File: `apps/staff-web/src/components/tables/table-card.tsx`

Find the props interface (~line 22-36). Replace:
```
table: any                        → table: Table
activeOrders: any[]               → activeOrders: OrderWithItems[]
activeCalls: any[]                → activeCalls: WaiterCall[]
onEditTable: (table: any) => void → onEditTable: (table: Table) => void
onDeleteTable: (table: any) => void → onDeleteTable: (table: Table) => void
onTransferTable: (table: any) => void → onTransferTable: (table: Table) => void
```

Also fix the internal `calculateOrderTotal` function:
```
(order: any) → (order: OrderWithItems)
```

And fix all `.map((item: any) =>` inside the component body with proper types (`OrderItem`, `WaiterCall`, etc.). Read the JSX to understand what fields are accessed on each item.

Import needed types: `Table`, `OrderWithItems`, `WaiterCall`, `OrderItem` from `@/types` or `@gustri/database`.

### File: `apps/staff-web/src/components/orders/order-list-card.tsx`

```
order: any                           → order: OrderWithItems
onOpenPayment: (order: any) => void  → onOpenPayment: (order: OrderWithItems) => void
onOpenCancel: (order: any) => void   → onOpenCancel: (order: OrderWithItems) => void
```

Fix internal `calculateOrderTotal` and all `.map((item: any) =>` callbacks.

### File: `apps/staff-web/src/components/modals/staff-edit-modal.tsx`

```
staff: any → staff: Staff
```

### File: `apps/staff-web/src/components/orders/order-detail-delivery.tsx`

```
staffList: any[] | undefined → staffList: Staff[] | undefined
onAssignDriver: (params: { orderId: string; staffId: string }) => Promise<any>
  → onAssignDriver: (params: { orderId: string; staffId: string }) => Promise<void>
```

Fix `{staffList?.map((s: any) =>` → `{staffList?.map((s) =>`

### File: `apps/staff-web/src/components/tables/table-cart.tsx`

```
activeOrder: any → activeOrder: OrderWithItems
```

### File: `apps/staff-web/src/components/orders/order-detail-actions.tsx`

```
table?: any → table?: Table
```

### File: `apps/staff-web/src/components/modals/table-transfer-modal.tsx`

```
sourceTable: any → sourceTable: Table
```

Fix all internal `(table: any)` and `(order: any)` callbacks with proper types.

### File: `apps/staff-web/src/components/modals/item-transfer-modal.tsx`

```
order: any → order: OrderWithItems
```

Fix all internal iteration callbacks.

### File: `apps/staff-web/src/components/modals/schedule-modal.tsx`

```
schedule?: any → schedule?: StaffSchedule
```

Fix `const updateData: any = {` — replace with `const updateData: Partial<StaffScheduleUpdate> = {` or an appropriate type based on what fields are set.

Fix `(s: any) =>` iteration callbacks → `(s: Staff)` or `(s: StaffSchedule)`.

### File: `apps/staff-web/src/components/modals/table-modal.tsx`

```
table?: any → table?: Table
```

**Verify:** `cd apps/staff-web && npx tsc --noEmit`

---

## Step 2: Fix Translation Function Type (~6 `any` removed, 5 files)

These files type the `t` translation function prop as `t: (key: string, opts?: any) => string`. Replace `opts?: any` with `opts?: Record<string, string | number>` which matches i18next's interpolation shape.

Files to fix:
- `apps/staff-web/src/components/modals/payment/partial-payment-form.tsx` (~line 12)
- `apps/staff-web/src/components/modals/payment/item-payment-form.tsx` (~line 17)
- `apps/staff-web/src/components/modals/payment/payment-mode-selector.tsx` (~line 13)
- `apps/staff-web/src/components/menu/menu-item-card.tsx` (~line 16)
- `apps/staff-web/src/components/tables/order-items-list.tsx` (~line 16)

In each file, find:
```typescript
t: (key: string, opts?: any) => string;
```

Replace with:
```typescript
t: (key: string, opts?: Record<string, string | number>) => string;
```

**Verify:** `cd apps/staff-web && npx tsc --noEmit`

---

## Step 3: Fix Page-Level Iteration Callbacks (~40 `any` removed, 10 pages)

For each page: read the file, find `.filter((item: any) =>`, `.map((item: any) =>`, `.reduce((acc, item: any) =>` patterns and replace `any` with the proper domain type.

### File: `apps/staff-web/src/app/(staff)/schedules/page.tsx`

This is the most complex page. Find:
- `Record<string, { staff: any; schedules: Record<string, any[]> }>` → `Record<string, { staff: Staff; schedules: Record<string, StaffSchedule[]> }>`
- All `(staff: any)` → `(staff: Staff)`
- All `(schedule: any)` → `(schedule: StaffSchedule)`

Read the full file to understand the data transformation logic before making changes.

### File: `apps/staff-web/src/app/(staff)/staff/page.tsx`

- `filteredStaff.filter((staff: any) =>` → remove `: any` (the hook returns typed data)
- `.map((staff: any) =>` → remove `: any`

### File: `apps/staff-web/src/app/(staff)/staff/[id]/page.tsx`

Multiple iteration callbacks over staff schedules, tasks, etc. Replace all `(item: any)` with proper types.

### File: `apps/staff-web/src/app/(staff)/tasks/page.tsx`

- `(task: any)` → `(task: Task)` for all filter/map callbacks

### File: `apps/staff-web/src/app/(staff)/calls/page.tsx`

- `(call: any)` → `(call: WaiterCall)` for all callbacks

### File: `apps/staff-web/src/app/(staff)/feedback/page.tsx`

- `{feedback.map((item: any) =>` → `{feedback.map((item: CustomerFeedback) =>`

Or just remove the type annotation if the data from the hook is already typed.

### File: `apps/staff-web/src/app/(staff)/expenses/expenses-client.tsx`

- `(cat: any)` → `(cat: ExpenseCategory)` or `(expense: any)` → `(expense: Expense)`

### File: `apps/staff-web/src/app/(staff)/waste/page.tsx`

- `(log: any)` → `(log: WasteLog)` or proper summary type

### File: `apps/staff-web/src/app/(staff)/stock/stock-client.tsx`

- `{movements.map((m: any) =>` → `{movements.map((m: StockMovement) =>`

### File: `apps/staff-web/src/app/(staff)/orders/[id]/page.tsx`

Find:
```typescript
(refundsData as any[])?.reduce((sum: number, r: any) => sum + r.amount, 0)
```

The `refundsData` comes from a typed hook. Remove the casts:
```typescript
refundsData?.reduce((sum: number, r) => sum + r.amount, 0)
```

If the hook return type is too loose, add explicit typing: `(r: Refund) =>`.

**Verify:** `cd apps/staff-web && npx tsc --noEmit`

---

## Step 4: Fix Hook-Level `any` (~10 removed)

### File: `apps/staff-web/src/hooks/use-auth.ts`

Find line ~46:
```typescript
setTenantPlan: (p: any) => void
```

Read how `setTenantPlan` is defined in the auth store. Check `apps/staff-web/src/store/auth-store.ts` for the type. Replace with:
```typescript
setTenantPlan: (p: PlanName) => void
```

Where `PlanName` is the plan enum type — check `@gustri/database` for the exact type name (might be `PlanType` or a literal union like `'free' | 'starter' | 'professional' | 'enterprise'`).

Find line ~58:
```typescript
.then((tenant) => setTenantPlan(tenant.plan as any))
```

Remove `as any`:
```typescript
.then((tenant) => setTenantPlan(tenant.plan))
```

### File: `apps/staff-web/src/hooks/use-orders-safe.ts`

Find `order.order_items?.map((item: any) =>` — remove `: any`, the type should flow from the hook return type.

### File: `apps/staff-web/src/hooks/use-tasks-safe.ts`

Find `.filter((t: any) => t.status ===` — replace with `(task: Task)` (also rename variable to avoid shadowing `t` translation function).

### File: `apps/staff-web/src/hooks/use-waiter-calls-safe.ts`

Find `.filter((call: any) => call.table_id ===` — remove `: any`.

### Files in `apps/staff-web/src/components/modals/`

- `expense-category-modal.tsx` — `(cat: any)` → `(cat: ExpenseCategory)`
- `expense-modal.tsx` — `{categories.map((cat: any) =>` → remove `: any`
- `task-modal.tsx` — `const data: any = {` → type the object properly, `(s: any) =>` → `(s: Staff)`

### File: `apps/staff-web/src/components/layout/sidebar.tsx`

Find task iteration callbacks `(task: any)` → `(task: Task)`.

**Verify:** `cd apps/staff-web && npx tsc --noEmit`

---

## Final Verification

```bash
pnpm type-check   # Full monorepo
pnpm test          # All tests
pnpm check         # Biome lint + format
```

Manual smoke test the following pages in staff-web (they are the most affected):
- Tables list → click a table → verify orders display
- Orders list → click an order → verify details + payment
- Kitchen page → verify order cards
- Schedules page → verify staff schedule grid
- Staff page → verify list + edit modal
- Tasks page → verify task list

## Commit

Commit with message: `refactor: eliminate all 85 any usages in staff-web — type component props, pages, and hooks`
