# Phase 6 Prompt: Frontend Architecture & Test Quality (SCALE-13 + SCALE-14 + SCALE-15 + SCALE-16)

Copy everything below the line and paste it as the prompt for a new Claude Code session.

---

## Task

Implement Phase 6 (SCALE-13, SCALE-14, SCALE-15, SCALE-16) from `plans/07-SCALING-AND-ARCHITECTURE-fixes.md`. Read that file for full context, but this prompt contains the verified details you need. Phases 1-5 have already been implemented.

## Context

Phase 1 already moved reports to server-side aggregate hooks (`useRevenueSummary`, `useTopSoldItems`, `useExpenseSummary`, `useWasteSummary`). Customer-web already has 8 server components. The `as any` count in tests has been reduced from 250+ to 38. This phase builds on that foundation.

---

## SCALE-13: SSR for key pages

### Goal
Convert the most impactful customer-web pages to use server-side data fetching with Next.js server components. Staff-web pages that don't need realtime can also benefit, but customer-web is the priority (public-facing, mobile users, SEO matters for the landing/delivery pages).

### Current state (verified)

**Customer-web already has server components** for table-scoped pages:
- `apps/customer-web/src/app/table/[tableId]/page.tsx` — server component
- `apps/customer-web/src/app/table/[tableId]/menu/page.tsx` — server component
- `apps/customer-web/src/app/table/[tableId]/cart/page.tsx` — server component
- `apps/customer-web/src/app/table/[tableId]/order/page.tsx` — server component
- `apps/customer-web/src/app/delivery/cart/page.tsx` — server component
- `apps/customer-web/src/app/delivery/order/[orderId]/page.tsx` — server component

**Still client-rendered (have `'use client'`):**
- `apps/customer-web/src/app/page.tsx` — home/landing page
- `apps/customer-web/src/app/delivery/page.tsx` — delivery landing page
- `apps/customer-web/src/app/delivery/menu/page.tsx` — delivery menu
- `apps/customer-web/src/app/delivery/layout.tsx` — delivery layout
- `apps/customer-web/src/app/table/[tableId]/layout.tsx` — table layout

**Staff-web reports** (`apps/staff-web/src/app/(staff)/reports/page.tsx`):
- Still `'use client'` on line 1
- BUT already uses server-side aggregate hooks from Phase 1 (`useRevenueSummary`, `useTopSoldItems`, etc.)
- The page itself stays as a client component because it has interactive date picker state, chart interactions, and PDF export. This is correct — the data fetching is already server-side via RPC, the component just needs client interactivity.

**Customer-web Supabase client** (`apps/customer-web/src/lib/supabase.ts`):
- Client-side only: `createClient<Database>` with `persistSession: false`
- `db = createSupabaseWrapper(supabase)` for type-safe queries
- No server-side Supabase client exists yet in customer-web

**Customer-web providers** (`apps/customer-web/src/components/providers.tsx`):
- React Query with `staleTime: 60s`, `refetchOnWindowFocus: true`
- `DbProvider` wraps children with the Supabase wrapper
- `I18nextProvider` for translations

### What to implement

The highest-impact SSR conversion is the **delivery landing page** — it's the first thing delivery customers see, and it's currently fully client-rendered.

**Step 1** — Create a server-side Supabase client for customer-web. Staff-web already has one at `apps/staff-web/src/lib/supabase/server.ts` — use the same pattern:

```typescript
// apps/customer-web/src/lib/supabase-server.ts
import type { Database } from '@gustri/database';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createServerSupabase() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server Components are read-only
        },
      },
    },
  );
}
```

Add `@supabase/ssr` as a dependency in customer-web if not already present (staff-web has it — check `apps/customer-web/package.json`).

**Step 2** — Convert the delivery menu page to a server component. Currently `apps/customer-web/src/app/delivery/menu/page.tsx` has `'use client'`. If this page fetches menu items on mount, the initial render is blank until the query resolves.

Read the current implementation, then convert to:

```typescript
// apps/customer-web/src/app/delivery/menu/page.tsx
// NO 'use client' directive — this is a server component
import { createServerSupabase } from '@/lib/supabase-server';
import { DeliveryMenuScreen } from '@/components/delivery/delivery-menu-screen';

export default async function DeliveryMenuPage() {
  const supabase = createServerSupabase();

  // Fetch menu items and categories server-side
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  const { data: menuItems } = await supabase
    .from('menu_items')
    .select('*, categories(*)')
    .eq('is_available', true)
    .order('display_order')
    .limit(500);

  return (
    <DeliveryMenuScreen
      initialCategories={categories ?? []}
      initialMenuItems={menuItems ?? []}
    />
  );
}
```

The `DeliveryMenuScreen` client component then uses the `initialData` prop for React Query hydration:

```typescript
'use client';
// ... existing imports ...

export function DeliveryMenuScreen({
  initialCategories,
  initialMenuItems,
}: {
  initialCategories: Category[];
  initialMenuItems: MenuItemWithCategory[];
}) {
  const { data: categories } = useCategories({ initialData: initialCategories });
  const { data: menuItems } = useMenuItems({ initialData: initialMenuItems });
  // ... rest of existing component
}
```

**Important**: Read the actual delivery menu page and component first. The pattern above is illustrative — adapt it to whatever the real component structure is. The key principle: fetch data in the server component, pass as `initialData` to client component, client component uses React Query with the initial data for hydration + subsequent updates.

**Step 3** — If time permits, apply the same pattern to the customer-web home page (`apps/customer-web/src/app/page.tsx`). But only if it fetches data on mount — if it's just a static landing page with links, leave it as-is.

**What NOT to convert:**
- Staff-web order/table/kitchen pages — they need realtime, must stay client
- Staff-web reports page — already has server-side data via RPC hooks, client component is correct for interactivity
- Any page with heavy user interaction (forms, modals, state) — the page itself should stay client, but data fetching can be lifted to server parent

### Verification
- Delivery menu page renders on first load without a loading spinner (data already fetched server-side)
- Disable JavaScript in browser → delivery menu page still shows categories and items (SSR working)
- Client-side navigation to delivery menu page still works (React Query hydrates from initial data)
- `pnpm build --filter=@gustri/customer-web` succeeds with no hydration mismatch warnings
- Run `pnpm test && pnpm type-check && pnpm check`

---

## SCALE-14: Real E2E tests

### Goal
Replace the current smoke tests with tests that exercise actual business flows. The existing tests only assert `page.locator('body').toBeVisible()` — they pass even if the app is completely broken.

### Current state (verified)

**Staff-web E2E** (`apps/staff-web/e2e/`):
- `fixtures.ts` — creates authenticated context (login as admin@test.com/test1234), exposes `staffPage`
- `order-lifecycle.spec.ts` — 4 tests, all smoke tests (page loads without error)
- `orders.spec.ts` — exists (check content)
- `auth.spec.ts` — exists (check content)
- `security.spec.ts` — exists (check content)

**Customer-web E2E** (`apps/customer-web/e2e/`):
- `order-flow.spec.ts` — 4 tests: page load, category visibility, menu item visibility, empty cart
- `menu.spec.ts` — exists (check content)
- `waiter-call.spec.ts` — exists (check content)

**Playwright config** (both apps):
- Staff-web: baseURL `http://localhost:3001`, port 3001
- Customer-web: baseURL `http://localhost:3000`, port 3000
- Both: `reuseExistingServer: !process.env.CI`, 2 retries in CI

**Existing `data-testid` attributes**: Only 14 across the codebase, mostly in test files not in actual components.

**Seed data** available in local Supabase: tables (T01-T10), menu items (Matcha Latte, Tonkotsu Ramen, Cappuccino, etc.), categories (Hot Drinks, Cold Drinks, Rice, Sushi, Desserts).

### Implementation steps

**Step 1** — Write a real staff-web order lifecycle test. Replace or extend `apps/staff-web/e2e/order-lifecycle.spec.ts`:

```typescript
import { expect, test } from './fixtures';

test.describe('Order Lifecycle', () => {
  test('full order flow: create → prepare → ready → serve → pay → close', async ({ staffPage: page }) => {
    // 1. Navigate to tables and create an order
    await page.goto('/tables');
    await page.waitForLoadState('networkidle');
    const table = page.getByText('T01').first();
    await expect(table).toBeVisible({ timeout: 10000 });
    await table.click();
    await page.waitForLoadState('networkidle');

    // 2. Look for "New Order" or "Create Order" button
    // Read the actual table detail page to find the correct button text/selector
    // Use text-based selectors first: page.getByRole('button', { name: /new order|create order/i })
    // If that doesn't work, add data-testid to the component and use it

    // 3. Add menu items to order
    // Navigate to add items screen
    // Select at least one item
    // Submit the order

    // 4. Verify order appears in orders list
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');
    // Look for the order number or table reference

    // 5. Open order detail and update status
    // Click on the order
    // Change status through: preparing → ready → served

    // 6. Process payment
    // Click payment button
    // Enter amount
    // Confirm payment

    // 7. Verify order is closed
    // Check status shows 'closed'
  });
});
```

**Important**: You MUST read the actual UI components first to know what buttons, labels, and elements exist. Do NOT guess selectors — inspect the actual rendered HTML or read the component source files. The test above is a skeleton — fill it in based on what the UI actually renders.

**Step 2** — Write a customer-web order flow test. Extend `apps/customer-web/e2e/order-flow.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';

test.describe('Customer Order Flow', () => {
  test('browse menu → add to cart → place order', async ({ page }) => {
    // 1. Navigate to table menu
    await page.goto('/table/T01/menu');
    await page.waitForLoadState('networkidle');

    // 2. Verify categories load
    await expect(page.getByText(/Hot Drinks|Cold Drinks/)).toBeVisible({ timeout: 10000 });

    // 3. Click a menu item to add to cart
    // Find the actual "Add" or "+" button by reading the menu item component

    // 4. Navigate to cart
    await page.goto('/table/T01/cart');
    await page.waitForLoadState('networkidle');

    // 5. Verify item is in cart
    // Check for item name and quantity

    // 6. Place order (if place order button exists in cart)

    // 7. Verify redirect to order tracking page
  });
});
```

**Step 3** — Add `data-testid` attributes to key interactive elements. ONLY add them where needed for E2E tests — do NOT blanket every component. Priority elements:

- Order creation buttons
- Menu item "add to cart" buttons
- Cart "place order" button
- Order status badges
- Payment confirmation button

Add them directly in the component JSX:

```tsx
<button data-testid="place-order" onClick={handleSubmit}>
  {t('cart.placeOrder')}
</button>
```

**Step 4** — Run the tests locally to verify they work against local Supabase with seed data:

```bash
cd apps/staff-web && npx playwright test
cd apps/customer-web && npx playwright test
```

### What NOT to do
- Do NOT write tests for every page — focus on the 2 critical flows (staff order lifecycle, customer order flow)
- Do NOT use CSS class selectors (`.bg-blue-500`) — they break on style changes
- Do NOT use complex XPath selectors — prefer `getByRole`, `getByText`, `getByTestId`
- Do NOT add `data-testid` to elements that aren't needed by tests
- Do NOT modify the Playwright configs — they're already correct

### Verification
- Staff-web E2E tests pass locally: `cd apps/staff-web && npx playwright test`
- Customer-web E2E tests pass locally: `cd apps/customer-web && npx playwright test`
- Intentionally break a feature (e.g., comment out order creation) → test fails
- `pnpm test:e2e` passes in CI

---

## SCALE-15: Typed test factories

### Goal
Replace inline `as any` casts in test files with properly typed factory functions. This ensures that when database types change, tests fail at compile time rather than passing with stale data.

### Current state (verified)

**`as any` count**: 38 instances across 12 test files in `packages/api-client/src/__tests__/`

**Mock structure** (`packages/api-client/src/__tests__/helpers/mock-supabase.ts`):
- `createMockSupabase(config)` — returns a mock client with `from()`, `rpc()`, `channel()`
- `createMockContext(config)` — wraps the mock in a `WrapperContext` shape (`{ client, anyClient }`)
- Line 103: `return client as any` — the mock is cast to `any` when returned
- Line 13: `const builder: Record<string, any> = {}` — the chainable query builder uses `any`

**Test data pattern** (from `packages/api-client/src/__tests__/orders.test.ts`):
```typescript
const validOrder = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  status: 'new',
  source: 'customer',
  table_id: '123e4567-e89b-12d3-a456-426614174001',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
```
This is a partial `OrderRow` — missing many required fields. It works because `createMockSupabase` returns whatever you configure, ignoring the actual schema.

**Database types** are in `packages/database/src/types/database.ts` — auto-generated from Supabase. The `Tables` type contains `Row`, `Insert`, `Update` for each table.

**Wrapper types** are in `packages/api-client/src/wrapper/types.ts`:
- `OrderRow = Tables['orders']['Row']`
- `MenuItemRow = Tables['menu_items']['Row']`
- etc.

### Implementation steps

**Step 1** — Create `packages/api-client/src/__tests__/helpers/factories.ts`:

```typescript
import type {
  OrderRow,
  OrderItemRow,
  MenuItemRow,
  CategoryRow,
  StaffRow,
  TableRow,
  WaiterCallRow,
  StockItemRow,
  ExpenseRow,
  WasteLogRow,
} from '../../wrapper/types';

// Counter for unique IDs
let counter = 0;
function nextId(): string {
  counter++;
  return `00000000-0000-0000-0000-${String(counter).padStart(12, '0')}`;
}

export function buildOrder(overrides?: Partial<OrderRow>): OrderRow {
  return {
    id: nextId(),
    table_id: null,
    assigned_waiter_id: null,
    order_number: `ORD-${counter}`,
    status: 'new',
    subtotal: 0,
    tax: 0,
    total: 0,
    customer_notes: null,
    internal_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    preparing_at: null,
    ready_at: null,
    served_at: null,
    closed_at: null,
    payment_method: null,
    paid_at: null,
    order_type: 'dine_in',
    customer_name: null,
    customer_phone: null,
    source: 'waiter',
    delivery_address: null,
    delivery_fee: null,
    delivery_notes: null,
    estimated_delivery_time: null,
    delivered_at: null,
    delivery_person_id: null,
    discount_type: 'none',
    discount_value: null,
    discount_amount: null,
    discount_reason: null,
    discount_applied_by: null,
    tenant_id: nextId(),
    delivery_access_token: null,
    ...overrides,
  };
}

export function buildOrderItem(overrides?: Partial<OrderItemRow>): OrderItemRow {
  return {
    id: nextId(),
    order_id: nextId(),
    menu_item_id: nextId(),
    item_name: 'Test Item',
    item_price: 10.00,
    quantity: 1,
    status: 'pending',
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tenant_id: nextId(),
    ...overrides,
  };
}

// Add more builders as needed — follow the same pattern
// Only create builders for types that are actually used in tests
```

**Important**: You MUST read the actual `OrderRow` type from `packages/database/src/types/database.ts` to get the complete field list. The fields above are based on the baseline migration columns I verified — but the generated type may have additional fields added by later migrations (e.g., `delivery_access_token` from Phase 3). Cross-reference with the actual type.

**Step 2** — Migrate test files one at a time, starting with the most `as any`-heavy files:

1. `packages/api-client/src/__tests__/payments.test.ts` (7 instances)
2. `packages/api-client/src/__tests__/stock.test.ts` (7 instances)
3. `packages/api-client/src/__tests__/menu.test.ts` (6 instances)

For each file:
- Replace inline test data with factory calls: `const order = buildOrder({ status: 'new' })`
- Replace `as any` casts with proper types where possible
- If the `as any` is on the mock context return, leave it — fixing `createMockSupabase` itself is a separate effort

**Step 3** — Fix `createMockContext` return type. Currently line 103 returns `client as any`. Instead:

```typescript
import type { WrapperContext } from '../../wrapper/types';

export function createMockContext(config: MockSupabaseConfig = {}): WrapperContext & {
  getCalls: () => Array<{ table: string; method: string; args: any[] }>;
  resetCalls: () => void;
} {
  const client = createMockSupabase(config);
  return {
    client: client as WrapperContext['client'],
    anyClient: client as WrapperContext['anyClient'],
    getCalls: client.getCalls,
    resetCalls: client.resetCalls,
  };
}
```

This eliminates the top-level `as any` on the context while keeping the internal mock implementation untyped (which is acceptable — the mock intentionally doesn't implement the full Supabase client interface).

**Step 4** — Add a `beforeEach` reset for the counter:

```typescript
// In factories.ts
export function resetFactoryCounter() {
  counter = 0;
}
```

Call `resetFactoryCounter()` in `beforeEach` of test files to keep IDs deterministic.

### What NOT to do
- Do NOT try to make `createMockSupabase` fully typed — it's a mock that intentionally returns partial data. The `any` inside the mock implementation is acceptable.
- Do NOT create factories for types that aren't used in tests
- Do NOT refactor test logic — only replace data construction and type casts
- Do NOT change test assertions — the tests should pass identically before and after

### Verification
- `pnpm type-check` passes — factories conform to actual database types
- `pnpm test` passes — all existing tests still pass with factory data
- Rename a field in `OrderRow` (e.g., `status` → `order_status`) → `buildOrder` fails to compile → proves factories catch schema drift
- Revert the rename

---

## SCALE-16: React version alignment

### Goal
Resolve the React version split between web apps (React 18.3) and mobile app (React 19.1). Shared packages must work with both.

### Current state (verified)

| Package | React Version | Notes |
|---------|--------------|-------|
| `apps/staff-web` | `^18.3.0` | React 18 |
| `apps/customer-web` | `^18.3.0` | React 18 |
| `apps/mobile` | `19.1.0` (pinned) | React 19 — required by React Native 0.81.5 |
| `packages/ui` | devDeps: `^18.3.0`, peerDeps: `^18.2.0 \|\| ^19.0.0` | Supports both |
| `packages/queries` | peerDeps: `^18.2.0 \|\| ^19.0.0` | Supports both |
| `packages/i18n` | peerDeps: `>=18` | Flexible |

**The original plan recommended pinning mobile to React 18. This is WRONG.** React Native 0.81.5 **requires** React 19. Downgrading would break the mobile build.

### Revised approach

The correct approach is to **keep the split** and ensure shared packages work with both versions. The peer dependency ranges already support this (`^18.2.0 || ^19.0.0`).

**Step 1** — Verify shared packages don't use React 19-only APIs. Search for:
- `use()` hook (React 19 only)
- `useFormStatus()`, `useFormState()` (React 19 only)
- `useOptimistic()` (React 19 only)
- `ref` as a prop (React 19 changes ref forwarding)

```bash
# Run these searches in packages/ui/src/ and packages/queries/src/
```

If any React 19-only APIs are found in shared packages, they need to be conditionally imported or avoided.

**Step 2** — Ensure `pnpm install` produces no peer dependency warnings. Run:

```bash
pnpm install 2>&1 | grep -i "peer"
```

If there are warnings, fix the peer dependency ranges in the affected package.json files.

**Step 3** — Verify both apps build correctly:

```bash
pnpm build --filter=@gustri/staff-web
pnpm build --filter=@gustri/customer-web
# Mobile build requires EAS — just verify type-check:
pnpm type-check --filter=@gustri/mobile
```

**Step 4** — Document the version split. Add a comment in the root `package.json` or `CLAUDE.md`:

```
## React Version Policy
- Web apps (staff-web, customer-web): React 18.x
- Mobile app: React 19.x (required by React Native 0.81+)
- Shared packages: Must support both via peer deps (^18.2.0 || ^19.0.0)
- Web apps will upgrade to React 19 when Next.js 15 migration is done
```

### What NOT to do
- Do NOT downgrade mobile to React 18 — it will break React Native 0.81
- Do NOT upgrade web apps to React 19 — Next.js 14 doesn't fully support it
- Do NOT add React 19 features to shared packages

### Verification
- `pnpm install` — no peer dep warnings
- `pnpm build` — all apps build successfully
- `pnpm type-check` — no type errors
- `pnpm test` — all tests pass
- Mobile app runs in simulator/Expo Go

---

## Execution order within Phase 6

1. **SCALE-16 first** (0.5 day) — verify and document React alignment. No code changes expected, just verification and documentation. Quick win.
2. **SCALE-15 second** (1-2 days) — create factories and migrate tests. This is independent of other work.
3. **SCALE-13 third** (1-2 days) — SSR for delivery menu page. Requires creating server Supabase client.
4. **SCALE-14 last** (2-3 days) — real E2E tests. These depend on understanding the actual UI (which you'll learn from reading components during SCALE-13).

## General rules

- Follow existing code patterns exactly
- Use Biome formatting: 2-space indent, single quotes, trailing commas. Run `pnpm check:fix` before considering done
- For E2E tests: READ the actual component source code before writing selectors. Do NOT guess button text or class names.
- For factories: READ the actual generated types in `packages/database/src/types/database.ts`. The `Row` types are the source of truth — don't rely on the migration SQL for field names.
- For SSR: The `initialData` pattern with React Query is the correct approach for server→client data handoff in Next.js App Router.
- Do NOT add comments, docstrings, or type annotations beyond what's needed
- Do NOT refactor surrounding code — only change what's needed for these four issues
- Run `pnpm test && pnpm type-check && pnpm check` at the end to verify everything passes
