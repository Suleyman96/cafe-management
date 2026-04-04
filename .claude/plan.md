# Plan: Fix PR #32 Issues

## 1. BUG FIX: Delivery order total must include delivery fee
**File:** `apps/customer-web/src/components/order/delivery-order-status.tsx:219`

Change `formatPrice(order.total)` back to `formatPrice(order.total + (order.delivery_fee || 0))`.

The DB trigger `calculate_order_total` sets `total = subtotal + tax` — delivery_fee is stored separately and must be added at display time.

---

## 2. Complete timezone fix in staff-web (move `getLocalDateString` to `@cafe-idare/core`)

**Step 2a:** Add `getLocalDateString()` to `packages/core/src/utils.ts` (same implementation as mobile's `date-utils.ts`). Export it from `packages/core/src/index.ts`.

**Step 2b:** Update `apps/mobile/src/lib/date-utils.ts` to re-export from `@cafe-idare/core` instead of defining its own.

**Step 2c:** Replace all `toISOString().split('T')[0]` in staff-web with `getLocalDateString()` imported from `@cafe-idare/core`:

| File | Lines | What changes |
|------|-------|-------------|
| `apps/staff-web/src/app/(staff)/reports/page.tsx` | 152, 530 | `todayString`, date input `value` |
| `apps/staff-web/src/app/(staff)/tasks/page.tsx` | 88, 155 | today check, overdue check |
| `apps/staff-web/src/app/(staff)/schedules/page.tsx` | 35 | `formatDate` helper |
| `apps/staff-web/src/app/(staff)/staff/[id]/page.tsx` | 67, 73, 80, 88, 93 | `todayStr`, multiple date helpers |
| `apps/staff-web/src/components/modals/expense-modal.tsx` | 37 | default `expense_date` |
| `apps/staff-web/src/components/modals/waste-log-modal.tsx` | 51 | default `waste_date` |
| `apps/staff-web/src/components/modals/task-modal.tsx` | 39, 237 | default `due_date` |
| `apps/staff-web/src/components/modals/schedule-modal.tsx` | 113 | repeat-week date generation |

**Note:** `reports/page.tsx:530` uses `selectedDate.toISOString().split('T')[0]` as an HTML input value — this will use `getLocalDateString(selectedDate)`.

---

## 3. Performance fix: Dynamic interval for TimeElapsed
**File:** `apps/mobile/src/components/ui/TimeElapsed.tsx`

Change the `setInterval` to use a dynamic interval:
- First 60 seconds: 1-second interval (shows `"45s"`)
- After 60 seconds: 60-second interval (shows `"5m"`, `"1h 23m"`)

Implementation: track the current interval duration in a ref. On each tick, check if we've crossed the 60s threshold and if so, clear the interval and set a new 60s one.

---

## 4. Consolidate pricing utilities into `@cafe-idare/core`

**Step 4a:** The settings-aware functions already exist in `packages/core/src/utils.ts` (`calculateTaxWithSettings`, `calculateTotalWithSettings`, `formatPriceWithSettings`, `getDisplaySubtotal`). They use `PricingSettings` interface which `CafeSettings` already satisfies.

Add convenience aliases that accept `CafeSettings` directly:
- Export `calculateTax` as alias for `calculateTaxWithSettings`
- Export `calculateTotal` as alias for `calculateTotalWithSettings`
- Export `formatPrice` as alias for `formatPriceWithSettings`
- `getDisplaySubtotal` already exists with the right name

Actually, the cleanest approach: rename the `WithSettings` functions to drop the suffix since the simple-taxRate versions (`calculateTax(subtotal, 0.18)`) are the legacy ones. But that's a bigger breaking change. Instead:

**Approach:** Keep current core names. In consumer files, import with aliases:
```ts
import { calculateTaxWithSettings as calculateTax, ... } from '@cafe-idare/core';
```

**Step 4b:** Remove duplicate functions from:
- `apps/customer-web/src/hooks/use-settings.ts` (lines 76-113: `calculateTax`, `calculateTotal`, `getDisplaySubtotal`, `formatPrice`)
- `apps/staff-web/src/hooks/use-settings-safe.ts` (lines 38-72: `formatPriceWithSettings`, `calculateTax`, `calculateTotal`)

**Step 4c:** Update all import sites:

**customer-web** (import from `@cafe-idare/core` instead of `@/hooks/use-settings`):
- `apps/customer-web/src/components/cart/cart-screen.tsx` — `calculateTax`, `calculateTotal`, `getDisplaySubtotal`
- `apps/customer-web/src/components/cart/delivery-cart-screen.tsx` — same
- `apps/customer-web/src/components/menu/menu-cart-sidebar.tsx` — same
- `apps/customer-web/src/hooks/use-format-price.ts` — `formatPrice`

**staff-web** (import from `@cafe-idare/core` instead of `@/hooks/use-settings-safe`):
- `apps/staff-web/src/hooks/use-format-price.ts` — `formatPriceWithSettings`

**Step 4d:** Update tests to import from new locations:
- `apps/customer-web/src/__tests__/hooks/use-settings.test.ts` — pricing function tests now test `@cafe-idare/core` exports
- `apps/staff-web/src/__tests__/hooks/helpers.test.ts` — same

---

## 5. Translate i18n feedback keys for all 19 non-English locales

5 keys to translate in 19 locale files (`packages/i18n/src/locales/*/staff.json`):
- `feedback.dismissConfirm`
- `feedback.status.pending`
- `feedback.status.acknowledged`
- `feedback.status.resolved`
- `feedback.status.dismissed`

Locales: ar, az, de, el, es, fa, fr, id, it, ja, ka, kk, ko, pt, ru, th, tr, uk, uz

AI-assisted best-effort translations.

---

## 6. Improve weak hook tests

Add data-flow and error-path assertions to these wiring-only tests:

**customer-web:**
- `use-menu.test.ts` — add: return value assertions for `useCategories`/`useMenuItems`, error handling test, loading state test
- `use-waiter-call.test.ts` — add: error path for mutation, toast assertion on success

**staff-web:**
- `use-menu-safe.test.ts` — add: return value assertions for query hooks, error handling for mutations
- `use-delivery-safe.test.ts` — add: return value assertions, error path test

For each test file, the pattern is:
```ts
// Data flow: verify the hook returns what the mock resolves
it('returns fetched data', async () => {
  (db.menuItems.findAll as any).mockResolvedValueOnce([mockItem]);
  const { result } = renderHookWithProviders(() => useMenuItems());
  await waitFor(() => expect(result.current.data).toEqual([mockItem]));
});

// Error path: verify error state propagates
it('reports error on rejection', async () => {
  (db.menuItems.findAll as any).mockRejectedValueOnce(new Error('fail'));
  const { result } = renderHookWithProviders(() => useMenuItems());
  await waitFor(() => expect(result.current.isError).toBe(true));
});
```

---

## Execution Order

1. **Delivery fee bug fix** (1 line change, highest priority)
2. **Move `getLocalDateString` to core** + fix all staff-web timezone usages
3. **TimeElapsed dynamic interval**
4. **Consolidate pricing utilities**
5. **i18n translations** (19 files, mechanical)
6. **Improve weak tests** (4 test files)

Then run `pnpm check:fix && pnpm type-check && pnpm test` to verify everything passes.
