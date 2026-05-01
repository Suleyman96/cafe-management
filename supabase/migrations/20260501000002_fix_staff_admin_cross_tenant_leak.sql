-- M17: Close the cross-tenant data leak in the staff RLS surface.
--
-- Bug: the baseline policy `"Admins can manage staff"` (00000000000000:2595)
-- has no FOR clause (so it covers SELECT/INSERT/UPDATE/DELETE) and no
-- `tenant_id` predicate. Postgres combines permissive policies with OR,
-- so the policy returned TRUE for every staff row whenever the caller's
-- role was admin/owner — bypassing both the M15 tenant-scoped colleague
-- policy and the `tenant_isolation` policy.
--
-- Detection: an admin from tenant 1 (admin@test.com) running
-- `SELECT tenant_id FROM staff` saw rows from tenant 2 (admin2@test.com),
-- caught by `M15: admin sees colleagues across roles in their tenant` in
-- `packages/api-client/src/__tests__/rls/rls-policies.test.ts`.
--
-- Fix: replace the over-broad FOR ALL policy with three op-specific
-- policies (INSERT/UPDATE/DELETE) that each carry both the role check
-- and the tenant predicate. SELECT is intentionally not covered here —
-- it is already governed correctly by:
--   * `Users can view their own staff record` (own row, safe)
--   * `Staff can view colleagues in tenant` (M15, tenant-scoped)
--   * `tenant_isolation` (tenant-scoped)
--
-- Defense-in-depth: each new write policy duplicates the tenant check
-- that `tenant_isolation` already provides. With OR-combined permissive
-- policies, every individual policy must self-fence — relying on a
-- separate policy to add the tenant predicate is exactly what created
-- this bug in the first place.

DROP POLICY IF EXISTS "Admins can manage staff" ON public.staff;

CREATE POLICY "Admins can insert staff in tenant"
ON public.staff
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text])
  AND tenant_id = public.current_tenant_id()
);

CREATE POLICY "Admins can update staff in tenant"
ON public.staff
FOR UPDATE
TO authenticated
USING (
  public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text])
  AND tenant_id = public.current_tenant_id()
)
WITH CHECK (
  public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text])
  AND tenant_id = public.current_tenant_id()
);

CREATE POLICY "Admins can delete staff in tenant"
ON public.staff
FOR DELETE
TO authenticated
USING (
  public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text])
  AND tenant_id = public.current_tenant_id()
);
