# Phase 11D: Error Handling — Add Missing Type Guards in API Client Wrappers

## Goal

Several api-client wrapper methods return raw data without runtime type guard validation. The `feedback.ts` wrapper sets the standard — it calls `isCustomerFeedback(result)` after insert and throws if validation fails. Apply this pattern to wrappers that skip it: `refunds`, `schedules`, and `delivery-customers`.

## Important

- Read each wrapper file AND the corresponding type guard in `packages/core/src/type-guards.ts` before editing
- If a type guard doesn't exist for the entity, it was added in Phase 8A — verify it exists
- Run `pnpm type-check && pnpm test` after changes
- Match the exact pattern used in `feedback.ts`

---

## Step 0: Understand the Pattern

**File:** `packages/api-client/src/wrapper/feedback.ts` — the reference implementation (~lines 10-29):

```typescript
create: async (data: {...}) => {
  const { data: result, error } = await ctx.anyClient
    .from('customer_feedback')
    .insert({...})
    .select()
    .single();

  if (error) throw handleSupabaseError(error);
  if (!isCustomerFeedback(result)) throw new Error('Invalid feedback data');
  return result as CustomerFeedbackRow;
},
```

The pattern:
1. Execute the Supabase operation
2. Check `error` — throw mapped error if present
3. Check type guard — throw if data shape is wrong
4. Return typed result

---

## Step 1: Add Type Guard to `refunds.ts`

**File:** `packages/api-client/src/wrapper/refunds.ts`

Read the `create` method (~lines 10-30). It currently returns `data` without a type guard.

Add the guard after the error check. First, check if `isRefund` exists in `packages/core/src/type-guards.ts` (it should have been added in Phase 8A). Import it:

```typescript
import { isRefund } from '@gustri/core';
```

Then add after `if (error) throw handleSupabaseError(error);`:

```typescript
if (!isRefund(data)) throw new Error('Invalid refund data');
return data;
```

Also check `findByOrderId` and `findByDateRange` methods in the same file — if they return arrays without guards, add:

```typescript
// For array returns, validate the first element or skip (arrays from .select() are generally safe)
```

Array returns from `.select()` (without `.single()`) are less risky since they return `[]` on no match rather than `null`. Focus on `.single()` returns.

---

## Step 2: Add Type Guards to `schedules.ts`

**File:** `packages/api-client/src/wrapper/schedules.ts`

Read the file. Find all methods that call `.single()` and return the result without a guard. Expected methods: `create`, `update`, `markInProgress`, `markCompleted`, `markMissed`.

Check if `isStaffSchedule` exists in `packages/core/src/type-guards.ts`. Import it:

```typescript
import { isStaffSchedule } from '@gustri/core';
```

Add the guard to each `.single()` method. Example for `create`:

```typescript
create: async (data: StaffScheduleInsert) => {
  const { data: result, error } = await ctx.anyClient
    .from('staff_schedules')
    .insert(data)
    .select(STAFF_JOIN)
    .single();

  if (error) throw handleSupabaseError(error);
  if (!isStaffSchedule(result)) throw new Error('Invalid schedule data');
  return result;
},
```

Apply the same pattern to `update`, `markInProgress`, `markCompleted`, `markMissed`.

For `findByDate`, `findByStaffAndDate`, `findByStaffRange`, `findByDateRange` — these return arrays. Skip guard for array returns (Supabase returns `[]` for no match, not `null`).

For `findById` (if it exists and uses `.single()`) — add the guard.

---

## Step 3: Add Type Guard to `delivery-customers.ts`

**File:** `packages/api-client/src/wrapper/delivery-customers.ts`

Read the file. Check if `isDeliveryCustomer` exists in `packages/core/src/type-guards.ts` (added in Phase 8A).

Find methods that use `.single()`: likely `create`, `update`, `findByPhone`.

Import and add the guard:

```typescript
import { isDeliveryCustomer } from '@gustri/core';
```

For each `.single()` method:
```typescript
if (error) throw handleSupabaseError(error);
if (!isDeliveryCustomer(data)) throw new Error('Invalid delivery customer data');
return data;
```

---

## Step 4: Audit Other Wrappers for Missing Guards

Do a quick check of all wrapper files to find any others that skip the type guard pattern. Read each file's `create` and `update` methods:

- `packages/api-client/src/wrapper/orders.ts` — check `create`
- `packages/api-client/src/wrapper/tables.ts` — check `create`, `update`
- `packages/api-client/src/wrapper/staff.ts` — check `create`, `update`
- `packages/api-client/src/wrapper/menu.ts` — check `createMenuItem`, `updateMenuItem`
- `packages/api-client/src/wrapper/stock.ts` — check `create`, `update`
- `packages/api-client/src/wrapper/tasks.ts` — check `create`, `update`
- `packages/api-client/src/wrapper/waste.ts` — check `create`
- `packages/api-client/src/wrapper/expenses.ts` — check `create`, `update`
- `packages/api-client/src/wrapper/payments.ts` — check `create`

For any `.single()` return without a type guard, add one. If the corresponding `isXxx` guard exists in `@gustri/core`, use it. If it doesn't exist, note it but don't create it in this phase — that's Phase 8A work.

---

## Final Verification

```bash
pnpm type-check
pnpm test
pnpm check
```

## Commit

Commit with message: `fix: add missing type guards to api-client wrapper methods for runtime validation`
