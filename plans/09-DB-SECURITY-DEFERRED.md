# Database security — deferred findings

> Carried over from the audit on 2026-04-28. The single-tenant must-fix items
> were closed by migration `20260428000001_single_tenant_security_hardening.sql`
> (commit shipping with this doc). The findings below were intentionally
> deferred because they are unreachable in a single-tenant deployment **or**
> require a wider refactor than the launch window allows.
>
> **Hard gate:** before onboarding tenant #2, every Critical and High item
> in this file must be fixed or explicitly waived. Do not add a second
> tenant row to `public.tenants` without that review.

---

## Status legend

- 🔴 Critical — exploitable cross-tenant the moment a second tenant exists
- 🟠 High — exploitable cross-tenant or trust-boundary issue
- 🟡 Medium — correctness / hygiene
- 🟢 Low — quality / future-proofing

---

## 🔴 Critical (block tenant #2)

### C1. Report aggregation RPCs accept any `p_tenant_id`
**Where:**
- [supabase/migrations/20260423000001_report_aggregation_functions.sql](../supabase/migrations/20260423000001_report_aggregation_functions.sql)
- [supabase/migrations/20260425000001_fix_report_functions.sql](../supabase/migrations/20260425000001_fix_report_functions.sql)

`get_revenue_summary`, `get_top_sold_items`, `get_expense_summary`,
`get_waste_summary`, `get_staff_performance` are `SECURITY DEFINER`, granted
to `authenticated`, and take `p_tenant_id UUID` as the first argument with no
tenant guard. Any logged-in user can pass any tenant UUID and read full
revenue / item-mix / staff KPIs.

**Attack:**
```sql
SELECT * FROM get_revenue_summary('<other_tenant>', '2026-01-01', '2026-12-31');
```

**Fix:** add a guard or drop the parameter:
```sql
CREATE OR REPLACE FUNCTION public.assert_caller_in_tenant(p uuid) RETURNS void
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM public.staff
    WHERE auth_user_id = auth.uid() AND tenant_id = p AND is_active
  ) THEN NULL ELSE (SELECT 1/0) END;
$$;
-- in each report fn:
--   PERFORM public.assert_caller_in_tenant(p_tenant_id);
```
Better still: drop `p_tenant_id` and read `current_tenant_id()` inside.

---

### C2. `Anyone can view ...` policies bypass `tenant_isolation`
**Where:** [supabase/migrations/00000000000000_baseline.sql:2647-2687](../supabase/migrations/00000000000000_baseline.sql#L2647)

These permissive policies have no `TO` clause and use `USING(true)`, so
PostgreSQL OR's them with `tenant_isolation` and the result is `true` for
every authenticated user:

- `"Anyone can view active tables"` ON `public.tables`
- `"Anyone can view tables"` ON `public.tables`
- `"Anyone can view cafe settings"` ON `public.cafe_settings`
- `"Anyone can view feedback"` ON `public.customer_feedback`

The migration `20260420000001_fix_rls_using_true.sql` only fixed `orders`,
`order_items`, `order_payments`, and `waiter_calls`. These four were missed.

**Impact at multi-tenant:** every authenticated user reads every tenant's
table list (including QR codes — bearer capabilities), cafe settings
(feature flags, branding, contact info), and customer feedback messages.

**Fix:**
```sql
DROP POLICY IF EXISTS "Anyone can view active tables" ON public.tables;
DROP POLICY IF EXISTS "Anyone can view tables"        ON public.tables;
DROP POLICY IF EXISTS "Anyone can view cafe settings" ON public.cafe_settings;
DROP POLICY IF EXISTS "Anyone can view feedback"      ON public.customer_feedback;
```
The scoped `anon_read_*` replacements already exist for anon traffic.

---

### C3. `set_table_context()` lets staff pivot to another tenant
**Where:**
- [supabase/migrations/00000000000000_baseline.sql:259-267](../supabase/migrations/00000000000000_baseline.sql#L259) (`current_tenant_id`)
- [supabase/migrations/00000000000000_baseline.sql:529-548](../supabase/migrations/00000000000000_baseline.sql#L529) (`set_table_context`)

`current_tenant_id()` reads `app.current_tenant_id` first and only falls
back to the staff record. `set_table_context(qr_token)` is `SECURITY
DEFINER`, granted to `authenticated`, and rewrites that GUC for any QR
code. Combined with C2 (QR codes are world-readable), an authenticated
waiter at tenant A can switch their session to tenant B and operate with
their own role privileges against tenant B's data.

**Fix:**
```sql
CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL
      THEN (SELECT tenant_id FROM public.staff
              WHERE auth_user_id = auth.uid() AND is_active LIMIT 1)
    ELSE NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_table_context(text) FROM authenticated;
```

---

### C4. `cafe_settings_single_row_check` blocks tenant #2 signup
**Where:** [supabase/migrations/00000000000000_baseline.sql:1040](../supabase/migrations/00000000000000_baseline.sql#L1040)

```sql
CONSTRAINT "cafe_settings_single_row_check"
  CHECK (id = '00000000-0000-0000-0000-000000000001')
```

`handle_new_tenant_signup` inserts with the default `uuid_generate_v4()`,
so the second signup violates this check, the auth trigger fails, and
user creation rolls back. **Self-service multi-tenant onboarding is
structurally broken until this is removed.**

**Fix:**
```sql
ALTER TABLE public.cafe_settings DROP CONSTRAINT IF EXISTS cafe_settings_single_row_check;
-- The unique index on (tenant_id) already enforces "one settings row per tenant".
```

---

### C5. `calculate_order_total()` reads `cafe_settings` with no tenant filter
**Where:**
- [supabase/migrations/20260418100001_upgrade_decimal_precision.sql:78-81](../supabase/migrations/20260418100001_upgrade_decimal_precision.sql#L78)
- [supabase/migrations/20260419000002_add_financial_audit_log.sql:150-153](../supabase/migrations/20260419000002_add_financial_audit_log.sql#L150)

```sql
SELECT tax_enabled, tax_percentage
INTO settings_tax_enabled, settings_tax_percentage
FROM public.cafe_settings
LIMIT 1;
```

Once C4 is fixed and a second `cafe_settings` row exists, every order is
calculated using "whichever tenant's row comes back first." Triggers fire
on every item insert/update/delete and on discount changes, so this
silently corrupts every active order across tenants.

**Fix:**
```sql
SELECT cs.tax_enabled, cs.tax_percentage
INTO settings_tax_enabled, settings_tax_percentage
FROM public.cafe_settings cs
JOIN public.orders o ON o.tenant_id = cs.tenant_id
WHERE o.id = order_uuid
LIMIT 1;
```

---

## 🟠 High

### ~~H4. Storage buckets have no tenant scoping~~ ✅ Closed 2026-05-01
**Where:** [supabase/migrations/20260424000001_storage_policies.sql:18-65](../supabase/migrations/20260424000001_storage_policies.sql#L18)

`Authenticated users can upload/update/delete branding` and the matching
`menu-images` policies key only on `bucket_id`. Any authenticated user can
overwrite or delete any tenant's branding/menu image.

**Fix:** require a tenant-prefixed path:
```sql
USING (
  bucket_id = 'branding'
  AND split_part(name, '/', 1) = (
    SELECT tenant_id::text FROM public.staff
    WHERE auth_user_id = auth.uid() LIMIT 1
  )
)
```
Migrate existing files to `branding/<tenant_id>/...` and update the upload
helpers in `apps/staff-web/src/lib/services/*` accordingly.

---

### H5. `set_table_context` granted to `authenticated`
Same root cause as C3. Even after C3 is fixed, leave the GUC writeable
only to `anon` (the QR-code customer flow needs it).

**Fix:**
```sql
REVOKE EXECUTE ON FUNCTION public.set_table_context(text) FROM authenticated;
```

---

### H7. `update_order_payment_status` updates orders/tables with no tenant guard
**Where:** [supabase/migrations/00000000000000_baseline.sql:784-829](../supabase/migrations/00000000000000_baseline.sql#L784)

The trigger is `SECURITY DEFINER`. With C2/C3 still open, an attacker who
can guess an `order_id` from another tenant can insert a payment that
flips the foreign tenant's order to `closed` and frees its table. Even
after C2/C3 are fixed it's defense-in-depth to assert tenant equality.

**Fix:** inside the trigger,
```sql
SELECT tenant_id, table_id INTO v_tenant, order_table_id
FROM public.orders WHERE id = NEW.order_id;
IF v_tenant <> NEW.tenant_id THEN
  RAISE EXCEPTION 'tenant mismatch on payment';
END IF;
```

---

## 🟡 Medium

### M1. Global uniqueness on `tables.table_number` and `orders.order_number`
**Where:**
- [supabase/migrations/00000000000000_baseline.sql:1657](../supabase/migrations/00000000000000_baseline.sql#L1657) (`orders_order_number_key`)
- [supabase/migrations/00000000000000_baseline.sql:1712](../supabase/migrations/00000000000000_baseline.sql#L1712) (`tables_table_number_key`)

`order_number` is generated per (tenant, day) but the unique constraint
is global → guaranteed collision on day-2 of multi-tenant operation. Two
tenants cannot both have "Table 1".

**Fix:**
```sql
ALTER TABLE public.tables  DROP CONSTRAINT tables_table_number_key;
ALTER TABLE public.orders  DROP CONSTRAINT orders_order_number_key;
CREATE UNIQUE INDEX tables_tenant_number_uniq ON public.tables (tenant_id, table_number);
CREATE UNIQUE INDEX orders_tenant_number_uniq ON public.orders (tenant_id, order_number);
```

---

### M2. `generate_order_number()` opens-fails when no tenant context is set
**Where:** [supabase/migrations/00000000000000_baseline.sql:273-298](../supabase/migrations/00000000000000_baseline.sql#L273)

```sql
WHERE (v_tenant_id IS NULL OR tenant_id = v_tenant_id)
```

If both `app.current_tenant_id` and `auth.uid()` are unset (a server-role
script, a misconfigured API route), the count crosses tenants. After M1 it
also collides on the unique index.

**Fix:** raise on `NULL` instead of falling open.
```sql
IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'no tenant context'; END IF;
```

---

### M3. `check_order_limit` / `check_table_limit` open-default to unlimited
**Where:** [supabase/migrations/00000000000000_baseline.sql:189-256](../supabase/migrations/00000000000000_baseline.sql#L189)

When `tenants.plan` is `NULL` or unrecognized, `v_max := -1` and the
trigger returns `NEW`. Default to the lowest plan instead.

**Fix:**
```sql
v_max := CASE COALESCE(v_plan, 'free')
  WHEN 'free' THEN 100
  WHEN 'standard' THEN 700
  WHEN 'pro' THEN 2200
  WHEN 'business' THEN 999999
  ELSE 100
END;
```

---

### M4. `tenants` row leaks `plan` / `is_active` to every staff member
**Where:** [supabase/migrations/00000000000000_baseline.sql:3052](../supabase/migrations/00000000000000_baseline.sql#L3052)

`tenant_read_own` allows SELECT of all columns. If staff shouldn't know
they're on the `free` plan, expose only safe columns through a view.

**Fix:** create `public.tenant_self_view` returning `name, slug` only and
revoke direct table SELECT.

---

### M8. JWT custom-claims hook is wired but unused at the RLS layer
**Where:** [supabase/migrations/20260423000006_jwt_custom_claims_hook.sql](../supabase/migrations/20260423000006_jwt_custom_claims_hook.sql)

The hook writes `tenant_id`, `user_role`, `is_active_staff` into the JWT,
but `current_tenant_id()` / `get_my_staff_role()` / `is_active_staff()`
still query the `staff` table on every RLS evaluation. One staff lookup
per query × every policy = wasted load.

**Fix:** read `auth.jwt() ->> 'tenant_id'` first and fall back to the
table only when the claim is missing.

---

### M9. Realtime publication leaks broken RLS to subscribers
**Where:** [supabase/migrations/00000000000000_baseline.sql:3074-3090](../supabase/migrations/00000000000000_baseline.sql#L3074)

`supabase_realtime` publishes `orders`, `order_items`, `order_payments`,
`tasks`, `waiter_calls`. Realtime enforces RLS — but with C2/C3 still
open, a subscriber gets a live firehose of every tenant's events. This
finding closes automatically once C2/C3 close, but verify with a load
test before tenant #2 onboards.

---

### M10. `cleanup_empty_orders` has no role guard
**Where:** [supabase/migrations/20260423000003_cleanup_empty_orders_function.sql](../supabase/migrations/20260423000003_cleanup_empty_orders_function.sql)

Any active staff member can call it and bulk-cancel `new` /
`pending_approval` orders in their tenant.

**Fix:** check `get_my_staff_role() IN ('admin','owner')` at the top.

---

### M11. `active_orders_view` has no `LIMIT` and joins four tables
**Where:** [supabase/migrations/00000000000000_baseline.sql:2114-2134](../supabase/migrations/00000000000000_baseline.sql#L2114)

Fine for a single 30-table cafe. At thousands of tenants × dozens of
active orders it becomes the most expensive query in
`pg_stat_statements`. Add `LIMIT 200` and let `security_invoker = on` +
the upcoming `tenant_id = current_tenant_id()` predicate keep it scoped.

---

## 🟢 Low

### L1. Index column order on staff email
[supabase/migrations/20260423000005_staff_email_per_tenant.sql:9-10](../supabase/migrations/20260423000005_staff_email_per_tenant.sql#L9) —
`(LOWER(email), tenant_id)` should be `(tenant_id, LOWER(email))` for
prefix-scan efficiency. Drop and recreate.

### L2. `idx_staff_auth_user` should be `UNIQUE`
[supabase/migrations/00000000000000_baseline.sql:1946](../supabase/migrations/00000000000000_baseline.sql#L1946) —
the codebase assumes one staff row per auth user. Enforce it.

### L4. CHECK-constraint enums vs. PG ENUM
Multiple tables use literal `CHECK ((status)::text = ANY(...))` lists for
status/priority. Adding a state requires a migration. Consider a
PostgreSQL `ENUM` and re-use it from the wrapper TS types.

### L5. Staff email backfill missing `LOWER()`
The new tenant-scoped unique index uses `LOWER(email)` but no migration
backfilled `LOWER()` against existing rows. Pre-existing emails may
collide if two staff at the same tenant differ only by case.

### L6. Some triggers don't set `search_path`
`auto_acknowledge_feedback` and a few others don't declare
`SECURITY DEFINER` or `SET search_path`. With baseline's trailing
`RESET search_path` this is defense-in-depth, not exploitable today, but
keeps Supabase's linter quiet.

---

## Operational follow-ups

- **PII encryption probe:** the staff-web `instrumentation.ts` introduced in
  `20260428000001` blocks production boot if `app.pii_encryption_key` is
  unset. Set it via `ALTER DATABASE postgres SET app.pii_encryption_key =
  '<rotation-key>'` in the Supabase dashboard before the next deploy.
- **Backfill encrypted rows:** when the key is first set, re-run the
  `UPDATE public.orders SET ... = encrypt_pii(...)` block from
  `20260421000001_encrypt_customer_pii.sql` once. Existing plaintext rows
  decrypt as themselves (the function fall-through is intentional), but
  they should be encrypted in place for at-rest protection.
- **Tenant-#2 gate:** before inserting a second row into `public.tenants`,
  re-run this checklist and require sign-off on every C/H item.

---

## Quick reference — fixed in `20260428000001`

For completeness, these were closed by the migration shipping with this
doc; do not re-fix them:

| Item | Fix |
|------|-----|
| C6   | `orders_decrypted` → `security_invoker = on`, revoke from `anon` |
| C7   | dropped `Anon can free occupied tables` |
| H1   | dropped unscoped anon cancel policies |
| H2   | role-guarded `refunds` insert + denied update/delete |
| H3   | `transfer_table` / `transfer_order_items` derive actor from `auth.uid()` |
| H6   | revoked `encrypt_pii` / `decrypt_pii` from PUBLIC |
| H8   | revoked client `INSERT/UPDATE` on `stock_movements` |
| M6   | added `pii_encryption_status()` probe + Next.js `instrumentation.ts` |
| L3   | added partial `idx_orders_delivery_token` |

---

## Quick reference — fixed in `20260501000001`

| Item | Fix |
|------|-----|
| H4   | Storage RLS for `branding` and `menu-images` now requires the path's first segment to equal the caller's tenant id (`split_part(name, '/', 1) = current_tenant_id_text()`); existing object names + URL columns backfilled to the new prefix; `image-upload.tsx` and `menu-item-modal.tsx` now write to `<tenant_id>/<folder>/<file>`. |
