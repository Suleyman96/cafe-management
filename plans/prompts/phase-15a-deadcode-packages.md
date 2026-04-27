# Phase 15A: Dead Code — Clean Up Shared Packages

## Goal

Remove dead exports from `packages/core`, `packages/database`, and `packages/ui` that are never imported by any app or are broken/vestigial.

## Important

- Read each file before editing
- Grep for each export before removing to confirm zero consumers
- Run `pnpm type-check` after each step — removing an export that IS used will cause a build error (safe to catch)
- Run `pnpm test` at the end
- Do NOT remove exports used only in tests without also removing/updating the test

---

## Step 1: Remove Dead Constants from `@gustri/core`

**File:** `packages/core/src/constants.ts`

Read the file. Find and remove these 4 dead exports:

### 1a: `SOUNDS` (~lines 90-94)

```typescript
export const SOUNDS = {
  NEW_ORDER: 'new-order',
  WAITER_CALL: 'waiter-call',
  ORDER_READY: 'order-ready',
} as const;
```

Confirm zero imports: `grep -r "SOUNDS" apps/ packages/ --include="*.ts" --include="*.tsx" | grep -v "constants.ts" | grep -v "__tests__" | grep -v "node_modules" | grep -v "plans/"`

Remove the constant.

### 1b: `API_ENDPOINTS` (~lines 104-114)

Same pattern — confirm zero imports, then remove.

### 1c: `TAX_RATE` (~line 62)

```typescript
export const TAX_RATE = 0.18;
```

This is re-exported by `apps/staff-web/src/types/index.ts` but never actually imported from there. Confirm:
- Grep for `TAX_RATE` across all apps — should find only the definition and the re-export shim
- Remove from `packages/core/src/constants.ts`
- Also remove the re-export from `apps/staff-web/src/types/index.ts`

### 1d: `STORAGE_KEYS` (~lines 97-101)

Same pattern — re-exported by staff-web types but never imported. Remove from both locations.

---

## Step 2: Remove Unused Array Type Guards from `@gustri/core`

**File:** `packages/core/src/type-guards.ts`

8 array type-guard functions are exported but have zero production consumers outside of unit tests:
- `isOrderArray`
- `isMenuItemArray`
- `isWaiterCallArray`
- `isCustomerFeedbackArray`
- `isOrderPaymentArray`
- `isStaffScheduleArray`
- `isWasteLogArray`
- `isTaskArray`

**Keep these 4** (used by `packages/api-client/src/wrapper/`):
- `isTableArray`
- `isCategoryArray`
- `isStaffArray`
- `isOrderItemArray`

### Before removing:

Check `packages/core/src/__tests__/type-guards.test.ts` — it tests these array guards. You'll need to also remove the corresponding test cases to avoid test failures.

For each of the 8 dead guards:
1. Grep to confirm zero production imports
2. Remove the function from `type-guards.ts`
3. Remove the corresponding test case from `type-guards.test.ts`

---

## Step 3: Remove Dead Compatibility Aliases from `@gustri/database`

**File:** `packages/database/src/types/index.ts`

3 type aliases are never imported by any app:
- `OrderItems` (alias for `OrderItem`) — dead
- `Categories` (alias for `Category`) — dead
- `Feedback` (alias for `CustomerFeedback`) — dead

**Keep these 3** (actively used by staff-web):
- `Tables` (used in table-card.tsx, table-modal.tsx, table-transfer-modal.tsx)
- `WaiterCalls` (used in table-card.tsx)
- `MenuItems` (used in staff-web types/index.ts)

For each dead alias:
1. Grep to confirm zero imports: `grep -r "OrderItems" apps/ packages/ --include="*.ts" --include="*.tsx" | grep -v "types/index.ts" | grep -v "node_modules"`
2. Remove the `export type` line

---

## Step 4: Fix Broken `asChild` Prop in `@gustri/ui` Button

**File:** `packages/ui/src/button.tsx`

The `asChild?: boolean` prop is declared in `ButtonProps` (~line 35) but never implemented in the component body. There is no Radix `Slot` import or conditional rendering. The prop silently does nothing.

### Fix options:

**Option A (remove it):** If no caller passes `asChild` to `Button`, remove the prop entirely:

Search for `asChild` across the monorepo:
```bash
grep -r "asChild" apps/ packages/ --include="*.ts" --include="*.tsx"
```

If zero callers pass it → remove `asChild?: boolean` from `ButtonProps`. Since it's spread into `...props` and forwarded to `<button>`, removing it from the interface just removes the TypeScript suggestion — no runtime change.

**Option B (implement it):** If callers do pass `asChild`, implement the Radix Slot pattern:
```typescript
import { Slot } from '@radix-ui/react-slot';

const Comp = asChild ? Slot : 'button';
return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
```

Only do this if `@radix-ui/react-slot` is already a dependency. Otherwise, remove the prop.

Read the file and check `packages/ui/package.json` for `@radix-ui/react-slot` in dependencies.

---

## Final Verification

```bash
pnpm type-check   # Catches any removed export that was actually used
pnpm test          # Tests should pass (after removing corresponding test cases)
pnpm check         # Biome
```

## Commit

Commit with message: `chore: remove dead exports from core, database, and ui packages`
