# Phase 16A: Schema / Data Integrity — Add Missing Schemas, RPC Types, and Fix Type Divergence

## Goal

Fix foundational schema and type gaps:
1. Add 2 missing Zod schemas (`TenantSchema`, `CategorySchema`)
2. Add 11 untyped RPCs to `Database['public']['Functions']`
3. Unify the divergent `OrderWithDetails` definition (staff-web has `delivery_person` field, shared type doesn't)
4. Remove dead `views.getActiveOrders` that duplicates `orders.getActiveOrders` with a different shape

## Important

- Read each file before editing
- Run `pnpm type-check` after each step
- Run `pnpm test` at the end
- Type changes in `packages/database` propagate to all apps — verify full monorepo build

---

## Step 1: Add Missing Zod Schemas

**File:** `packages/database/src/schemas/index.ts`

### 1a: Add `TenantSchema`

Read `packages/database/src/types/database.ts` — find the `tenants` table Row type (~lines 13-22). Create a matching Zod schema:

```typescript
export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  plan: z.enum(['free', 'standard', 'pro', 'business']),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
```

Verify the exact field names and types from the Row definition. Check if the `plan` field has a corresponding enum schema already (e.g., `PlanSchema`) — if so, reuse it.

### 1b: Add `CategorySchema`

Read the `categories` table Row type in `database.ts`. Create:

```typescript
export const CategorySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  display_order: z.number().int(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
```

Verify against the exact Row type.

### 1c: Add inferred type exports

At the bottom of the file (where other inferred types are exported), add:

```typescript
export type TenantInput = z.infer<typeof TenantSchema>;
export type CategoryInput = z.infer<typeof CategorySchema>;
```

Make sure both schemas are exported from `packages/database/src/index.ts` barrel.

---

## Step 2: Add Untyped RPCs to Database Functions

**File:** `packages/database/src/types/database.ts`

Find the `Functions` section in `Database['public']`. Add the 11 missing RPC type definitions.

### 2a: Reports RPCs (5 functions)

These are called from `packages/api-client/src/wrapper/reports.ts`. Read that file to determine the exact argument names and return shapes:

```typescript
get_revenue_summary: {
  Args: { p_start_date: string; p_end_date: string; p_tenant_id: string }
  Returns: Json
}
get_top_sold_items: {
  Args: { p_start_date: string; p_end_date: string; p_tenant_id: string; p_limit?: number }
  Returns: Json
}
get_expense_summary: {
  Args: { p_start_date: string; p_end_date: string; p_tenant_id: string }
  Returns: Json
}
get_waste_summary: {
  Args: { p_start_date: string; p_end_date: string; p_tenant_id: string }
  Returns: Json
}
get_staff_performance: {
  Args: { p_start_date: string; p_end_date: string; p_tenant_id: string }
  Returns: Json
}
```

**Read `reports.ts` carefully** to get the exact parameter names. The RPC calls look like:
```typescript
ctx.anyClient.rpc('get_revenue_summary', { p_start_date: ..., p_end_date: ..., p_tenant_id: ... })
```

Match the `Args` type exactly to what's passed.

### 2b: Orders RPC (1 function)

```typescript
cleanup_empty_orders: {
  Args: { p_tenant_id: string }
  Returns: Json
}
```

Read `packages/api-client/src/wrapper/orders.ts` ~line 547 to confirm the exact arguments.

### 2c: Admin RPCs (4 functions)

Read `apps/staff-web/src/app/api/v1/admin/db-stats/route.ts` and `retention/route.ts`:

```typescript
get_connection_stats: {
  Args: Record<string, never>
  Returns: Json
}
get_slow_queries: {
  Args: { p_limit?: number }
  Returns: Json
}
get_table_stats: {
  Args: Record<string, never>
  Returns: Json
}
run_data_retention: {
  Args: Record<string, never>
  Returns: Json
}
```

Read each call site to confirm exact argument shapes. For admin RPCs, `Json` return type is acceptable since these are diagnostic tools.

---

## Step 3: Unify `OrderWithDetails` — Add `delivery_person` to Shared Type

**File:** `packages/database/src/types/index.ts`

Find `OrderWithDetails` (~lines 117-121):
```typescript
export interface OrderWithDetails extends Order {
  table: Pick<Table, 'table_number' | 'location'>;
  order_items: OrderItemWithMenuItem[];
  assigned_waiter?: Pick<Staff, 'full_name'>;
}
```

Add the missing `delivery_person` field that staff-web's local version has:

```typescript
export interface OrderWithDetails extends Order {
  table: Pick<Table, 'table_number' | 'location'>;
  order_items: OrderItemWithMenuItem[];
  assigned_waiter?: Pick<Staff, 'full_name'> | null;
  delivery_person?: Pick<Staff, 'full_name'> | null;
}
```

Read `packages/api-client/src/wrapper/orders.ts` to confirm the Supabase select includes `delivery_person:staff!orders_delivery_person_id_fkey(full_name)` — this is the join that provides this field at runtime.

### Then remove the duplicate from staff-web

**File:** `apps/staff-web/src/types/index.ts`

Find the local `OrderWithDetails` (~lines 25-34). Now that the shared type has `delivery_person`, the local override is no longer needed.

Remove the local `OrderWithDetails` interface. Since `apps/staff-web/src/types/index.ts` does `export * from '@gustri/database'`, the shared type will be used automatically.

### Verify no breakage

Run `pnpm type-check` — if any staff-web code relied on the local type having something the shared type doesn't, TypeScript will catch it.

Check if the local type used `DB.Tables` (plural alias) vs `Table` (canonical) — the shared type uses `Table`. Since `Tables = Table` (alias), there's no structural difference.

---

## Step 4: Remove Dead `views.getActiveOrders`

**File:** `packages/api-client/src/wrapper/views.ts`

Read the file. `getActiveOrders` queries `active_orders_view` but is **never called by any app** — all apps use `db.orders.getActiveOrders()` instead.

Remove the `getActiveOrders` method from the views wrapper.

Check if the views wrapper has other methods. If `getActiveOrders` is the only method, consider whether the entire `views.ts` wrapper is needed. If other methods exist and are used, keep the file and just remove `getActiveOrders`.

Also check if there are tests for this method in `packages/api-client/src/__tests__/views.test.ts`. If so, remove the corresponding test case.

Check if the `active_orders_view` Row type in `Database['public']['Views']` is used anywhere else. If only by the removed `getActiveOrders`, it's still fine to keep in the type definition (views exist in the DB regardless of whether we query them from code).

---

## Final Verification

```bash
pnpm type-check   # Full monorepo — critical after type changes
pnpm test          # All tests
pnpm check         # Biome
pnpm build         # Full build to catch any runtime issues
```

## Commit

Commit with message: `fix: add missing Zod schemas and RPC types, unify OrderWithDetails, remove dead views.getActiveOrders`
