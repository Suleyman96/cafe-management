# Additional Findings & Recommendations

> Issues discovered during the review that don't fit neatly into the priority
> buckets above. These are architectural recommendations, tech debt items,
> and forward-looking improvements.
> Estimated effort: varies (1-2 weeks if all addressed)

---

## ADD-1: No Database Migration Rollback Strategy

### Problem

All 9 migrations in `supabase/migrations/` are forward-only. There are no
down migrations. This is especially dangerous for:

- `20260421000001_encrypt_customer_pii.sql` — If the encryption key is lost
  or corrupted, customer PII (names, phones, addresses) becomes unrecoverable
- `20260420000001_fix_rls_using_true.sql` — Drops policies; if the replacement
  policies have bugs, there's no quick rollback
- `20260419000002_add_financial_audit_log.sql` — Creates triggers that modify
  write paths; bugs here affect every order mutation

### Recommendation

**Step 1:** For each existing migration, create a companion rollback document
(not a SQL file to run automatically, but a documented procedure):

Create `supabase/rollbacks/README.md`:

```markdown
# Migration Rollback Procedures

Each migration has a documented rollback procedure. These are NOT automated —
they require manual review and execution by an engineer.

## 20260421000001_encrypt_customer_pii.sql
- Drop trigger: DROP TRIGGER IF EXISTS encrypt_order_pii_trigger ON orders;
- Drop functions: DROP FUNCTION IF EXISTS encrypt_pii, decrypt_pii, encrypt_order_pii;
- Drop view: DROP VIEW IF EXISTS orders_decrypted;
- WARNING: Encrypted data will remain encrypted without the key.
  Before rolling back, decrypt all data first:
  UPDATE orders SET
    customer_name = decrypt_pii(customer_name),
    customer_phone = decrypt_pii(customer_phone),
    delivery_address = decrypt_pii(delivery_address);

## 20260420000001_fix_rls_using_true.sql
- Re-create the dropped policies (see baseline migration for original definitions)
- WARNING: This re-introduces the tenant isolation bypass
```

**Step 2:** For the PII encryption key specifically:
- Document where the key is stored (Supabase Dashboard > Database > Settings)
- Store a backup of the key in a proper secrets manager (AWS Secrets Manager,
  HashiCorp Vault, or at minimum, a password manager with team access)
- Add a monitoring check that verifies decrypt_pii() works (a canary row)

**Step 3:** For future migrations, adopt a rollback-first mindset:
- Write the rollback procedure BEFORE writing the migration
- Test the rollback in local dev
- Include the rollback in the PR description

---

## ADD-2: Duplicated Order Filtering Logic Across 3 Pages

### Problem

The order status filtering pattern is copy-pasted across:
- `apps/staff-web/src/app/(staff)/orders/page.tsx`
- `apps/staff-web/src/app/(staff)/delivery/page.tsx`
- `apps/staff-web/src/app/(staff)/takeout/page.tsx`

Each has nearly identical code for:
- Status filter state management
- Filtering orders by status
- Search/text filtering
- Status badge rendering

### Recommendation

This is partially covered by MED-7 (component splitting). The specific
recommendation here is:

**Step 1:** Create a shared hook `useOrderFilters`:

```typescript
// apps/staff-web/src/hooks/use-order-filters.ts
import { useMemo, useState } from 'react';
import type { OrderWithDetails, OrderStatus } from '@gustri/database';

interface UseOrderFiltersOptions {
  orders: OrderWithDetails[];
  defaultStatuses?: OrderStatus[];
}

export function useOrderFilters({ orders, defaultStatuses }: UseOrderFiltersOptions) {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    let result = orders;

    // Filter by allowed statuses (different per page)
    if (defaultStatuses) {
      result = result.filter(o => defaultStatuses.includes(o.status));
    }

    // Filter by selected status
    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o =>
        o.id.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.table?.name?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [orders, statusFilter, searchQuery, defaultStatuses]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    for (const order of orders) {
      counts[order.status] = (counts[order.status] || 0) + 1;
    }
    return counts;
  }, [orders]);

  return {
    filtered,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    statusCounts,
  };
}
```

**Step 2:** Create a shared `OrderFilterBar` component:

```typescript
// apps/staff-web/src/components/orders/order-filter-bar.tsx
export function OrderFilterBar({
  statusFilter, setStatusFilter, searchQuery, setSearchQuery, statusCounts, statuses
}: OrderFilterBarProps) {
  // Shared filter UI with status tabs + search input
}
```

**Step 3:** Refactor each page to use the shared hook + component.

---

## ADD-3: No Global React Error Boundary

### Problem

If a React rendering error occurs outside of a component-specific error
boundary, the entire app crashes to a white screen. Next.js provides
`error.tsx` and `global-error.tsx` at the app level, and staff-web has both.

However, verify that:
1. `apps/customer-web/` also has `error.tsx` and `global-error.tsx`
2. Both error pages actually render useful UI (not just a blank fallback)
3. Errors are reported to Sentry from the error boundary

### Recommendation

**Step 1:** Verify customer-web has error boundaries:
```bash
ls apps/customer-web/src/app/error.tsx apps/customer-web/src/app/global-error.tsx
```

**Step 2:** If missing, create them:

```typescript
// apps/customer-web/src/app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <button onClick={reset} className="mt-4 rounded bg-primary px-4 py-2">
          Try again
        </button>
      </div>
    </div>
  );
}
```

**Step 3:** Ensure Sentry captures the error:
```typescript
import * as Sentry from '@sentry/nextjs';

useEffect(() => {
  Sentry.captureException(error);
}, [error]);
```

---

## ADD-4: No Database Connection Pooling Configuration

### Problem

For production with Supabase, applications should use the connection pooler
(PgBouncer on port 6543) rather than direct connections (port 5432).

The current setup uses `NEXT_PUBLIC_SUPABASE_URL` which points to the
Supabase REST API (port 443), so this is NOT a direct database connection
issue. However:

- If any server-side code uses direct PostgreSQL connections (not the REST API),
  it should use the pooler URL
- The Supabase client SDK uses the REST API, so it's already "pooled" at the
  PostgREST level

### Recommendation

**Step 1:** Verify that NO code uses direct PostgreSQL connections
(e.g., `pg`, `postgres`, `@vercel/postgres`). If all access is through
the Supabase SDK, this is a non-issue.

**Step 2:** If direct connections are ever needed (e.g., for data migrations,
heavy reports), document the pooler URL configuration in `.env.example`:

```env
# For direct PostgreSQL access (use pooler in production)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:6543/postgres?pgbouncer=true
```

---

## ADD-5: Missing Optimistic Updates in Mutations

### Problem

All mutations follow a pessimistic pattern:
1. Send mutation request
2. Wait for server response
3. Invalidate queries
4. Refetch data

For a restaurant management system where speed matters (waiter updating
order status, kitchen marking items ready), optimistic updates would
improve perceived performance significantly.

### Recommendation

**Step 1:** Identify high-frequency mutations that benefit from optimistic updates:
- Order status changes (pending -> preparing -> ready -> served)
- Waiter call acknowledgment
- Table status changes

**Step 2:** Implement optimistic updates for order status:

```typescript
// In packages/queries/src/mutations/use-update-order-status.ts
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, status }) => {
      return db.orders.update(orderId, { status });
    },
    onMutate: async ({ orderId, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['orders'] });

      // Snapshot previous value
      const previous = queryClient.getQueryData(['orders']);

      // Optimistically update
      queryClient.setQueryData(['orders'], (old: OrderWithDetails[]) =>
        old?.map(o => o.id === orderId ? { ...o, status } : o)
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      queryClient.setQueryData(['orders'], context?.previous);
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
```

**Step 3:** This is a significant refactoring effort. Prioritize the 3-4
most frequently used mutations first.

---

## ADD-6: Missing `pnpm test` in CI for RLS-Specific Tests

### Problem

The CI runs `pnpm test` (unit tests) and `pnpm test:rls` (RLS policy tests)
separately. Verify that:
1. `pnpm test` does NOT include RLS tests (they need a running Supabase)
2. `pnpm test:rls` is only run in the e2e job (which starts Supabase)

Looking at `ci.yml`:
- Line 91: `pnpm test` (test job, no Supabase)
- Line 182: `pnpm test:rls` (e2e job, has Supabase)

This is correct. No action needed.

---

## ADD-7: Real-Time Subscription Race Condition

### Problem

In `apps/staff-web/src/hooks/use-realtime-sync.ts`, the `createChannel`
function has a potential race condition:

1. Component mounts, starts channel subscription
2. Component unmounts quickly (e.g., navigation)
3. `cancelled` flag is set, but the async subscription callback may
   still fire before the flag is checked
4. Stale cache invalidations occur

### Recommendation

**Step 1:** Ensure the `cancelled` flag is checked inside the subscription
event handler, not just at channel creation time:

```typescript
channel.on('postgres_changes', { event: '*', ... }, (payload) => {
  if (cancelled) return;  // Check before invalidating
  queryClient.invalidateQueries({ queryKey });
});
```

**Step 2:** Add a max retry limit for reconnections:

```typescript
const MAX_RETRIES = 10;

if (retryCountRef.current >= MAX_RETRIES) {
  console.warn('Max realtime retries reached, falling back to polling only');
  return;
}
```

---

## ADD-8: Consider Adding Request Signing for Customer API Calls

### Problem

Customer-web calls staff-web's `/api/v1/customer/*` endpoints without any
authentication. These endpoints are protected by:
1. Rate limiting (Upstash Redis, per-IP)
2. Zod validation (schema checks)
3. Database-level RLS and tenant isolation

This is reasonable for a QR-code ordering flow. However, for defense-in-depth,
consider adding a simple HMAC signature to customer API calls:

### Recommendation

**This is a nice-to-have, not a requirement.** The current protection is adequate.

If implemented:
1. Generate a shared secret per tenant (stored in cafe_settings)
2. Customer-web signs requests with `HMAC-SHA256(tenant_secret, body + timestamp)`
3. Staff-web verifies the signature before processing

This prevents:
- Replay attacks (timestamp validation)
- Request tampering (signature verification)
- Unauthorized order creation (must know the tenant secret)

---

## ADD-9: Consider Structured Logging

### Problem

The codebase uses `console.warn` and `Sentry.captureException` for logging.
For production debugging, structured logging with correlation IDs would help:

### Recommendation

This is a long-term improvement. When the project reaches production scale:

1. Add a request ID middleware that generates a UUID per request
2. Include the request ID in all log entries and Sentry events
3. Use a structured logging library (e.g., `pino`) for server-side logging
4. Correlate client-side errors with server-side logs via the request ID

---

## Summary

| Finding | Type | Effort | When to Address |
|---------|------|--------|-----------------|
| ADD-1: Migration rollback docs | Documentation | 2 hours | Before next production migration |
| ADD-2: Shared order filters | Refactoring | 2 hours | With MED-7 component splitting |
| ADD-3: Error boundaries | Safety | 30 min | Next sprint |
| ADD-4: Connection pooling | Verification | 15 min | Before production |
| ADD-5: Optimistic updates | Performance | 4 hours | When speed complaints arise |
| ADD-6: RLS test isolation | Verification | Already correct | N/A |
| ADD-7: Realtime race condition | Bug fix | 30 min | Next sprint |
| ADD-8: Request signing | Security | 4 hours | If abuse is detected |
| ADD-9: Structured logging | Infrastructure | 1 day | At scale |
