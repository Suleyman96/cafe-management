# Phase 3 Prompt: Multi-Tenant Correctness (SCALE-6 + SCALE-7)

Copy everything below the line and paste it as the prompt for a new Claude Code session.

---

## Task

Implement Phase 3 (SCALE-6 and SCALE-7) from `plans/07-SCALING-AND-ARCHITECTURE-fixes.md`. Read that file for full context, but this prompt contains the verified details you need.

## What you're fixing and why

Two multi-tenancy bugs that get worse as you onboard more cafes:
1. **IDOR vulnerability**: The `get_delivery_order(p_order_id)` RPC function returns any delivery order by UUID with no access validation. Any anonymous user who can guess/enumerate a UUID gets full order details including customer PII.
2. **Global email uniqueness**: The `staff` table has `UNIQUE("email")` globally instead of per-tenant. If Cafe A registers `manager@gmail.com`, Cafe B can never use that email for their own staff.

---

## SCALE-6: Delivery order access control

### Goal
Add a `delivery_access_token` column to orders. When a delivery order is created, a random token is generated. The tracking page URL includes this token. The `get_delivery_order` RPC function requires the token to return data.

### Current state (verified)

**The RPC function** is in `supabase/migrations/20260418000001_fix_security_issues.sql` lines 192-264:

```sql
CREATE OR REPLACE FUNCTION public.get_delivery_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
```

- Takes only `p_order_id` — no access control
- Returns a JSONB object with full order details including `customer_name`, `customer_phone`, `delivery_address`
- Granted to both `anon` and `authenticated` roles (lines 315-316)

**The customer-web tracking page** is at `apps/customer-web/src/app/delivery/order/[orderId]/page.tsx`:
- Server component that renders `<DeliveryOrderStatus orderId={params.orderId} />`
- The orderId comes from the URL path param

**The customer-web hook** is at `apps/customer-web/src/hooks/use-delivery.ts` lines 9-24:
```typescript
export function useDeliveryOrder(orderId: string) {
  const query = useQuery({
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as Function)('get_delivery_order', {
        p_order_id: orderId,
      });
      // ...
    },
  });
}
```

**How customers reach the tracking page**: After placing a delivery order in `apps/customer-web/src/components/cart/delivery-cart-screen.tsx` line 84:
```typescript
router.push(`/delivery/order/${order.id}`);
```

**There is NO `delivery_access_token` column yet** — confirmed by searching all migrations.

**The `orders` table** does NOT have `pgcrypto` loaded, but the `gen_random_bytes` function is available via `pgcrypto` extension which is already enabled (used for PII encryption in migration `20260421000001`).

### Implementation steps

**Step 1** — Create migration `supabase/migrations/YYYYMMDD_delivery_access_token.sql`:

```sql
-- Add access token column to orders for delivery order tracking security
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_access_token TEXT;

-- Generate tokens for existing delivery orders
UPDATE public.orders
SET delivery_access_token = encode(gen_random_bytes(16), 'hex')
WHERE order_type = 'delivery'
  AND delivery_access_token IS NULL;

-- Set default for new rows (all order types get a token, but only delivery uses it)
ALTER TABLE public.orders
ALTER COLUMN delivery_access_token SET DEFAULT encode(gen_random_bytes(16), 'hex');

-- Replace the existing get_delivery_order function to require the token
CREATE OR REPLACE FUNCTION public.get_delivery_order(
  p_order_id UUID,
  p_access_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'table_id', o.table_id,
    'tenant_id', o.tenant_id,
    'status', o.status,
    'order_type', o.order_type,
    'source', o.source,
    'subtotal', o.subtotal,
    'tax', o.tax,
    'total', o.total,
    'customer_notes', o.customer_notes,
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'delivery_address', o.delivery_address,
    'delivery_notes', o.delivery_notes,
    'delivery_fee', o.delivery_fee,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'order_items', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'order_id', oi.order_id,
          'menu_item_id', oi.menu_item_id,
          'item_name', oi.item_name,
          'item_price', oi.item_price,
          'quantity', oi.quantity,
          'status', oi.status,
          'notes', oi.notes,
          'created_at', oi.created_at,
          'updated_at', oi.updated_at,
          'tenant_id', oi.tenant_id,
          'menu_item', (
            SELECT jsonb_build_object(
              'id', mi.id,
              'name', mi.name,
              'price', mi.price,
              'image_url', mi.image_url
            )
            FROM public.menu_items mi
            WHERE mi.id = oi.menu_item_id
          )
        )
        ORDER BY oi.created_at ASC
      )
      FROM public.order_items oi
      WHERE oi.order_id = o.id),
      '[]'::jsonb
    ),
    'delivery_person', CASE
      WHEN o.delivery_person_id IS NOT NULL THEN (
        SELECT jsonb_build_object('full_name', s.full_name)
        FROM public.staff s
        WHERE s.id = o.delivery_person_id
      )
      ELSE NULL
    END
  ) INTO result
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.delivery_access_token = p_access_token;

  RETURN result;
END;
$$;

-- Update grants (new function signature)
GRANT EXECUTE ON FUNCTION public.get_delivery_order(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_delivery_order(UUID, TEXT) TO authenticated;
```

**Key change**: The WHERE clause now includes `AND o.delivery_access_token = p_access_token`. If the token doesn't match, the function returns NULL.

**Important**: The old function signature `get_delivery_order(UUID)` will still exist as an overload. To clean it up:
```sql
-- Drop the old single-argument version
DROP FUNCTION IF EXISTS public.get_delivery_order(UUID);
```
Add this BEFORE the `CREATE OR REPLACE` of the new function. PostgreSQL treats different argument signatures as different functions.

**Step 2** — Update the order creation API to return the access token.

The customer creates delivery orders via `apps/customer-web/src/lib/api-routes.ts` which calls the staff-web API at `/api/v1/customer/orders`. Check the staff-web API route at `apps/staff-web/src/app/api/v1/customer/orders/route.ts` — the response needs to include the `delivery_access_token` field.

Read the create order API response. The token is generated by the database default, so it should already be in the INSERT...RETURNING result. Verify that the API response includes all columns from the orders table (or specifically add `delivery_access_token` to the select).

**Step 3** — Update the customer-web navigation to include the token in the URL.

In `apps/customer-web/src/components/cart/delivery-cart-screen.tsx` line 84, change:
```typescript
// BEFORE:
router.push(`/delivery/order/${order.id}`);

// AFTER:
router.push(`/delivery/order/${order.id}?token=${order.delivery_access_token}`);
```

**Step 4** — Update the tracking page to extract and pass the token.

`apps/customer-web/src/app/delivery/order/[orderId]/page.tsx`:
```typescript
// This is a server component — it can read searchParams
interface PageProps {
  params: { orderId: string };
  searchParams: { token?: string };
}

export default function DeliveryOrderPage({ params, searchParams }: PageProps) {
  return (
    <DeliveryOrderStatus
      orderId={params.orderId}
      accessToken={searchParams.token ?? ''}
    />
  );
}
```

Check if `DeliveryOrderStatus` is a client component (it likely is). If so, it receives `accessToken` as a prop.

**Step 5** — Update the delivery hook to pass the token.

`apps/customer-web/src/hooks/use-delivery.ts` lines 9-24:
```typescript
export function useDeliveryOrder(orderId: string, accessToken?: string) {
  const query = useQuery({
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as Function)('get_delivery_order', {
        p_order_id: orderId,
        p_access_token: accessToken ?? null,
      });
      if (error) throw error;
      if (!data) return null;
      return data as unknown as DeliveryOrderWithDetails;
    },
    enabled: !!orderId && !!accessToken,
  });
  // ... rest unchanged
}
```

**Step 6** — Update `DeliveryOrderStatus` component to accept and forward the `accessToken` prop to `useDeliveryOrder`. Find this component at `apps/customer-web/src/components/order/delivery-order-status.tsx` (or similar path) and add the prop.

**Step 7** — Also check if the Realtime subscription in `useDeliveryOrder` (lines 27-69) needs changes. It subscribes to order changes by ID — this is fine because Realtime uses Supabase's own channel auth, not the RPC function. The subscription just triggers a refetch which goes through the RPC with the token.

### Verification
- Create a delivery order through the customer-web UI → verify you're redirected to tracking page WITH `?token=...` in the URL
- Copy the tracking URL with the correct token → page loads and shows order details
- Change the token in the URL to a random string → page shows null/empty (no order data)
- Remove the token entirely → page shows null/empty
- Call `get_delivery_order('valid-uuid', NULL)` directly → returns NULL
- Call `get_delivery_order('valid-uuid')` (old single-arg) → should error or not exist
- Run `pnpm test && pnpm type-check && pnpm check`

---

## SCALE-7: Staff email uniqueness per tenant

### Goal
Change the staff email constraint from globally unique to unique per tenant. Two different cafes should be able to register the same email address independently.

### Current state (verified)

**The constraint** is in `supabase/migrations/00000000000000_baseline.sql` line 1672:
```sql
ALTER TABLE "public"."staff"
    ADD CONSTRAINT "staff_email_key" UNIQUE ("email");
```

**The staff table** (baseline.sql lines 1311-1325):
- `id` UUID PK
- `email` VARCHAR(255) NOT NULL
- `full_name` VARCHAR(255) NOT NULL
- `role` VARCHAR(20) NOT NULL
- `phone` VARCHAR(20)
- `is_active` BOOLEAN DEFAULT true
- `auth_user_id` UUID
- `preferred_language` TEXT DEFAULT 'en'
- `tenant_id` UUID NOT NULL (defaults to `current_tenant_id()`)

**Existing indexes on staff** (baseline.sql line 1966):
- `idx_staff_tenant` on `(tenant_id)`

**Staff creation** happens in `apps/staff-web/src/app/api/staff/route.ts`:
- Line 47-51: Creates a Supabase Auth user with `auth.admin.createUser({ email, password })`
- Lines 63-75: Creates a staff record with `INSERT INTO staff` including `tenant_id: adminOrError.tenant_id`
- Lines 77-81: If staff insert fails, it rolls back by deleting the auth user

**Important nuance**: Supabase Auth users are GLOBAL (across all tenants). The `auth.users` table has its own unique email constraint. This means:
- Two tenants can have staff records with the same email (after our fix)
- BUT they would need to share the same Supabase Auth user (same `auth_user_id`)
- OR each tenant creates a separate auth user with the same email (which Supabase Auth does NOT allow — auth.users.email is globally unique)

**This means the fix is more complex than just changing the staff table constraint.** There are two approaches:

**Approach A — Shared auth user, multiple staff records:**
- Allow the same `auth_user_id` to appear in multiple staff records (one per tenant)
- On login, the system would need to ask "which cafe?" or auto-select based on tenant context
- The staff creation API would need to check: "does an auth user with this email already exist? If so, link to it instead of creating a new one"

**Approach B — Staff table only (simpler, recommended for now):**
- Change the unique constraint to `(LOWER(email), tenant_id)`
- Keep Supabase Auth's global uniqueness as-is
- In the staff creation API: if `auth.admin.createUser` fails because email exists, try to find the existing auth user and link the new staff record to it
- This naturally supports the "same person works at two cafes" scenario

### Implementation steps

**Step 1** — Create migration `supabase/migrations/YYYYMMDD_staff_email_per_tenant.sql`:

```sql
-- Change staff email uniqueness from global to per-tenant
-- This allows the same email to be used by different tenants

-- Drop the global unique constraint
ALTER TABLE public.staff
DROP CONSTRAINT IF EXISTS staff_email_key;

-- Add tenant-scoped unique index (case-insensitive)
CREATE UNIQUE INDEX idx_staff_email_tenant
ON public.staff (LOWER(email), tenant_id);
```

**Step 2** — Update the staff creation API at `apps/staff-web/src/app/api/staff/route.ts`.

Currently (lines 47-81), it:
1. Creates auth user → if fails, returns error
2. Creates staff record → if fails, deletes auth user

After the fix, it needs to handle the case where the auth user already exists (because another tenant already registered this email):

```typescript
// Line 47: Try to create auth user
const { data: authData, error: authError } = await getSupabaseAdmin().auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

let authUserId: string;

if (authError) {
  // Check if error is "user already exists"
  if (authError.message?.includes('already been registered') ||
      authError.status === 422) {
    // Find the existing auth user
    const { data: existingUsers } = await getSupabaseAdmin().auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (!existingUser) {
      Sentry.captureException(authError);
      return NextResponse.json({ error: 'Failed to create user account' }, { status: 400 });
    }
    authUserId = existingUser.id;
  } else {
    Sentry.captureException(authError);
    return NextResponse.json({ error: 'Failed to create user account' }, { status: 400 });
  }
} else if (!authData.user) {
  return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
} else {
  authUserId = authData.user.id;
}

// Create staff record
const { data: staffData, error: staffError } = await getSupabaseAdmin()
  .from('staff')
  .insert({
    email,
    full_name,
    role,
    phone: phone || null,
    is_active: true,
    auth_user_id: authUserId,
    tenant_id: adminOrError.tenant_id,
  })
  .select()
  .single();

if (staffError) {
  Sentry.captureException(staffError);
  // Only delete the auth user if WE created it (not if it already existed)
  if (authData?.user) {
    await getSupabaseAdmin().auth.admin.deleteUser(authData.user.id);
  }
  return NextResponse.json({ error: 'Failed to create staff record' }, { status: 400 });
}
```

**Important edge case**: The `listUsers()` call can be expensive if there are many auth users. A better approach is to use `getUserByEmail()` if available in Supabase admin API, or catch the specific error:

```typescript
// Better: use getUserById or filter
const { data: { users }, error: listError } = await getSupabaseAdmin()
  .auth.admin.listUsers({ filter: `email.eq.${email}` });
```

Check the Supabase admin API docs for the exact method. If `listUsers` doesn't support filtering, use a direct query or try-catch approach.

**Step 3** — Handle the login flow. When a user with staff records in multiple tenants logs in, the current `loadStaffAndSetup` in `apps/staff-web/src/hooks/use-auth.ts` (line 42) calls:

```typescript
const staffData = (await db.staff.findByAuthId(userId)) as Staff;
```

Check what `findByAuthId` returns. If it returns a single record (`.single()`), it will break when there are multiple staff records for the same auth user. Read `packages/api-client/src/wrapper/staff.ts` to verify.

If it already uses RLS with `current_tenant_id()`, it will correctly return only the staff record for the current tenant. If not, it may need to be scoped.

**This is the most important thing to verify before implementing.** Read the `findByAuthId` method in the staff wrapper.

**Step 4** — Verify that RLS on the staff table already filters by tenant_id (it does — confirmed at baseline.sql line 3012: `USING (tenant_id = current_tenant_id())`). This means `findByAuthId` queries through RLS and will only return the staff record for the current tenant context.

However, if the user has staff records in two tenants, they need a way to pick which tenant to log into. This is a UX consideration that may be out of scope. For now, document this as a known limitation: "if a user belongs to multiple tenants, they'll see whichever tenant's context is set in their session."

### Verification
- Run the migration: `staff_email_key` constraint is dropped, `idx_staff_email_tenant` index is created
- Create staff with `test@example.com` in tenant A → succeeds
- Create staff with `test@example.com` in tenant B → succeeds (same auth user gets linked)
- Create staff with `test@example.com` in tenant A again → fails (duplicate within same tenant)
- Login as `test@example.com` → lands in whichever tenant context is set
- Existing staff records still work (no data loss)
- Run `pnpm test && pnpm type-check && pnpm check`

---

## General rules

- Follow existing code patterns exactly — look at how other wrappers, hooks, and pages are structured before writing new code
- Use Biome formatting: 2-space indent, single quotes, trailing commas. Run `pnpm check:fix` before considering done
- Migration filenames: use format `YYYYMMDD000001_description.sql` with today's date. Check existing migrations for the latest date prefix to avoid collisions
- The `get_delivery_order` function replacement must reproduce the EXACT same JSONB structure as the current function — just add the WHERE clause for the token. Read the current function at `supabase/migrations/20260418000001_fix_security_issues.sql` lines 192-264 to get the exact field list
- Do NOT add comments, docstrings, or type annotations beyond what's needed
- Do NOT refactor surrounding code — only change what's needed for these two issues
- Run `pnpm test && pnpm type-check && pnpm check` at the end to verify everything passes
