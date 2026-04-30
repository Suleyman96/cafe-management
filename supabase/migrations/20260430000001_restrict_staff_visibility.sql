-- M15: Restrict the broad "Staff can view all staff" RLS policy.
--
-- Problem: the baseline policy let any active staff member SELECT every other
-- staff row in the database (including emails, roles, and any salary-like
-- fields if added later). On a single-tenant install RLS still permits
-- cross-row reads inside the same tenant, but the policy had no `tenant_id`
-- predicate at all — so even a misconfigured Supabase instance hosting more
-- than one tenant would have leaked staff lists across tenants.
--
-- New policy:
--   - Always tenant-scoped (`tenant_id = current_tenant_id()`).
--   - admins/owners see every colleague row in their tenant.
--   - waiter/kitchen see ONLY their own row.
--
-- The product surfaces colleague-listing for assignment (tasks, schedules)
-- only on admin-tier flows, so non-admins losing colleague visibility is
-- intentional. If a future feature needs limited columns exposed to
-- waiters, add a separate policy or a column-restricted view.

DROP POLICY IF EXISTS "Staff can view all staff" ON public.staff;

CREATE POLICY "Staff can view colleagues in tenant"
ON public.staff
FOR SELECT
TO authenticated
USING (
  public.is_active_staff()
  AND tenant_id = public.current_tenant_id()
  AND (
    public.get_my_staff_role() IN ('admin', 'owner')
    OR id = public.get_my_staff_id()
  )
);
