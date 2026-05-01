-- Rollback for 20260501000002_fix_staff_admin_cross_tenant_leak — re-creates
-- the baseline `"Admins can manage staff"` policy that lets admins/owners
-- read and write every staff row in any tenant. Reapplying this rollback
-- re-opens the cross-tenant data leak — only run as part of a full revert.

DROP POLICY IF EXISTS "Admins can insert staff in tenant" ON public.staff;
DROP POLICY IF EXISTS "Admins can update staff in tenant" ON public.staff;
DROP POLICY IF EXISTS "Admins can delete staff in tenant" ON public.staff;

CREATE POLICY "Admins can manage staff"
ON public.staff
TO authenticated
USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
