# Phase 10C: Consistency — Direct Mutations, useDb Pattern, and findAll API

## Goal

Fix three inconsistency patterns:
1. Direct `db.xxx.update/create()` calls in components bypassing React Query mutations
2. Mobile `use-create-order.ts` importing `db` directly instead of `useDb()`
3. Inconsistent `findAll` filter signatures across api-client wrappers

## Important

- Read each file before editing
- Run `pnpm type-check` after each step
- Run `pnpm test` at the end

---

## Step 1: Wrap Direct Mutations in React Query (2 files)

### 1a: Staff-Web Settings Page

**File:** `apps/staff-web/src/app/(staff)/settings/page.tsx`

Find `handleChangeLanguage` (~lines 27-39):
```typescript
const handleChangeLanguage = async (lang: string) => {
  setLanguageLoading(true);
  try {
    await loadAndSwitchLanguage(lang);
    if (staff?.id) {
      await db.staff.update(staff.id, { preferred_language: lang });
    }
    toast.success(t('settings.languageChanged'));
  } catch {
    toast.error(t('error', { ns: 'common' }));
  } finally {
    setLanguageLoading(false);
  }
};
```

Problems:
- Manually manages `languageLoading` state instead of using `isPending`
- No query cache invalidation after the update
- Bypasses global mutation error handler in providers

Replace with a `useMutation` pattern. Read the file to see what mutation hooks exist or how other staff-web pages handle mutations.

```typescript
const updateLanguageMutation = useMutation({
  mutationFn: async (lang: string) => {
    await loadAndSwitchLanguage(lang);
    if (staff?.id) {
      await db.staff.update(staff.id, { preferred_language: lang });
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['staff'] });
    toast.success(t('settings.languageChanged'));
  },
  onError: () => {
    toast.error(t('error', { ns: 'common' }));
  },
});

const handleChangeLanguage = (lang: string) => {
  updateLanguageMutation.mutate(lang);
};
```

Replace `languageLoading` with `updateLanguageMutation.isPending` in the JSX. Then remove the `languageLoading` state entirely if it was only used for this.

Make sure to import `useMutation` from `@tanstack/react-query` and `useQueryClient` if not already imported.

### 1b: Customer-Web Feedback Form

**File:** `apps/customer-web/src/components/feedback/feedback-form.tsx`

Find `handleSubmit` (~lines 48-83):
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  ...
  setIsSubmitting(true);
  try {
    await db.feedback.create({
      table_id: tableId,
      tenant_id: tenantId,
      order_id: orderId || null,
      feedback_type: feedbackType,
      message: message.trim(),
    });
    ...
  } catch (error) { ... }
  finally { setIsSubmitting(false); }
};
```

Check if there's already a `useCreateFeedback` mutation hook somewhere in customer-web. Search for it:
- `apps/customer-web/src/hooks/` — look for a feedback hook

If a mutation hook exists, use it. If not, create the mutation inline:

```typescript
const createFeedbackMutation = useMutation({
  mutationFn: (data: { table_id: string; tenant_id: string; order_id: string | null; feedback_type: string; message: string }) => {
    return db.feedback.create(data);
  },
  onSuccess: () => {
    toast.success(t('feedback.success'));
    setMessage('');
    setFeedbackType('');
    onClose?.();
  },
  onError: (error) => {
    Sentry.captureException(error);
    toast.error(t('feedback.error'));
  },
});
```

Replace `isSubmitting` state with `createFeedbackMutation.isPending`. Remove manual `setIsSubmitting` state.

Read the existing `handleSubmit` carefully — it may have form validation, reset logic, and success callbacks (`onClose`, `setIsSubmitted`) that must be preserved in `onSuccess`.

---

## Step 2: Fix Mobile `use-create-order.ts` to Use `useDb()`

**File:** `apps/mobile/src/hooks/use-create-order.ts`

Find line ~7:
```typescript
import { db } from '@/lib/supabase';
```

And the mutation at ~line 15:
```typescript
return await db.orders.create(orderData);
```

This imports a module-level singleton `db` instead of using the `useDb()` hook from `@gustri/queries`, which provides a tenant-aware instance through React context.

### Fix:

Read the file fully. Replace the import and use `useDb()` inside the hook:

```typescript
// Remove: import { db } from '@/lib/supabase';
import { useDb } from '@gustri/queries';

export function useCreateOrder() {
  const db = useDb();
  
  return useMutation({
    mutationFn: async (orderData: ...) => {
      return await db.orders.create(orderData);
    },
    // ... rest of mutation config
  });
}
```

Read `apps/mobile/src/hooks/use-stock.ts` or `use-expenses.ts` to see the correct pattern and match it exactly:
- `useDb()` is called at the top level of the custom hook (not inside `mutationFn`)
- The `db` variable is then used inside `mutationFn`

Verify that `@gustri/queries` exports `useDb` — search for `export.*useDb` in `packages/`.

---

## Step 3: Standardize `findAll` Filter API (api-client wrappers)

The current inconsistency:

| Wrapper | Current signature | Pattern |
|---------|------------------|---------|
| `staff.ts` | `findAll(role?: string)` | positional |
| `waiter-calls.ts` | `findAll(status?, options?)` | mixed |
| `feedback.ts` | `findAll(status?, options?)` | mixed |
| `orders.ts` | `findAll(filters?: {...})` | options object |
| `menu.ts` | `findAll(options?: {...})` | options object |
| `stock.ts` | `findAll(options?: {...})` | options object |
| `tasks.ts` | `findAll(options?: {...})` | options object |
| `expenses.ts` | `findAll(options?: {...})` | options object |
| `waste.ts` | `findAll(options?: {...})` | options object |
| `tables.ts` | `findAll()` | no params |
| `expenseCategories` | `findAll()` | no params |

The **options object** pattern (Pattern C) is the most common and most extensible. Standardize the 3 outliers (`staff`, `waiter-calls`, `feedback`) to use it.

### 3a: Fix `staff.ts`

**File:** `packages/api-client/src/wrapper/staff.ts`

Find `findAll` (~line 10):
```typescript
findAll: async (role?: string) => {
```

Change to options object:
```typescript
findAll: async (options?: { role?: string }) => {
```

Update the body: `role` → `options?.role`. Read the full method body to see where `role` is used (likely in a `.eq('role', role)` filter).

Then search ALL callers of `db.staff.findAll(` across the monorepo:
- `grep -r "staff.findAll" apps/ packages/`

Update each call site:
- `db.staff.findAll('admin')` → `db.staff.findAll({ role: 'admin' })`
- `db.staff.findAll()` → `db.staff.findAll()` (no change needed)

### 3b: Fix `waiter-calls.ts`

**File:** `packages/api-client/src/wrapper/waiter-calls.ts`

Find `findAll` (~line 49):
```typescript
findAll: async (status?: WaiterCallRow['status'], options?: { limit?, offset? }) => {
```

Change to single options object:
```typescript
findAll: async (options?: { status?: WaiterCallRow['status']; limit?: number; offset?: number }) => {
```

Update the body: `status` → `options?.status`, `options?.limit` stays the same.

Search ALL callers:
- `grep -r "waiterCalls.findAll" apps/ packages/`

Update each call site:
- `db.waiterCalls.findAll('pending')` → `db.waiterCalls.findAll({ status: 'pending' })`
- `db.waiterCalls.findAll('pending', { limit: 10 })` → `db.waiterCalls.findAll({ status: 'pending', limit: 10 })`
- `db.waiterCalls.findAll()` → `db.waiterCalls.findAll()` (no change)

### 3c: Fix `feedback.ts`

**File:** `packages/api-client/src/wrapper/feedback.ts`

Find `findAll` (~line 32):
```typescript
findAll: async (status?: CustomerFeedbackRow['status'], options?: { limit?, offset? }) => {
```

Change to single options object:
```typescript
findAll: async (options?: { status?: CustomerFeedbackRow['status']; limit?: number; offset?: number }) => {
```

Same pattern — update body and all callers.

### 3d: Add `status` filter to `tables.ts` if useful

**File:** `packages/api-client/src/wrapper/tables.ts`

Read the file. `findAll` has no parameters. Check if any app code filters tables by status after fetching all. If so, adding a `status` filter option would be beneficial:

```typescript
findAll: async (options?: { status?: string }) => {
```

Only add this if there are callers that would benefit. If all callers just use `findAll()` and filter client-side, consider adding the filter but keep backward compatibility (no params = return all).

---

## Final Verification

```bash
pnpm type-check   # Critical — wrapper signature changes affect all apps
pnpm test          # Ensure all tests pass
pnpm check         # Biome
```

Search for any remaining callers that weren't updated:
```bash
grep -r "staff\.findAll\(" apps/ packages/ --include="*.ts" --include="*.tsx"
grep -r "waiterCalls\.findAll\(" apps/ packages/ --include="*.ts" --include="*.tsx"
grep -r "feedback\.findAll\(" apps/ packages/ --include="*.ts" --include="*.tsx"
```

## Commit

Commit with message: `refactor: wrap direct mutations in React Query, fix useDb pattern, standardize findAll API`
