# Phase 8B: Type Safety — API Client Wrappers (packages/api-client)

## Goal

Fix ~14 `any` usages in the api-client wrapper layer and tighten method signatures to prevent untyped data from leaking into apps. This phase depends on Phase 8A being complete (new Database types must exist).

## Important

- Read each file before editing
- Run `pnpm type-check` after each file change
- Do NOT touch app code (apps/) — that's Phase 8C/8D
- Do NOT touch test files
- Do NOT try to eliminate `AnySupabaseClient` in `types.ts` — it's a known Supabase SDK limitation

---

## Step 1: Fix `waste.ts` Summary Methods (8 `any` removed)

**File:** `packages/api-client/src/wrapper/waste.ts`

Read the file. Find `getMonthlySummary` method (~line 100-131). It has multiple `(l as any).reason`, `(l as any).total_cost`, `(l as any).category` casts.

The root cause: the query does `.select('total_cost, reason, category, ...')` which returns a narrow projection, but the code casts each field access to `any`.

Fix: Define a local type for the projection at the top of the method or at module level:

```typescript
type WasteSummaryProjection = Pick<WasteLogRow, 'total_cost' | 'reason' | 'category'>;
```

Then replace all `(l as any).field` with properly typed access:
- `logs.reduce((sum: number, l: any) => sum + l.total_cost, 0)` → `logs.reduce((sum: number, l: WasteSummaryProjection) => sum + (l.total_cost ?? 0), 0)`
- `(l as any).reason` → `l.reason`
- `(l as any).total_cost` → `l.total_cost`
- `(l as any).category` → `l.category`

Check the WasteLogRow type from `./types` to confirm these field names match exactly.

Also find `getDailySummary` (~line 142-160). Fix the same pattern:
- `(sum: number, l: any)` → `(sum: number, l: Pick<WasteLogRow, 'total_cost'>)`

**Verify:** `cd packages/api-client && npx tsc --noEmit`

---

## Step 2: Fix `orders.ts` PII Mapper + updateStatus Cast (4 `any` removed)

**File:** `packages/api-client/src/wrapper/orders.ts`

### 2a: Fix `mapDecryptedPii` generic

Find `mapDecryptedPii` function (~line 20). It has:
```typescript
function mapDecryptedPii<T extends Record<string, any>>(row: T): T {
  const mapped: Record<string, any> = { ...row };
```

Change to:
```typescript
function mapDecryptedPii<T extends Record<string, unknown>>(row: T): T {
  const mapped = { ...row } as Record<string, unknown>;
```

The function body uses bracket notation (`mapped[key] = mapped[decryptedKey]`) which works fine with `unknown`. Read the full function body to confirm no other `any` casts are needed.

Also fix `mapDecryptedPiiArray` if it has the same generic constraint.

### 2b: Fix `updateStatus` cast

Find `updateStatus` method (~line 210-230). It has:
```typescript
.single()) as { data: any; error: any };
```

The reason for this cast is that the code needs to check `order.order_type` before proceeding. Fix by splitting the query — first fetch just `order_type`, then do the update:

```typescript
// First, get the order type
const { data: orderData, error: fetchError } = await ctx.client
  .from('orders')
  .select('order_type')
  .eq('id', id)
  .eq('tenant_id', ctx.tenantId)
  .single();

if (fetchError) throw handleSupabaseError(fetchError);

// Then do the status update
```

Read the full method to understand the existing flow before making changes. The key is to remove the `as { data: any; error: any }` cast while preserving the business logic.

**Verify:** `cd packages/api-client && npx tsc --noEmit`

---

## Step 3: Fix `tasks.ts` Iteration Callbacks (2 `any` removed)

**File:** `packages/api-client/src/wrapper/tasks.ts`

Find `generateRecurringTasks` method (~line 230-260).

1. Find `templates.map((t: any) => t.id)` — the `templates` variable comes from a typed Supabase query that returns `TaskRow[]`. Remove the `any` annotation:
   ```typescript
   templates.map((t) => t.id)
   ```

2. Find `(existing || []).map((e: any) => e.parent_task_id)` — same issue. Remove the `any`:
   ```typescript
   (existing || []).map((e) => e.parent_task_id)
   ```

If TypeScript can't infer the types (because `anyClient` is used), add explicit type annotations using the task types from `./types`:
```typescript
const templates = (data || []) as TaskRow[];
```

**Verify:** `cd packages/api-client && npx tsc --noEmit`

---

## Step 4: Type Enum Parameters in `feedback.ts` and `waiter-calls.ts`

### 4a: feedback.ts

**File:** `packages/api-client/src/wrapper/feedback.ts`

Read the file. Find the `create` method parameter types. The `feedback_type` and `status` params are typed as `string`.

Change to literal union types. Check `packages/database/src/enums/index.ts` for the exact enum values:

```typescript
feedback_type: 'complaint_food' | 'complaint_service' | 'complaint_staff' | 'question_menu' | 'request_general' | 'praise';
status?: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
```

Read the enum definitions to get the exact values — they may differ from what's listed above.

### 4b: waiter-calls.ts

**File:** `packages/api-client/src/wrapper/waiter-calls.ts`

Read the file. Find the `create` method parameter types. Change loose `string` params to literal unions:

```typescript
call_type?: 'assistance' | 'bill' | 'complaint' | 'question' | 'emergency';
priority?: 'low' | 'normal' | 'high' | 'urgent';
status?: 'pending' | 'acknowledged' | 'resolved';
```

Again, check `packages/database/src/enums/index.ts` for exact values.

**Verify:** `cd packages/api-client && npx tsc --noEmit`

After tightening these, run `pnpm type-check` to see if any app code passes invalid strings. If so, note the locations but do NOT fix them in this phase.

---

## Step 5: Use Proper Types in `delivery-customers.ts`

**File:** `packages/api-client/src/wrapper/delivery-customers.ts`

Read the file. The `create` and `update` methods use inline object types for their parameters instead of the typed `DeliveryCustomerInsert` / `DeliveryCustomerUpdate` from `./types`.

Replace inline types with the proper imports:

```typescript
// In create method - replace inline param type with:
async create(data: Omit<DeliveryCustomerInsert, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>)

// In update method - replace inline param type with:
async update(id: string, data: Partial<DeliveryCustomerUpdate>)
```

Read the existing method signatures carefully — the inline types may have slight differences from the DB types (e.g., omitting auto-generated fields). Preserve the same effective contract.

Also: if the `update` method manually sets `updated_at: new Date().toISOString()`, remove it — all other wrappers rely on the DB trigger/default for this. This makes the pattern consistent.

**Verify:** `cd packages/api-client && npx tsc --noEmit`

---

## Final Verification

```bash
pnpm type-check   # Full monorepo TypeScript check — expect possible new errors in apps/
pnpm test          # All unit/integration tests
pnpm check         # Biome lint + format
```

If `pnpm type-check` shows errors in app code (e.g., passing a plain `string` where a literal union is now required), note them in a comment but do NOT fix them — those belong in Phase 8C (customer-web), 8D (mobile), or 8E (staff-web).

## Commit

Commit with message: `refactor: tighten api-client wrapper types — remove 14 any casts and type enum parameters`
