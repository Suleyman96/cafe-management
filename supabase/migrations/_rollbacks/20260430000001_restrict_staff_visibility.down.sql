-- Rollback for 20260430000001_restrict_staff_visibility — re-creates the
-- pre-M15 baseline policy that allowed any active staff to view every staff
-- row.

DROP POLICY IF EXISTS "Staff can view colleagues in tenant" ON public.staff;

CREATE POLICY "Staff can view all staff"
ON public.staff
FOR SELECT
TO authenticated
USING (public.is_active_staff());
