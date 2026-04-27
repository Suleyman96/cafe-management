# Phase 8A: Type Safety — Foundation (packages/database + packages/core)

## Goal

Fix the foundation layer type safety issues that are the root cause of ~170 `any` usages across the monorepo. This phase is additive-only — no existing signatures change, only new types/guards/schemas are added and 3 error utility functions change from `any` to `unknown`.

## Important

- Read each file before editing
- Run `pnpm type-check` after each step to catch regressions
- Run `pnpm test` after all steps complete
- Do NOT touch app code (apps/) — that's a later phase
- Do NOT touch test files

---

## Step 1: Add Missing RPC Functions to Database Types

**File:** `packages/database/src/types/database.ts`

Find the `Functions` section inside `Database['public']`. There are currently 7 RPCs typed (`set_table_context`, `generate_order_number`, `calculate_order_total`, `get_order_remaining_balance`, `transfer_table`, `get_monthly_order_count`, `get_tenant_plan_from_context`).

Add these 3 missing RPCs that customer-web currently calls via `as Function` casts:

```typescript
get_active_order_for_table: {
  Args: { p_table_id: string }
  Returns: Json
}
get_delivery_order: {
  Args: { p_order_id: string; p_access_token?: string | null }
  Returns: Json
}
get_waiter_calls_for_table: {
  Args: { p_table_id: string; p_status?: string }
  Returns: Json
}
```

Also add this RPC used in api-client but untyped:

```typescript
transfer_order_items: {
  Args: {
    p_source_order_id: string
    p_destination_table_id: string
    p_items: Json
    p_staff_id: string
    p_reason?: string | null
  }
  Returns: string
}
```

Also find the `Views` section and add the `orders_decrypted` view which is queried extensively in `packages/api-client/src/wrapper/orders.ts` but missing from the type:

```typescript
orders_decrypted: {
  Row: Database['public']['Tables']['orders']['Row'] & {
    decrypted_customer_name: string | null
    decrypted_customer_phone: string | null
    decrypted_delivery_address: string | null
  }
}
```

**Verify:** `cd packages/database && npx tsc --noEmit`

---

## Step 2: Add Missing Composite Types

**File:** `packages/database/src/types/index.ts`

Add these missing type aliases (check they don't already exist before adding):

```typescript
export type TaskCategory = Database['public']['Tables']['task_categories']['Row'];
export type CafeSettings = Database['public']['Tables']['cafe_settings']['Row'];
export type Tenant = Database['public']['Tables']['tenants']['Row'];
export type DeliveryCustomer = Database['public']['Tables']['delivery_customers']['Row'];
export type DeliveryCustomerInsert = Database['public']['Tables']['delivery_customers']['Insert'];
export type DeliveryCustomerUpdate = Database['public']['Tables']['delivery_customers']['Update'];
```

Add `DeliveryOrderWithDetails` composite type (currently defined locally in `apps/customer-web/src/types/index.ts` — check that file to match the exact shape):

```typescript
export interface DeliveryOrderWithDetails extends Order {
  order_items: OrderItemWithMenuItem[];
  delivery_person?: { full_name: string } | null;
}
```

Make sure all new types are exported from the package barrel (`packages/database/src/index.ts`).

**Verify:** `cd packages/database && npx tsc --noEmit`

---

## Step 3: Fix Missing Schema Fields + Add Missing Schema

**File:** `packages/database/src/schemas/index.ts`

1. Find `OrderSchema` — add `delivery_access_token: z.string().nullable()` field. Check `packages/database/src/types/database.ts` for the orders table Row type to confirm this field exists and its exact type.

2. Find `StaffSchema` — add `push_token: z.string().nullable()` field. Same — verify against the Row type.

3. Add `DeliveryCustomerSchema` (no schema exists for this table). Check the `delivery_customers` table Row type in `database.ts` for exact fields:

```typescript
export const DeliveryCustomerSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  phone: z.string(),
  address: z.string(),
  notes: z.string().nullable(),
  order_count: z.number().int(),
  last_order_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
```

Add the inferred type export alongside the other schema inferences at the bottom of the file:

```typescript
export type DeliveryCustomerInput = z.infer<typeof DeliveryCustomerSchema>;
```

**Verify:** `cd packages/database && npx tsc --noEmit`

---

## Step 4: Change Error Utilities from `any` to `unknown`

**File:** `packages/core/src/errors.ts`

Find and change these 3 function signatures:

1. `isAppError(error: any)` → `isAppError(error: unknown)` (return type `error is AppError` stays)

2. `getErrorMessage(error: any): string` → `getErrorMessage(error: unknown): string`
   - The body accesses `error.message` — this needs narrowing. Change to:
   ```typescript
   export function getErrorMessage(error: unknown): string {
     if (isAppError(error)) return error.message;
     if (error instanceof Error) return error.message;
     if (typeof error === 'string') return error;
     return 'An unknown error occurred';
   }
   ```
   Read the existing body first and preserve any additional logic (e.g. Supabase-specific message extraction).

3. `handleSupabaseError(error: any): AppError` → `handleSupabaseError(error: unknown): AppError`
   - The body accesses `error.code`, `error.status`, `error.message`. Add narrowing at the top:
   ```typescript
   export function handleSupabaseError(error: unknown): AppError {
     const err = error as { code?: string; status?: number; message?: string; details?: string };
     // ... rest of body uses `err.code`, `err.status`, `err.message` instead of `error.xxx`
   }
   ```
   Read the existing body carefully and preserve all existing error code mappings.

**Verify:** `cd packages/core && npx tsc --noEmit`

This change may cause downstream compile errors if any app code passes the result of these functions into something that expects `any`. Run `pnpm type-check` to check. If there are errors, they indicate real type issues that should be fixed by adding proper types at the call site.

---

## Step 5: Add Missing Type Guards

**File:** `packages/core/src/type-guards.ts`

Read the file to understand the existing guard pattern. Each guard checks for `typeof value === 'object' && value !== null && 'id' in value && 'tenant_id' in value` plus domain-specific fields.

Add these missing guards (import the types from `@gustri/database` at the top — check which imports already exist):

```typescript
export function isDeliveryCustomer(value: unknown): value is DeliveryCustomer {
  return typeof value === 'object' && value !== null
    && 'id' in value && 'phone' in value && 'address' in value && 'order_count' in value;
}

export function isRefund(value: unknown): value is Refund {
  return typeof value === 'object' && value !== null
    && 'id' in value && 'order_id' in value && 'amount' in value && 'refund_method' in value;
}

export function isTenant(value: unknown): value is Tenant {
  return typeof value === 'object' && value !== null
    && 'id' in value && 'name' in value && 'plan' in value;
}

export function isTaskCategory(value: unknown): value is TaskCategory {
  return typeof value === 'object' && value !== null
    && 'id' in value && 'name' in value && 'tenant_id' in value;
}
```

Read the existing guards to match the exact pattern used (some may check more fields). Also make sure the types (`DeliveryCustomer`, `Refund`, `Tenant`, `TaskCategory`) are imported from `@gustri/database`.

Make sure all new guards are exported from the package barrel (`packages/core/src/index.ts`).

**Verify:** `cd packages/core && npx tsc --noEmit`

---

## Final Verification

```bash
pnpm type-check   # Full monorepo TypeScript check
pnpm test          # All unit/integration tests
pnpm check         # Biome lint + format
```

If `pnpm type-check` reveals errors in app code caused by the `any` → `unknown` change in error utilities, note them but do NOT fix them in this phase — those are Phase 8C/8D work.

## Commit

Commit with message: `refactor: add missing database types, schemas, and type guards for type safety foundation`
