# Staff-Web Audit — Implementation Prompts

One self-contained prompt per finding. Copy each block into a fresh agent. Each prompt assumes:
- Repo root: `/Users/kamilhajilov/Documents/github/cafe-idare`
- Monorepo structure documented in `CLAUDE.md`
- After every change: run `pnpm check`, `pnpm type-check`, `pnpm test` for the touched packages.
- Database changes: new migration files only, never edit a merged one. Run `pnpm db:types:generate` and commit the regenerated `packages/database/src/types/generated.ts` in the same change.

Order of execution matters. Implement in the listed order — later prompts assume earlier fixes are merged.

---

## Prompt 1 — C1: Lock down `/api/v1/customer/orders` tenant binding

```
You are fixing a CRITICAL unauthenticated tenant-spoofing vulnerability in the Gustri staff-web QR ordering endpoint.

## Problem
`apps/staff-web/src/app/api/v1/customer/orders/route.ts` accepts `tenant_id`
from the request body and the service at
`apps/staff-web/src/lib/services/customer-order-service.ts` only validates
the table when `order_type === 'dine_in' && table_id` is supplied.
For `takeout` and `delivery` orders, an unauthenticated attacker can POST any
victim tenant's UUID and create unlimited fake orders (rate-limited per IP only),
flooding their kitchen and exhausting their monthly_order_count plan cap.

## What to implement

### 1. Schema change
- Remove `tenant_id` from `CreateCustomerOrderSchema`.
- Make `table_id` REQUIRED for `order_type === 'dine_in'` (already partly enforced — make explicit).
- For `order_type === 'takeout' | 'delivery'`, require a new `qr_token: string` field.

### 2. New `qr_tokens` table + migration
Create `supabase/migrations/<TODAY>_qr_tokens.sql`:
- Table `qr_tokens(id uuid PK, tenant_id uuid NOT NULL FK tenants, table_id uuid NULL FK tables, kind text CHECK in ('takeout','delivery','dine_in'), token text NOT NULL UNIQUE, created_at timestamptz default now(), expires_at timestamptz NULL, revoked_at timestamptz NULL)`
- RLS enabled. SELECT/INSERT/UPDATE/DELETE policies: admin/owner of tenant only.
- Index on `token` (already unique) and `(tenant_id, kind)`.
- Add `qr_token` is the value embedded in the QR URL the cafe prints/sends.

### 3. Service layer — derive tenant from server-side lookup
In `customer-order-service.ts`:
- For `dine_in`: load `tables` row by `table_id`, derive `tenantId = table.tenant_id`. Reject if not found.
- For `takeout` / `delivery`: load `qr_tokens` row by `token` (must be non-revoked, non-expired, kind matches). Derive `tenantId` from it. Reject otherwise.
- Never read `tenant_id` from the request body. The body field is gone.

### 4. Route handler
- Use the derived `tenantId` consistently throughout.
- Keep existing rate limiting and idempotency.

### 5. Customer-web (sibling app, do NOT change unless required)
- Check `apps/customer-web/` for any code that POSTs to `/api/v1/customer/orders`.
- Update it to send `qr_token` (read from URL search param) instead of `tenant_id`.
- The QR URL should already encode this — if it currently encodes only `tenant_id`, file a follow-up TODO and adjust the customer-web flow to require a token-bearing URL.

### 6. Tests
- New Vitest in `apps/staff-web/src/__tests__/` covering:
  - dine_in: table_id from another tenant rejected
  - takeout: missing qr_token rejected
  - takeout: revoked qr_token rejected
  - takeout: expired qr_token rejected
  - takeout: valid qr_token resolves to correct tenant
  - body field `tenant_id` if present is ignored (or rejected by zod)

## Out of scope
- Generating new QR codes for existing tenants — leave a TODO + GitHub issue link.
- Migrating in-flight orders.

## Acceptance
- `curl -X POST .../api/v1/customer/orders -d '{"tenant_id":"<any-uuid>","order_type":"takeout"}'` returns 400.
- All existing customer-web E2E tests pass after qr_token is plumbed in.
```

---

## Prompt 2 — C2: Server-side recompute of order totals

```
You are fixing a CRITICAL revenue-theft vulnerability where order totals are
client-supplied and never recomputed server-side. A staff member can POST
real items but a fake total of $0.01 and pocket the cash difference.

## Files
- `apps/staff-web/src/app/api/v1/orders/route.ts` — schema + handler
- `apps/staff-web/src/lib/services/order-service.ts` — insert path
- `supabase/migrations/<TODAY>_enforce_server_order_totals.sql` — new migration

## What to implement

### 1. Strip totals from CreateOrderSchema
In `route.ts`, remove `subtotal`, `tax`, `total` from the request schema.
Mobile/web clients should NOT send these. The fields stay in the DB row but
are derived server-side.

### 2. Service layer
In `order-service.ts`:
- Do not pass `subtotal/tax/total` from `orderData` to the insert (delete them
  if present — defensive, in case mobile still sends them).
- Insert order with `subtotal := 0, tax := 0, total := 0` initially.
- After items are inserted in the same transaction, call the existing
  `calculate_order_total(order_id)` RPC to populate the values.
- Return the freshly-computed order to the caller.

### 3. Validate item_price against menu_items at insert time (M2)
Add a BEFORE INSERT trigger on `order_items`:
```sql
CREATE OR REPLACE FUNCTION public.snapshot_item_price_from_menu()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_menu_price numeric;
BEGIN
  SELECT price INTO v_menu_price FROM public.menu_items
  WHERE id = NEW.menu_item_id AND tenant_id = NEW.tenant_id;
  IF v_menu_price IS NULL THEN
    RAISE EXCEPTION 'menu_item_not_found_in_tenant';
  END IF;
  -- Always snapshot from menu, ignore client-supplied price
  NEW.item_price := v_menu_price;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_snapshot_item_price
BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.snapshot_item_price_from_menu();
```

### 4. Defensive CHECK on orders
Add `CHECK (total >= 0 AND subtotal >= 0 AND tax >= 0)` if not already present.

### 5. Tests
- Vitest: POSTing an order with `total: 0.01` succeeds but the saved order has the recomputed total.
- Vitest: POSTing an order_item with `item_price: 0.01` for a menu item priced $20 saves $20.
- RLS test for the new trigger if applicable.

## Acceptance
- Existing order-creation tests still pass (they may need updates if they previously asserted client-sent totals were preserved).
- Manual: `curl` with $0.01 total → response shows correct computed total.
- Same for mobile client — the mobile app at `apps/mobile/src/lib/services/...` may need its `orders.create` payload trimmed similarly.
```

---

## Prompt 3 — C3: Atomic refund/payment balance enforcement

```
You are fixing a CRITICAL race condition where two concurrent refund (or payment)
inserts both pass the BEFORE trigger validation and both commit, allowing
total_refunded > total_paid.

## Root cause
`supabase/migrations/20260418100001_upgrade_decimal_precision.sql:132-159`
defines `validate_refund_amount()` BEFORE INSERT trigger. It computes
`available = total_paid - total_refunded` from a SELECT without `FOR UPDATE`.
Under READ COMMITTED, two concurrent inserts both see the same snapshot.
`payment-service.ts:44-60` has the same pattern at the application layer
for payments.

## What to implement

### 1. New migration `<TODAY>_atomic_payment_refund_locking.sql`

```sql
-- Refund: lock the order row before the trigger reads
CREATE OR REPLACE FUNCTION public.validate_refund_amount()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  total_paid numeric;
  total_refunded numeric;
  available numeric;
BEGIN
  -- Take an exclusive row lock on the order
  PERFORM 1 FROM public.orders WHERE id = NEW.order_id FOR UPDATE;

  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.order_payments
  WHERE order_id = NEW.order_id;

  SELECT COALESCE(SUM(amount), 0) INTO total_refunded
  FROM public.refunds
  WHERE order_id = NEW.order_id;

  available := total_paid - total_refunded;
  IF NEW.amount > available THEN
    RAISE EXCEPTION 'refund_exceeds_available' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

-- Payment: same pattern, NEW trigger
CREATE OR REPLACE FUNCTION public.validate_payment_amount()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  order_total numeric;
  total_paid numeric;
  remaining numeric;
BEGIN
  PERFORM 1 FROM public.orders WHERE id = NEW.order_id FOR UPDATE;

  SELECT total INTO order_total FROM public.orders WHERE id = NEW.order_id;
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.order_payments
  WHERE order_id = NEW.order_id;

  remaining := order_total - total_paid;
  IF NEW.amount > remaining + 0.0001 THEN  -- allow tiny rounding
    RAISE EXCEPTION 'payment_exceeds_remaining' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_payment_amount
BEFORE INSERT ON public.order_payments
FOR EACH ROW EXECUTE FUNCTION public.validate_payment_amount();
```

### 2. Tenant guard in payment trigger (folds in H2)
Add to both functions: verify `NEW.tenant_id = (SELECT tenant_id FROM orders WHERE id = NEW.order_id)`. RAISE if mismatch.

### 3. Service layer — drop the now-redundant pre-check, OR keep it for nicer error messages
- `payment-service.ts:44-60`: keep the `get_order_remaining_balance` call ONLY if you want a friendlier error. The trigger is the authority.
- Map `check_violation` from the error class to a typed `ConflictError` ('payment_exceeds_remaining' / 'refund_exceeds_available') in `httpStatusToAppError` / `handleSupabaseError`.

### 4. Concurrency test
Add an integration test that fires N concurrent refund inserts via Promise.all and asserts `total_refunded <= total_paid` and that exactly the expected number succeed.

## Acceptance
- New test: 5 concurrent $30 refunds against a $100 paid order — at most 3 succeed.
- New test: 2 concurrent $60 payments against a $100 order — at most 1 succeeds.
- Existing payment/refund tests still pass with friendly error mapping.
```

---

## Prompt 4 — C4: Refund audit trigger

```
You are adding the missing financial_audit_log trigger for refunds. Currently
refunds are completely invisible in the audit log, leaving no detective control
for the highest-risk financial operation.

## Files
- `supabase/migrations/20260419000002_add_financial_audit_log.sql` — reference
  for the existing payment / item / discount trigger pattern (DO NOT EDIT)
- New migration: `supabase/migrations/<TODAY>_audit_refund_inserts.sql`
- `apps/staff-web/src/lib/services/refund-service.ts` — verify no app-layer
  duplication is needed

## What to implement

### 1. New migration

```sql
CREATE OR REPLACE FUNCTION public.log_refund_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.financial_audit_log (
    tenant_id, staff_id, order_id, action, details, created_at
  )
  VALUES (
    NEW.tenant_id,
    NEW.processed_by,
    NEW.order_id,
    'refund',
    jsonb_build_object(
      'refund_id', NEW.id,
      'amount', NEW.amount,
      'reason', NEW.reason,
      'refund_method', NEW.refund_method
    ),
    now()
  );
  RETURN NEW;
END $$;

CREATE TRIGGER trg_log_refund_on_insert
AFTER INSERT ON public.refunds
FOR EACH ROW EXECUTE FUNCTION public.log_refund_on_insert();
```

### 2. Backfill existing refunds
At the bottom of the migration:
```sql
INSERT INTO public.financial_audit_log (tenant_id, staff_id, order_id, action, details, created_at)
SELECT r.tenant_id, r.processed_by, r.order_id, 'refund',
       jsonb_build_object('refund_id', r.id, 'amount', r.amount, 'reason', r.reason, 'refund_method', r.refund_method, 'backfilled', true),
       r.created_at
FROM public.refunds r
WHERE NOT EXISTS (
  SELECT 1 FROM public.financial_audit_log l
  WHERE l.action = 'refund' AND (l.details->>'refund_id')::uuid = r.id
);
```

### 3. Test
- Integration test: insert a refund, assert `financial_audit_log` has a matching `action='refund'` row.
- Test that the row's `tenant_id` matches and the trigger preserves staff_id.

## Acceptance
- `SELECT COUNT(*) FROM refunds` equals `SELECT COUNT(*) FROM financial_audit_log WHERE action='refund'` after migration.
- Reconciliation reports (if any in `apps/staff-web/src/app/(staff)/reports/`) now show refunds.
```

---

## Prompt 5 — C5: Pass `p_tenant_id` explicitly in reports wrapper

> **SUPERSEDED (2026-05-03).** This prompt is obsolete. Migration
> [20260430000002_multitenant_security_hardening.sql](../supabase/migrations/20260430000002_multitenant_security_hardening.sql)
> took the stronger approach: it DROPped the `(UUID, TIMESTAMPTZ, TIMESTAMPTZ)`
> overloads and recreated all five report functions with signature `(p_from, p_to)`
> only, deriving the tenant from `current_tenant_id()` server-side and raising
> `'No tenant context'` if the session is unbound. Callers can no longer pass a
> tenant id at all — which is safer than asking them to pass the right one. The
> wrapper in [packages/api-client/src/wrapper/reports.ts](../packages/api-client/src/wrapper/reports.ts)
> and the comment in [packages/queries/src/hooks/use-reports.ts](../packages/queries/src/hooks/use-reports.ts)
> already match the current schema. No action required. Original prompt left
> below for historical context.

```
You are fixing a CRITICAL bug where reports RPC calls omit the required
`p_tenant_id` parameter. Either reports are silently broken in production or
they fall back to an overload that aggregates cross-tenant data.

## Files
- `packages/api-client/src/wrapper/reports.ts` — wrapper to fix
- `supabase/migrations/20260425000001_fix_report_functions.sql` — reference for signatures
- `packages/queries/src/hooks/use-reports.ts` — verify the comment is updated

## What to implement

### 1. Wrapper fix
For every RPC call in `reports.ts`, pass `p_tenant_id` from the wrapper context:

```ts
async revenueSummary({ from, to }: { from: string; to: string }) {
  const tenantId = ctx.tenantContext?.tenantId;
  if (!tenantId) throw new AuthorizationError('missing_tenant_context');
  const data = await rpc(ctx, 'get_revenue_summary', {
    p_tenant_id: tenantId,
    p_from: from,
    p_to: to,
  });
  return data;
}
```

Apply to all 5 functions: get_revenue_summary, get_top_sold_items, get_expense_summary, get_waste_summary, get_staff_performance.

### 2. Drop unsafe overloads
Audit the migration history for any version of these functions that lacks `p_tenant_id`. If found, write a migration `<TODAY>_drop_unsafe_report_overloads.sql` that DROPs them. Use `pg_proc` listing in a one-off `pnpm db:studio` query or `psql` to confirm.

### 3. Update use-reports.ts comment
The note saying "RPCs derive tenant from session via current_tenant_id()" is misleading — remove or rewrite to reflect explicit param passing.

### 4. Tests
- Two-tenant Vitest fixture: tenant A's user calling each report RPC must NOT see tenant B's data.
- Verify the wrapper throws when `tenantContext` is missing (rather than silently passing undefined).

## Acceptance
- All 5 report hooks return correct tenant-scoped data.
- Cross-tenant fixture test passes.
- No PostgREST function-overload ambiguity remains.
```

---

## Prompt 6 — C6: Re-subscribe Realtime channels on session refresh

```
You are fixing a CRITICAL silent-data-stall bug. Supabase Realtime channels
do not re-authenticate when the JWT refreshes (~55 min). The channel keeps
the stale token, the connection drops, and the kitchen view stops receiving
updates until the 2-min fallback poll catches up.

## Files
- `apps/staff-web/src/hooks/use-realtime-sync.ts` — current channel lifecycle
- `apps/staff-web/src/app/providers.tsx` — top-level providers
- (likely) new file `apps/staff-web/src/lib/realtime/channel-registry.ts`

## What to implement

### 1. Channel registry
A module-level `Map<string, () => void>` of "resubscribe functions" keyed by channel name. Each `useRealtimeSync` call registers itself on mount and unregisters on unmount.

### 2. Auth-state listener
In `providers.tsx` (or a sibling `RealtimeAuthBridge` component mounted under the auth provider):
```ts
useEffect(() => {
  const { data: sub } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
      channelRegistry.resubscribeAll();
    }
    if (event === 'SIGNED_OUT') {
      channelRegistry.teardownAll();
    }
  });
  return () => sub.subscription.unsubscribe();
}, []);
```

### 3. Hook refactor
`useRealtimeSync` should:
- Keep existing channel-creation logic.
- On registration, store a closure that does `removeChannel(old) → recreate channel with same args`.
- The cleanup function unregisters AND removes the channel.
- Add a `lastEventAt` timestamp ref — surface via a small status hook if useful for ops.

### 4. Tests
- Manual repro: log in, force a token refresh via `supabase.auth.refreshSession()` from devtools, verify channel resubscribes (check Network panel for new WebSocket frame).
- Vitest if feasible — mock Supabase client and assert resubscribe is called on `TOKEN_REFRESHED`.

## Acceptance
- Open kitchen view, leave for 60+ min, verify orders still update in realtime without manual refresh.
- No duplicate channels accumulate (count `supabase.getChannels().length` before/after refresh — should be stable).
```

---

## Prompt 7 — H1: Clamp discount value when type is `'none'`

```
Tiny but important fix. When `discountType === 'none'`, the validation block
in `discount-service.ts` skips all checks. A negative `discountValue` slips
through and becomes active later if the type is flipped back to 'fixed'
without clearing the value.

## File
`apps/staff-web/src/lib/services/discount-service.ts:61-74`

## What to implement
Add at the top of the validation block, BEFORE the type-specific branches:

```ts
if (discountType === 'none') {
  discountValue = 0;  // clamp regardless of input
  // skip remaining checks
} else if (discountType === 'percentage') {
  ...
}
```

Also ensure the UPDATE statement persists `discount_value: 0` (not the original
client value) when type is 'none'.

## Test
Vitest: POST `{discount_type:'none', discount_value:-1000}` → assert stored `discount_value === 0`.

## Acceptance
- New test passes.
- No regression on existing discount tests.
```

---

## Prompt 8 — H3: Debounce realtime invalidations

```
You are fixing a HIGH-severity performance regression. During dinner rush,
~5–10 realtime events/sec each trigger an immediate
`queryClient.invalidateQueries(...)` call, causing 5–10 refetches per second
of the same query keys.

## File
`apps/staff-web/src/hooks/use-realtime-sync.ts:56-68`

## What to implement
Coalesce invalidations with a trailing debounce per query-key tuple:

```ts
import { useRef } from 'react';

const pendingKeys = useRef(new Set<string>());
const flushTimer = useRef<NodeJS.Timeout | null>(null);

const scheduleFlush = () => {
  if (flushTimer.current) return;
  flushTimer.current = setTimeout(() => {
    if (cancelledRef.current) return;
    for (const k of pendingKeys.current) {
      queryClient.invalidateQueries({ queryKey: JSON.parse(k) });
    }
    pendingKeys.current.clear();
    flushTimer.current = null;
  }, 300);  // 300ms trailing debounce
};

// inside event callback:
for (const key of queryKeys) {
  pendingKeys.current.add(JSON.stringify(key));
}
scheduleFlush();
```

Cleanup must `clearTimeout(flushTimer.current)` on unmount.

## Tunable
300 ms is a starting point — tighten to 200 ms if UX feels laggy, loosen to 500 ms if servers still struggle. Add a constant in `packages/queries/src/provider.tsx` so other apps can match.

## Test
- Existing realtime tests should still pass.
- Add a Vitest with a fake timer that fires 10 events in <100ms and asserts `invalidateQueries` is called once per unique key, not 10 times.

## Acceptance
- Network panel during a synthetic burst (10 order_items updates in 1 sec) shows ≤2 refetches per affected query, not 10.
```

---

## Prompt 9 — H4: Memoize heavy list components

```
HIGH-severity rendering performance fix. After realtime invalidation
refetches the orders list, the entire OrderListCard / TableCard grid
re-renders even when one row changed.

## Files
- `apps/staff-web/src/components/orders/order-list-card.tsx`
- `apps/staff-web/src/components/tables/table-card.tsx`
- (and any other large-list cards under `apps/staff-web/src/components/`)

## What to implement

### 1. Wrap each card in React.memo
```tsx
export const OrderListCard = React.memo(function OrderListCard(props: OrderListCardProps) {
  ...
}, (prev, next) => {
  // Shallow compare key fields — order objects from TanStack Query should be referentially stable per row
  return prev.order === next.order
    && prev.formatPrice === next.formatPrice
    && prev.onStatusUpdate === next.onStatusUpdate;
});
```

### 2. useMemo derived values
For each card, wrap derived calculations:
```ts
const cardStyle = useMemo(() => getOrderCardStyle(order), [order.id, order.status, order.order_type]);
const effectiveStatus = useMemo(() => getEffectiveOrderStatus(order), [order.status, order.items]);
```

### 3. Stabilize callback props at the parent
In the parent list page (e.g. `apps/staff-web/src/app/(staff)/kitchen/page.tsx`):
- Wrap `onStatusUpdate` in `useCallback`.
- Wrap `formatPrice` in `useCallback` or move it to a stable module-level export.

### 4. Verify referential stability
TanStack Query returns new array references but row objects are stable across refetches if the data didn't change. Confirm via React DevTools profiler: a single-row update should re-render only that card.

## Test
- React Testing Library: render 10 cards, update one order's status in the query cache, assert only that card re-renders (track via `React.Profiler` or render counts).

## Acceptance
- Profiler shows ≤2 cards re-rendering per realtime tick (target row + maybe its neighbor for css), not 40.
```

---

## Prompt 10 — H5: Capture full order in optimistic snapshot

```
HIGH-severity correctness fix. When a status mutation errors, the rollback
restores a stale snapshot that captured only `status`, losing any concurrent
realtime updates to other fields (delivery_fee, customer_notes, etc.).

## File
`apps/staff-web/src/hooks/use-orders-safe.ts:49-95` (useUpdateOrderStatus)
`apps/staff-web/src/hooks/use-orders-safe.ts:99-142` (useUpdateOrderItemStatus)

## What to implement

### Option A (preferred): refetch on error
Drop manual rollback; instead `refetchQueries` for the affected key. Realtime + the refetch converge on truth.

```ts
onError: (_err, _vars, _ctx) => {
  queryClient.refetchQueries({ queryKey: [QUERY_KEYS.ORDER, orderId] });
  queryClient.refetchQueries({ queryKey: [QUERY_KEYS.ORDERS] });
},
```

### Option B: snapshot the full order
If you need instant rollback (no extra network roundtrip):
```ts
onMutate: async ({ orderId, status }) => {
  await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.ORDER, orderId] });
  const previousOrder = queryClient.getQueryData<Order>([QUERY_KEYS.ORDER, orderId]);
  // optimistic update
  if (previousOrder) {
    queryClient.setQueryData<Order>([QUERY_KEYS.ORDER, orderId], { ...previousOrder, status });
  }
  return { previousOrder };
},
onError: (_err, _vars, ctx) => {
  if (ctx?.previousOrder) {
    queryClient.setQueryData([QUERY_KEYS.ORDER, ctx.previousOrder.id], ctx.previousOrder);
  }
},
```

Pick Option A for correctness or Option B for snappier UX. Document the choice.

## Test
- Vitest: simulate concurrent realtime update during a mutation that fails. Assert no field loss after rollback.

## Acceptance
- Rapid click + concurrent realtime update on the same order does not corrupt visible state.
```

---

## Prompt 11 — H6: Disable status-update buttons during in-flight mutations + idempotency

```
HIGH-severity. Status-update buttons in OrderListCard are not disabled while
the mutation is pending. Rapid clicks issue duplicate updates, which amplifies
the H3 invalidation storm.

## Files
- `apps/staff-web/src/hooks/use-orders-safe.ts` — add idempotency
- `apps/staff-web/src/components/orders/order-list-card.tsx` — surface pending state

## What to implement

### 1. Surface mutation pending state to the card
Lift the mutation hook into the parent (kitchen / orders page) and pass `mutation.isPending` + `mutation.variables?.orderId` down. The card disables its action buttons when `isPending && variables.orderId === order.id`.

```tsx
<Button
  disabled={isPending && pendingOrderId === order.id}
  onClick={() => onStatusUpdate(order.id, 'preparing')}
>
  {t('start_preparing')}
</Button>
```

### 2. Add client_request_id to status-update mutations
Mirror the pattern from `useCreateOrder`:
```ts
mutationFn: async ({ orderId, status }) => {
  const clientRequestId = crypto.randomUUID();
  return await db.orders.updateStatus(orderId, status, { clientRequestId });
}
```

Update `packages/api-client/src/wrapper/orders.ts` `updateStatus` to accept and forward this ID, and update the underlying RPC / route to dedupe on it (extend the existing dedupe helper).

### 3. Tests
- Vitest: rapid double-click on a status button → exactly one DB write.
- Vitest: button is `disabled` while mutation is in flight.

## Acceptance
- Manual test: triple-click the "Ready" button on an order — DB shows 1 status_update row, not 3.
- Network panel: 1 PATCH request, not 3.
```

---

## Prompt 12 — H2: Tenant guard in payment trigger

```
HIGH-severity defense-in-depth. The update_order_payment_status trigger updates
orders and tables joined only by id. RLS protects the normal path, but the
service-role payment route bypasses RLS — a tenantId derivation bug upstream
could close another tenant's order.

NOTE: If Prompt 3 (C3 atomic locking) has been merged, fold this into the
same migration. Otherwise create its own.

## File
New migration `supabase/migrations/<TODAY>_payment_trigger_tenant_guard.sql`

## What to implement
Update both `update_order_payment_status()` and `validate_payment_amount()`
to assert tenant_id matches:

```sql
DECLARE v_order_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_order_tenant FROM public.orders WHERE id = NEW.order_id;
  IF v_order_tenant IS NULL THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;
  IF v_order_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'payment_tenant_mismatch';
  END IF;
  ... existing logic ...
END
```

Apply the same to refund triggers.

## Test
- Vitest: insert payment with mismatched tenant_id (using service role) → trigger raises.

## Acceptance
- New test passes.
- No regressions in existing payment/refund tests.
```

---

## Prompt 13 — H7: Project explicit columns in staff wrapper

```
HIGH-severity over-fetch. `packages/api-client/src/wrapper/staff.ts` uses
`.select('*')` everywhere, exposing internal fields like `auth_user_id`,
`phone`, and `last_login_at` to all roles.

## File
`packages/api-client/src/wrapper/staff.ts`

## What to implement

### 1. Define explicit projection constants
```ts
const STAFF_LIST_SELECT = 'id, email, full_name, role, is_active, created_at, updated_at' as const;
const STAFF_DETAIL_SELECT = 'id, email, full_name, role, is_active, phone, preferred_language, created_at, updated_at, last_login_at' as const;
// auth_user_id never exposed to client
```

### 2. Apply to wrapper methods
- `findAll` / `list` / `findByRole`: use STAFF_LIST_SELECT.
- `findById`: use STAFF_DETAIL_SELECT (admin-only screens).
- Any method returning to a non-admin caller: use STAFF_LIST_SELECT.

### 3. Type updates
The TS types narrow automatically with literal-string `.select()`. Update consuming components if they reference fields no longer in the list view.

### 4. Tests
- Vitest: assert `findAll()` response has no `auth_user_id` field.

## Acceptance
- Search for `select('*')` in staff.ts returns zero hits.
- Network response on /staff page does not contain auth_user_id.
```

---

## Prompt 14 — H8: Encrypt `delivery_customers.phone`

```
HIGH-severity PII gap. `delivery_customers.phone` is stored and searched in
plaintext while `orders` PII is encrypted. A waiter can `LIKE`-search the
full customer phone book.

## Files
- New migration `supabase/migrations/<TODAY>_encrypt_delivery_customer_phone.sql`
- Reference `supabase/migrations/20260421000001_encrypt_customer_pii.sql`
- `packages/api-client/src/wrapper/delivery-customers.ts:54,74` — search query

## What to implement

### 1. Migration — encrypt-at-rest
Mirror the orders pattern:
- Add `phone_encrypted bytea` column.
- BEFORE INSERT/UPDATE trigger: `phone_encrypted := encrypt_pii(phone, ...)`, then NULL out `phone`.
- Backfill existing rows.
- Drop the `phone` column or rename to deprecated.
- Create a `delivery_customers_decrypted` view for authorized reads.

### 2. Wrapper updates
- `list` / `paginated`: do NOT include phone in the projection — list views show only `id, name, order_count, last_order_at`.
- `findById`: read from `delivery_customers_decrypted`, return phone only to admin/owner role (gate with RLS on the view, or via a wrapper-side role check that mirrors the RLS policy).
- Replace the `LIKE 'phone%'` search with one of:
  - admin-only phone search via the decrypted view, OR
  - hashed-phone lookup column (`phone_hash text` indexed) for lookup parity without exposure.

### 3. RLS
- View `delivery_customers_decrypted`: SELECT restricted to admin/owner role.
- Base table: SELECT remains as-is (encrypted column, harmless).

### 4. Tests
- Vitest: waiter querying `list()` → response has no phone field.
- Vitest: waiter calling `findById(id)` → phone field is null/absent.
- Vitest: admin calling `findById(id)` → phone is decrypted.

## Acceptance
- `psql` query on prod DB confirms `phone` column is empty/dropped.
- Network panel for waiter on delivery customers page contains no phone numbers.
```

---

## Prompt 15 — M7: Replace hardcoded enum strings with typed Records

```
MEDIUM cleanup. 18+ files in apps/staff-web have switch statements over
hardcoded enum strings ('pending', 'preparing', 'admin', 'kitchen', ...)
without exhaustiveness checks. New enum values render undefined behavior.
The role switch in apps/staff-web/src/app/(staff)/staff/page.tsx is missing
'owner' and 'waiter' entirely.

## What to implement

### 1. Define typed Record maps in @gustri/database/enums (or @gustri/core)
For each enum that the UI maps to a config (badge color, icon, label key):
```ts
export const ORDER_STATUS_BADGES: Record<OrderStatus, { color: string; icon: string; labelKey: string }> = {
  pending_approval: { color: 'amber', icon: 'clock', labelKey: 'order_status.pending_approval' },
  new: { ... },
  preparing: { ... },
  ready: { ... },
  served: { ... },
  out_for_delivery: { ... },
  delivered: { ... },
  closed: { ... },
  cancelled: { ... },
} as const;
// TypeScript will fail to compile if a key is missing
```

Do the same for ORDER_ITEM_STATUS, USER_ROLE, TABLE_STATUS, PAYMENT_METHOD.

### 2. Replace switches
Find every switch on these enums in `apps/staff-web/src/`:
```bash
grep -rn "case 'pending'\|case 'preparing'\|case 'admin'\|case 'waiter'\|case 'kitchen'" apps/staff-web/src/
```
Replace each with `const config = ORDER_STATUS_BADGES[status];`. Remove the switch.

### 3. Add exhaustiveness helper for any remaining true switches
```ts
export function assertUnreachable(x: never): never {
  throw new Error(`Unreachable: ${JSON.stringify(x)}`);
}
// usage: default: return assertUnreachable(status);
```

### 4. Fix the staff/page.tsx role switch specifically
Add 'owner' and 'waiter' cases (or migrate to USER_ROLE_BADGES record).

## Test
- `pnpm type-check` should fail if a new enum value is added without updating the Record.
- Manual: visit staff list with each role represented; verify all render correctly.

## Acceptance
- Zero switch statements over enum strings remain in apps/staff-web/src/.
- TypeScript compile fails on missing enum coverage.
```

---

## Prompt 16 — M4: Use shared invalidation helpers in useCreateOrder

```
MEDIUM cleanup. useCreateOrder hard-codes 4 invalidations instead of using
the invalidateOrdersAndTables helper that other hooks use. Cache thrash on
every order create.

## File
`apps/staff-web/src/hooks/use-orders-safe.ts:154-159`

## What to implement
Replace:
```ts
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ACTIVE_ORDERS] });
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MONTHLY_ORDER_COUNT] });
},
```

With:
```ts
onSuccess: (createdOrder) => {
  invalidateOrdersAndTables(queryClient, {
    isDineIn: createdOrder.order_type === 'dine_in',
  });
  // Plan-cap widget — only invalidate if near cap; else skip
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MONTHLY_ORDER_COUNT] });
},
```

Verify `invalidateOrdersAndTables` in `packages/queries/src/invalidation.ts` accepts the right shape; extend its signature if needed.

## Test
- Existing tests should pass.
- Profiler: order creation triggers fewer refetches.

## Acceptance
- No hand-rolled invalidation block remains in useCreateOrder.
```

---

## Prompt 17 — M9: Require reason for auditable discounts

```
MEDIUM. Discount reason is fully optional. Discounts above the audit threshold
should require a reason for forensic clarity.

## Files
- `apps/staff-web/src/app/api/v1/orders/[id]/discount/route.ts`
- `apps/staff-web/src/lib/services/discount-service.ts`
- `packages/core/src/constants.ts` — DISCOUNT_AUDIT_THRESHOLD lives here

## What to implement
In the service, after computing `fraction` (the % of subtotal the discount represents):
```ts
if (discountType !== 'none' && fraction >= DISCOUNT_AUDIT_THRESHOLD) {
  if (!discountReason || discountReason.trim().length < 5) {
    throw new ValidationError('discount_reason_required', {
      fieldErrors: { discount_reason: 'Reason required for large discounts (≥5 chars)' },
    });
  }
}
```

Add an i18n key for the error message in `packages/i18n/src/locales/{en,az,ru,tr}/`.

## Test
- Vitest: large discount with empty reason → 400 with field error.
- Vitest: large discount with reason → 200.

## Acceptance
- Tests pass.
- UI surfaces the field error correctly (verify in apps/staff-web/src/components/orders/discount-modal.tsx or similar).
```

---

## Prompt 18 — L1: Hard-fail realtime wrapper on missing tenantId

```
LOW-severity defense-in-depth. The realtime wrapper accepts tenantId as
optional and silently builds an unfiltered channel when missing.

## File
`packages/api-client/src/wrapper/realtime.ts`

## What to implement
Make `tenantId` REQUIRED in the public type (non-optional). For any call site
that genuinely needs a global subscription (probably none in staff-web),
introduce an explicit `subscribeUnsafe()` method.

```ts
export interface RealtimeSubscribeOptions {
  callback: (payload) => void;
  tenantId: string;  // was optional
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
}

// At runtime — belt-and-suspenders:
if (!tenantId) {
  throw new Error('realtime.subscribe: tenantId is required');
}
```

Update all call sites — `useRealtimeSync` already passes it, so this is mostly a type-tightening change.

## Test
- TS compile fails if a caller omits tenantId.

## Acceptance
- `tsc` clean across the monorepo.
- Wrapper unit test asserts throw on empty string tenantId.
```

---

## Prompt 19 — Concurrency test for cleanup_empty_orders

```
Verification task — not a fix per se, but a missing test.

## Context
`supabase/migrations/20260423000003_cleanup_empty_orders_function.sql` deletes
orders that have no items. If it races with the first item insert (e.g. a slow
client posting items one at a time), it could delete a non-empty order
mid-flight.

## What to implement
Integration test in `packages/api-client/src/__tests__/` (or a new RLS test)
that:
1. Creates an order with no items.
2. In Promise.all: (a) inserts an order_item, (b) calls cleanup_empty_orders.
3. Asserts the order survives and has the item.

If the test reveals a race, fix by:
- Adding `WHERE NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = orders.id)` AND `created_at < now() - interval '5 minutes'` (grace period), OR
- Wrapping cleanup in a row-locked transaction.

## Acceptance
- Test passes (either confirms no race, or fix lands and test passes).
```

---

## Final notes for the implementing agent(s)

- After every prompt's changes: `pnpm check`, `pnpm type-check`, `pnpm test --filter=<touched-package>`.
- DB changes: always `pnpm db:types:generate` and commit the regenerated file.
- One PR per prompt is ideal. C-level fixes (1–6) should each be their own PR. H-level fixes can be grouped if they touch the same files (e.g. H5+H6 in one PR).
- Before merging C1, C2, C3 — coordinate with whoever owns the mobile app to ensure the parallel mobile call sites don't break.
- After all C-level fixes: re-run the security audit (`/security-review`) on the branch to verify the holes are closed.
