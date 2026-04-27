# Phase 15B: Dead Code — Clean Up App-Level Dead Code

## Goal

Remove dead state variables, dead exported functions, dead hooks, dead files, backward-compat aliases, and fix misplaced code across all three apps.

## Important

- Read each file before editing
- Grep to confirm each export/variable is truly unused before removing
- Run `pnpm type-check` after each step
- Run `pnpm test` at the end
- If a dead export has a corresponding test, remove the test too

---

## Step 1: Staff-Web — Remove Dead State in Settings Page

**File:** `apps/staff-web/src/app/(staff)/settings/page.tsx`

### 1a: Remove `_currentPassword` state (~line 21)

Find:
```typescript
const [_currentPassword, setCurrentPassword] = useState('');
```

`_currentPassword` is never read. `setCurrentPassword` is called in cleanup paths (~lines 74 and 219) to reset the value, but since the value is never read, these resets are pointless.

Remove:
1. The `useState` declaration at line 21
2. All `setCurrentPassword('')` calls (search the file for `setCurrentPassword`)

### 1b: Remove `_showCurrentPassword` state (~line 24)

Find:
```typescript
const [_showCurrentPassword, _setShowCurrentPassword] = useState(false);
```

Both the value and setter are prefixed with `_` — neither is used anywhere. Remove the entire line.

---

## Step 2: Staff-Web — Remove Dead Exported Helper

**File:** `apps/staff-web/src/hooks/use-staff-safe.ts`

Find `formatStaffInfo` (~lines 49-54):
```typescript
export function formatStaffInfo(staff: { full_name: string; role?: string | null }): string {
  const roleLabel = staff.role
    ? ` (${staff.role.charAt(0).toUpperCase() + staff.role.slice(1)})`
    : '';
  return `${staff.full_name}${roleLabel}`;
}
```

This is only imported in tests (`__tests__/hooks/helpers.test.ts`), never in production code.

Remove:
1. The function from `use-staff-safe.ts`
2. The test case from `__tests__/hooks/helpers.test.ts` — read the test file, find the `formatStaffInfo` test block, and remove it. If it's the only test in the file, remove the file.

---

## Step 3: Customer-Web — Remove Dead Utils Exports

**File:** `apps/customer-web/src/lib/utils.ts`

### 3a: Remove `formatPrice` (~lines 11-13)

This function is never imported in production code — all components use `useFormatPrice()` from `@gustri/queries` instead. It's only in tests.

Remove the function. Also remove the test for it from `__tests__/lib/utils.test.ts`.

### 3b: Remove `debounce` (~lines 81-96)

Never imported in production code. Remove the function and its test.

### 3c: Un-export `getElapsedMinutes` (~lines 18-22)

Used internally by `timeAgo` in the same file but never imported externally. Remove the `export` keyword to make it a module-private function:

```typescript
// Before:
export function getElapsedMinutes(...)
// After:
function getElapsedMinutes(...)
```

Update the test file — if tests import `getElapsedMinutes` directly, either remove those tests or keep the export. Read the test file to decide.

---

## Step 4: Customer-Web — Remove Dead Hooks

**File:** `apps/customer-web/src/hooks/use-waiter-call.ts`

### 4a: Remove `useWaiterCalls` (~lines 9-21)

No production component calls this hook. Only used in tests.

Remove the function. Update/remove the corresponding test in `__tests__/hooks/use-waiter-call.test.ts`.

### 4b: Remove `useCallWaiter` alias (~line 61)

```typescript
export const useCallWaiter = useCreateWaiterCall;
```

Only used in one test assertion. No production code uses this alias — all call sites use `useCreateWaiterCall` directly.

Remove the alias. Remove the test assertion that checks `useCallWaiter === useCreateWaiterCall`.

---

## Step 5: Customer-Web — Rename Misleading `query-keys.ts`

**File:** `apps/customer-web/src/lib/query-keys.ts`

This file only exports `STALE_TIMES` — it has no `QUERY_KEYS`. The filename is misleading.

Rename to `stale-times.ts`:
1. Rename the file: `query-keys.ts` → `stale-times.ts`
2. Search for all imports of `@/lib/query-keys` and update to `@/lib/stale-times`

```bash
grep -rn "query-keys" apps/customer-web/src/ --include="*.ts" --include="*.tsx"
```

Update each import path.

---

## Step 6: Mobile — Delete Empty `use-reports.ts`

**File:** `apps/mobile/src/hooks/use-reports.ts`

This file contains only 2 comment lines and no exports. It's a dead placeholder.

Delete the file.

Check if it's imported/exported from `apps/mobile/src/hooks/index.ts`. If so, remove the re-export line.

---

## Step 7: Staff-Web — Remove Auth Store `user` Alias

**File:** `apps/staff-web/src/store/auth-store.ts`

The `user` field is a backward-compat alias for `staff`. Both are set to the same value in `setStaff` and cleared together in `clearAuth`. No production code reads `user` from the store.

### Remove:

1. Remove `user: Staff | null;` from the `AuthStore` interface (~line 7)
2. Remove `user: null,` from the initial state (~line 19)
3. Remove `user: staff,` from `setStaff` (~line 21) — keep just `set({ staff, isLoading: false })`
4. Remove `user: null,` from `clearAuth` (~line 24) — keep just `set({ staff: null, ... })`

Check tests: `__tests__/store/auth-store.test.ts` may assert on `user`. If so, remove those assertions.

After removing, run `pnpm type-check` — if any code references `useAuthStore(s => s.user)`, the TypeScript error will surface it.

---

## Step 8: Customer-Web — Move `getLocalizedField` Out of Types File

**File:** `apps/customer-web/src/types/index.ts`

The `getLocalizedField` function (~lines 38-44) is a runtime function mixed into a types-only file. It IS actively used by 3 menu components.

Move it to the correct location:

1. Cut the function from `types/index.ts`
2. Paste into `apps/customer-web/src/lib/utils.ts` (where other utility functions live)
3. Update imports in the 3 consumer files:
   - `apps/customer-web/src/components/menu/menu-item-modal.tsx`
   - `apps/customer-web/src/components/menu/menu-item-card.tsx`
   - `apps/customer-web/src/components/menu/menu-screen.tsx`

Change from:
```typescript
import { getLocalizedField } from '@/types';
```
To:
```typescript
import { getLocalizedField } from '@/lib/utils';
```

If `types/index.ts` re-exports the function and other files might import it from there, search for all imports:
```bash
grep -rn "getLocalizedField" apps/customer-web/src/ --include="*.ts" --include="*.tsx"
```

---

## Step 9: Customer-Web — Clean Up Dead Settings Hook Exports

**File:** `apps/customer-web/src/hooks/use-settings.ts`

Check if `SETTINGS_ID` constant (~line 16) is used outside the `DEFAULT_SETTINGS` object. If it's only used to populate `DEFAULT_SETTINGS.id`, it can be inlined:

```typescript
// Before:
const SETTINGS_ID = 'some-uuid';
const DEFAULT_SETTINGS = { id: SETTINGS_ID, ... };
// After:
const DEFAULT_SETTINGS = { id: 'some-uuid', ... };
```

Or if `SETTINGS_ID` is exported but never imported externally, un-export it (remove `export` keyword).

---

## Final Verification

```bash
pnpm type-check   # Critical — catches any removed export that was used
pnpm test          # Tests pass after removing dead test cases
pnpm check         # Biome lint
```

Search for any remaining `_`-prefixed variables that signal dead code:
```bash
grep -rn "const \[_" apps/ --include="*.tsx" --include="*.ts" | grep -v "__tests__" | grep -v "node_modules"
```

Review each hit — some are legitimate unused destructured params, others are dead state like the ones fixed above.

## Commit

Commit with message: `chore: remove dead code — unused state, hooks, helpers, aliases, and empty files`
