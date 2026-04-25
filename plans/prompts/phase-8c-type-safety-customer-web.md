# Phase 8C: Type Safety — customer-web (13 issues → 0)

## Goal

Eliminate all 5 `as Function` casts, 3 `as unknown as` double casts, and ~5 `any` usages in `apps/customer-web/src/`. This is the smallest app-level fix and lowest risk.

## Prerequisites

- Phase 8A complete (RPC types exist in `packages/database/src/types/database.ts`)
- Phase 8B complete (api-client wrapper types tightened)

## Important

- Read each file before editing
- Run `pnpm type-check` after each step
- Do NOT touch other apps or packages
- Do NOT touch test files

---

## Step 1: Remove `as Function` Casts from RPC Calls (5 casts removed)

The 3 RPCs (`get_active_order_for_table`, `get_delivery_order`, `get_waiter_calls_for_table`) are now typed in `Database['public']['Functions']` (added in Phase 8A). The `as Function` casts can be removed.

### 1a: `apps/customer-web/src/hooks/use-order.ts`

Find line ~15:
```typescript
const { data, error } = await (supabase.rpc as Function)('get_active_order_for_table', {
```

Replace with:
```typescript
const { data, error } = await supabase.rpc('get_active_order_for_table', {
```

Find line ~21:
```typescript
return data as unknown as OrderWithItems;
```

Since the RPC returns `Json`, a single cast is still needed but simplify the double cast:
```typescript
return data as OrderWithItems;
```

### 1b: `apps/customer-web/src/hooks/use-delivery.ts`

Find line ~15:
```typescript
const { data, error } = await (supabase.rpc as Function)('get_delivery_order', {
```

Replace with:
```typescript
const { data, error } = await supabase.rpc('get_delivery_order', {
```

Find line ~21 — simplify:
```typescript
return data as DeliveryOrderWithDetails;
```

Also: check if `DeliveryOrderWithDetails` is imported from a local `@/types` file. If so, update the import to use `@gustri/database` instead (added in Phase 8A). If both exist, prefer the `@gustri/database` import.

### 1c: `apps/customer-web/src/hooks/use-waiter-call.ts`

Find line ~13:
```typescript
const { data, error } = await (supabase.rpc as Function)('get_waiter_calls_for_table', {
```

Replace with:
```typescript
const { data, error } = await supabase.rpc('get_waiter_calls_for_table', {
```

Find line ~18 — simplify:
```typescript
return (data as WaiterCall[]) || [];
```

### 1d: `apps/customer-web/src/lib/supabase.ts`

Find line ~61:
```typescript
await (supabase.rpc as Function)('set_table_context', { qr_token: qrToken });
```

`set_table_context` was already typed in the Database Functions type. Remove the cast:
```typescript
await supabase.rpc('set_table_context', { qr_token: qrToken });
```

### 1e: `apps/customer-web/src/components/table/table-landing.tsx`

Find line ~55:
```typescript
(supabase.rpc as Function)('get_tenant_plan_from_context')
```

Remove the cast:
```typescript
supabase.rpc('get_tenant_plan_from_context')
```

Find line ~56:
```typescript
.then((res: any) => {
```

The typed RPC returns `{ data: string | null; error: PostgrestError | null }`. Remove `any`:
```typescript
.then((res) => {
```

Find line ~61:
```typescript
.catch((err: any) => {
```

Change to:
```typescript
.catch((err: unknown) => {
```

If the body accesses `err.message` or similar, add narrowing or use the `getErrorMessage` utility from `@gustri/core`.

**Verify:** `cd apps/customer-web && npx tsc --noEmit`

---

## Step 2: Fix Remaining `any` Usages

### 2a: `apps/customer-web/src/store/language-store.ts`

Find line ~21:
```typescript
migrate: (persisted: any, version: number) => {
```

Change to:
```typescript
migrate: (persisted: unknown, version: number) => {
```

Read the body — if it accesses properties on `persisted`, add type narrowing:
```typescript
const state = persisted as Partial<LanguageState> | undefined;
```

### 2b: `apps/customer-web/src/types/index.ts`

Read this file. Check if `DeliveryOrderWithDetails` is defined locally here. If so, replace with a re-export from `@gustri/database`:

```typescript
export type { DeliveryOrderWithDetails } from '@gustri/database';
```

If `OrderWithItems` is also defined locally and matches the one in `@gustri/database`, do the same.

**Verify:** `cd apps/customer-web && npx tsc --noEmit`

---

## Final Verification

```bash
pnpm type-check   # Full monorepo
pnpm test          # All tests
pnpm check         # Biome
```

## Commit

Commit with message: `refactor: remove all as Function casts and any usages in customer-web`
