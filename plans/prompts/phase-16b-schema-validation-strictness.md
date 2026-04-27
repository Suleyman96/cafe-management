# Phase 16B: Schema / Data Integrity — Fix Validation Strictness and Add Inferred Type Exports

## Goal

Fix two categories of schema issues:
1. Several Zod schemas use `.positive()` which blocks zero values — this prevents free menu items (price=0) and zero-quantity corrections
2. 19 table schemas have no `z.infer<>` type exports — callers must write `z.infer<typeof XxxSchema>` manually

## Important

- Read each file before editing
- Run `pnpm type-check && pnpm test` after changes
- These are validation-layer changes — consider business rules before relaxing constraints

---

## Step 1: Review and Fix `.positive()` Constraints

**File:** `packages/database/src/schemas/index.ts`

Read the file and find each `.positive()` usage. For each one, decide if it should be `.nonnegative()` (allows 0) or stay `.positive()` (rejects 0).

### 1a: `MenuItemSchema.price` (~line 172)

```typescript
price: z.number().positive(),
```

**Problem:** Rejects `price = 0`. Free promotional items or complimentary items can't be created.

**Fix:** Change to `.nonnegative()`:
```typescript
price: z.number().nonnegative(),
```

### 1b: `WasteLogSchema.quantity` (~line 333)

```typescript
quantity: z.number().positive(),
```

**Problem:** Rejects `quantity = 0`. Zero-quantity correction entries are blocked.

**Decision:** Waste logs should always have positive quantity — you don't log "zero waste." Keep `.positive()`. This is correct.

**Action:** No change. Leave as-is.

### 1c: `ExpenseSchema.amount` (~line 317)

```typescript
amount: z.number().positive(),
```

**Problem:** Rejects `amount = 0` and negative amounts. If expense refunds or credits are ever recorded in the expenses table (e.g., supplier rebate), they'd be blocked.

**Decision:** Currently refunds go through the separate `refunds` table, not `expenses`. But a zero-amount expense is semantically meaningless. Keep `.positive()` unless there's a business need for zero/negative expenses.

**Action:** No change. Leave as-is. Add a comment:
```typescript
amount: z.number().positive(), // Refunds go through the refunds table, not expenses
```

### 1d: `OrderPaymentSchema.amount` (~line 240)

```typescript
amount: z.number().positive(),
```

**Problem:** Rejects zero-amount payments. A zero-amount payment is unlikely but payment reversals as negative amounts would be blocked.

**Decision:** Payment amounts should always be positive — reversals are handled through refunds. Keep `.positive()`.

**Action:** No change. Leave as-is.

### 1e: `RefundSchema.amount` (~line 425)

```typescript
amount: z.number().positive(),
```

**Correct.** Refund amounts should always be positive (they represent money returned). No change.

### 1f: `OrderItemSchema.quantity` (~line 143)

```typescript
quantity: z.number().int().positive(),
```

**Correct.** Order items must have at least 1. No change.

### Summary: Only `MenuItemSchema.price` needs to change from `.positive()` to `.nonnegative()`.

---

## Step 2: Add Inferred Type Exports for All Table Schemas

**File:** `packages/database/src/schemas/index.ts`

Find the inferred type exports section at the bottom of the file (~lines 448-470). Currently only enum types and `DeliveryCustomerInput` are exported.

Add `z.infer<>` type exports for all 19 table schemas. These provide named types for the Zod-validated form of each table:

```typescript
// Table schema inferred types
export type OrderInput = z.infer<typeof OrderSchema>;
export type OrderItemInput = z.infer<typeof OrderItemSchema>;
export type TableInput = z.infer<typeof TableSchema>;
export type MenuItemInput = z.infer<typeof MenuItemSchema>;
export type StaffInput = z.infer<typeof StaffSchema>;
export type WaiterCallInput = z.infer<typeof WaiterCallSchema>;
export type CustomerFeedbackInput = z.infer<typeof CustomerFeedbackSchema>;
export type OrderPaymentInput = z.infer<typeof OrderPaymentSchema>;
export type TableTransferInput = z.infer<typeof TableTransferSchema>;
export type StaffScheduleInput = z.infer<typeof StaffScheduleSchema>;
export type StockItemInput = z.infer<typeof StockItemSchema>;
export type StockMovementInput = z.infer<typeof StockMovementSchema>;
export type ExpenseCategoryInput = z.infer<typeof ExpenseCategorySchema>;
export type ExpenseInput = z.infer<typeof ExpenseSchema>;
export type WasteLogInput = z.infer<typeof WasteLogSchema>;
export type TaskCategoryInput = z.infer<typeof TaskCategorySchema>;
export type TaskInput = z.infer<typeof TaskSchema>;
export type CafeSettingsInput = z.infer<typeof CafeSettingsSchema>;
export type RefundInput = z.infer<typeof RefundSchema>;
export type TenantInput = z.infer<typeof TenantSchema>;
export type CategoryInput = z.infer<typeof CategorySchema>;
```

Note: `DeliveryCustomerInput` should already exist from Phase 16A or already in the file. Don't duplicate it — check before adding.

Also note: `TenantInput` and `CategoryInput` depend on `TenantSchema` and `CategorySchema` being added in Phase 16A. If Phase 16A hasn't been completed, omit those two until the schemas exist.

### Naming convention

The `*Input` suffix distinguishes these from the DB Row types (`Order`, `Table`, `Staff`, etc.) which are TypeScript interfaces derived from `Database['public']['Tables']`. The `*Input` types are the Zod-validated forms — they have the same fields but carry Zod's validation constraints at the type level.

If any name conflicts with an existing export (e.g., if `OrderInput` already exists somewhere), use `Validated*` prefix instead:
```typescript
export type ValidatedOrder = z.infer<typeof OrderSchema>;
```

Read the existing exports at the bottom of the file to avoid collisions.

---

## Step 3: Export New Types from Package Barrel

**File:** `packages/database/src/index.ts`

Read the file. It likely does `export * from './schemas'` already, which would automatically export the new inferred types. Verify this is the case.

If not, add explicit re-exports or a wildcard export for the schemas module.

---

## Final Verification

```bash
pnpm type-check   # New type exports should compile cleanly
pnpm test          # All tests pass
pnpm check         # Biome
```

Verify the types are accessible from apps:
```typescript
// This should work in any app:
import type { MenuItemInput, OrderInput } from '@gustri/database';
```

## Commit

Commit with message: `fix: allow zero-price menu items, add inferred type exports for all Zod table schemas`
