# Phase 1 Prompt: Data Layer Fixes (SCALE-1 + SCALE-2)

Copy everything below the line and paste it as the prompt for a new Claude Code session.

---

## Task

Implement Phase 1 (SCALE-1 and SCALE-2) from `plans/07-SCALING-AND-ARCHITECTURE-fixes.md`. Read that file for full context, but this prompt contains the verified details you need. Do NOT blindly copy the SQL from the plan — it has inaccuracies. Use the details below instead.

## What you're fixing and why

The reports page (`apps/staff-web/src/app/(staff)/reports/page.tsx`) fetches ALL orders, expenses, waste logs, and staff into browser memory and filters with `useMemo()`. At 50 orders/day per cafe, this will OOM the browser within months. Additionally, several data wrappers have no pagination (delivery customers, menu items), which will also grow unbounded.

## SCALE-1: Server-side report aggregation

### Goal
Replace client-side data crunching in the reports page with database functions that return pre-aggregated data. The reports page should never fetch raw order/expense/waste rows.

### Current state (verified)

**Reports page** (`apps/staff-web/src/app/(staff)/reports/page.tsx`):
- Line 35: `useOrders()` — fetches ALL orders (no filters, no date range)
- Line 107: `useExpenses({ startDate, endDate })` — at least has date range
- Line 111: `useWasteLogs({ startDate, endDate })` — at least has date range
- Line 36: `useStaff()` — fetches all staff
- Lines 244-250: Filters orders client-side by date using `useMemo()`
- Lines 254-304: Calculates revenue, order counts, item breakdown, order type splits — all in JS
- Lines 307-310: Calculates total discounts from `order.discount_amount`
- Lines 313+: Z-report calculations from payment data

**Key: the reports page computes these metrics:**
1. `totalRevenue` — sum of all item prices (quantity × item_price) from order_items
2. `totalOrders`, `completedOrders`, `cancelledOrders` — counts by status
3. `averageOrderValue` — totalRevenue / totalOrders
4. `dineInOrders`, `takeoutOrders`, `deliveryOrders` — counts by order_type
5. `totalItems` — sum of all item quantities
6. `soldItems` — per-menu-item breakdown (name, count, revenue), sorted by count
7. `totalDiscounts` — sum of `discount_amount` column
8. Z-report data comes from a separate `useZReport()` hook (already server-side via payments query)

**Orders table columns (verified from baseline migration):**
- `id`, `table_id`, `assigned_waiter_id`, `order_number`, `status`, `subtotal`, `tax`, `total`, `customer_notes`, `internal_notes`
- `created_at`, `updated_at`, `preparing_at`, `ready_at`, `served_at`, `closed_at`
- `payment_method`, `paid_at`, `order_type`, `source`
- `customer_name`, `customer_phone`, `delivery_address` (encrypted PII)
- `delivery_fee`, `delivery_notes`, `estimated_delivery_time`, `delivered_at`, `delivery_person_id`
- `discount_type`, `discount_value`, `discount_amount`, `discount_reason`, `discount_applied_by`
- `tenant_id`
- **NOTE: there is NO `refund_amount` column on orders.** Refunds are in a separate `refunds` table.

**The `orders_decrypted` view** exists and adds `decrypted_customer_name`, `decrypted_customer_phone`, `decrypted_delivery_address` — but reports don't need PII, so query the `orders` table directly.

**Order items** are in `order_items` table with columns including `order_id`, `menu_item_id`, `quantity`, `item_price`, `status`.

### Implementation steps

**Step 1** — Create a new migration `supabase/migrations/YYYYMMDD_report_aggregation_functions.sql` with these database functions:

1. `get_revenue_summary(p_tenant_id UUID, p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)` — returns daily breakdown:
   - `report_date DATE`
   - `total_revenue NUMERIC` (sum of order_items quantity × item_price, NOT orders.total)
   - `order_count INT`
   - `avg_ticket NUMERIC`
   - `completed_count INT` (status = 'closed')
   - `cancelled_count INT` (status = 'cancelled')
   - `dine_in_count INT`, `takeout_count INT`, `delivery_count INT`
   - `total_items INT` (sum of order_items.quantity)
   - `total_discounts NUMERIC` (sum of orders.discount_amount)
   - Filter: `WHERE tenant_id = p_tenant_id AND created_at >= p_from AND created_at < p_to`

2. `get_top_sold_items(p_tenant_id UUID, p_from TIMESTAMPTZ, p_to TIMESTAMPTZ, p_limit INT DEFAULT 20)` — returns:
   - `menu_item_id UUID`
   - `item_name TEXT` (join to menu_items.name)
   - `total_quantity INT`
   - `total_revenue NUMERIC`
   - Join: `order_items` → `orders` (for tenant_id + date filter) → `menu_items` (for name)
   - Order by total_quantity DESC, limit p_limit

3. `get_expense_summary(p_tenant_id UUID, p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)` — returns:
   - `category_name TEXT`
   - `total_amount NUMERIC`
   - `entry_count INT`
   - Join: `expenses` → `expense_categories`

4. `get_waste_summary(p_tenant_id UUID, p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)` — returns:
   - `waste_reason TEXT`
   - `item_name TEXT`
   - `total_quantity NUMERIC`
   - `total_cost NUMERIC`
   - `entry_count INT`
   - Join: `waste_logs` → `stock_items`

All functions should be `LANGUAGE sql STABLE SECURITY DEFINER` and use `SET search_path = public`.

**Step 2** — Create `packages/api-client/src/wrapper/reports.ts`:
- Follow the exact same pattern as other wrappers (see `packages/api-client/src/wrapper/expenses.ts` for reference)
- Export `createReportsWrapper(ctx: WrapperContext)` factory function
- Export type `ReportsWrapper`
- Methods: `getRevenueSummary(from, to)`, `getTopSoldItems(from, to, limit?)`, `getExpenseSummary(from, to)`, `getWasteSummary(from, to)`
- Each method calls `ctx.anyClient.rpc('function_name', { params })` and handles errors with `handleSupabaseError`

**Step 3** — Register the wrapper in `packages/api-client/src/wrapper/index.ts`:
- Import `createReportsWrapper`
- Add private `_reports` property and lazy getter (follow the existing pattern exactly)
- Export the `ReportsWrapper` type

**Step 4** — Add query key `REPORTS: 'reports'` to `packages/core/src/constants.ts` in the `QUERY_KEYS` object.

**Step 5** — Create hooks in `packages/queries/src/hooks/use-reports.ts`:
- `useRevenueSummary(from: string, to: string)` — queryKey: `[QUERY_KEYS.REPORTS, 'revenue', from, to]`, staleTime: 5 minutes
- `useTopSoldItems(from: string, to: string, limit?: number)` — queryKey: `[QUERY_KEYS.REPORTS, 'top-items', from, to, limit]`
- `useExpenseSummary(from: string, to: string)` — queryKey: `[QUERY_KEYS.REPORTS, 'expenses', from, to]`
- `useWasteSummary(from: string, to: string)` — queryKey: `[QUERY_KEYS.REPORTS, 'waste', from, to]`
- Export from `packages/queries/src/hooks/index.ts`

**Step 6** — Rewrite `apps/staff-web/src/app/(staff)/reports/page.tsx`:
- Remove `useOrders()` import and call (line 35) — this is the critical change
- Remove `useStaff()` if only used for reports (check if StaffPerformanceSection needs it separately)
- Replace `useExpenses()` and `useWasteLogs()` with the new summary hooks
- Remove ALL `useMemo()` blocks that filter/aggregate data (lines 244-310)
- Consume pre-aggregated data directly from the new hooks
- Keep the date range picker logic (lines 38-94) — just convert the dates to ISO strings for the hooks
- Keep `useZReport()` as-is (already server-side)
- Keep chart components — feed them the aggregated data
- Keep `useFormatPrice()` for display

**Important:** The `StaffPerformanceSection` and `WasteSection` components imported on lines 21-22 may have their own data needs. Check if they accept props or fetch their own data. If they accept raw order/waste arrays as props, they'll need to be updated too to accept summary data, or given their own server-side hooks.

### Verification
- Run `pnpm type-check` — no errors
- Run `pnpm test` — all pass
- Run `pnpm check` — biome passes
- The reports page should load in <1s regardless of order count
- Visually compare: metrics should match the old implementation for the same date range (test with current data)

---

## SCALE-2: Pagination on unbounded queries

### Goal
Add pagination to delivery customers and a safety limit to menu items. Staff and tables are fine (small per-tenant counts).

### Current state (verified)

**Delivery customers** (`packages/api-client/src/wrapper/delivery-customers.ts`):
- `findAll()` at lines 8-19: fetches ALL rows, ordered by `order_count DESC, name ASC`
- No limit, no pagination

**Menu items** (`packages/api-client/src/wrapper/menu.ts`):
- `findAll()` at line 28: `.limit(500)` hard cap
- No pagination support, no count

**Existing pagination pattern** (follow this exactly — from `packages/api-client/src/wrapper/types.ts`):
```typescript
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  count: number;
  hasMore: boolean;
}
```

The orders wrapper already has `findAllPaginated()` returning `PaginatedResult<OrderRow>` — use it as your reference implementation.

### Implementation steps

**Step 1** — Add `findAllPaginated` to `packages/api-client/src/wrapper/delivery-customers.ts`:
- Signature: `findAllPaginated(options?: { page?: number; pageSize?: number; search?: string })`
- Default pageSize: 50
- Use `.select('*', { count: 'exact' })` and `.range(from, to)` like the orders wrapper does
- Search filter: `.or('name.ilike.%${search}%,phone.ilike.%${search}%')` if search provided
- Keep existing `findAll()` for backward compat but keep it as-is
- Return `PaginatedResult<DeliveryCustomerRow>`

**Step 2** — Add `findAllPaginated` to `packages/api-client/src/wrapper/menu.ts`:
- Signature: `findAllPaginated(options?: { page?: number; pageSize?: number; categoryId?: string; isAvailable?: boolean })`
- Default pageSize: 100
- Use `.select('*, categories(*)', { count: 'exact' })` and `.range(from, to)`
- Apply same filters as existing `findAll()` (categoryId, isAvailable, isPopular)
- Keep existing `findAll()` for backward compat
- Return `PaginatedResult<MenuItemRow>`

**Step 3** — Add corresponding hooks in `packages/queries/src/hooks/`:
- `useDeliveryCustomersPaginated(page, pageSize, search?)` in the existing `use-delivery.ts` or a new file
- `useMenuItemsPaginated(page, pageSize, categoryId?)` in the existing `use-menu-items.ts` or a new file
- Use query keys that include pagination params: `[QUERY_KEYS.DELIVERY_CUSTOMERS, 'paginated', page, pageSize, search]`

**Step 4** — Update the delivery customers page in staff-web to use the paginated hook (find the page that renders delivery customer list and add pagination controls).

**Step 5** — The menu page can stay on `findAll()` for now (500 items is fine for most restaurants), but the paginated version is available for future use.

### Verification
- Run `pnpm type-check` — no errors
- Run `pnpm test` — all pass
- Run `pnpm check` — biome passes
- Delivery customer list should show pagination controls
- Menu items should still load normally

---

## General rules

- Follow existing code patterns exactly — look at how other wrappers, hooks, and pages are structured before writing new code
- Use Biome formatting: 2-space indent, single quotes, trailing commas. Run `pnpm check:fix` before considering done
- Import types from `@gustri/database` for database types, from wrapper `types.ts` for wrapper types
- All database operations go through `@gustri/api-client` wrapper — never raw supabase queries in app code
- Do NOT add comments, docstrings, or type annotations beyond what's needed
- Do NOT refactor surrounding code — only change what's needed for these two issues
- Run `pnpm test && pnpm type-check && pnpm check` at the end to verify everything passes
