-- Fix: Drop overly-permissive RLS policies that use USING(true).
--
-- In PostgreSQL, multiple RLS policies for the same role and operation are OR'd.
-- The tenant_isolation policy (tenant_id = current_tenant_id()) is correct,
-- but these USING(true) policies override it: true OR <anything> = true.
-- Result: any authenticated user could read ALL tenants' data.

BEGIN;

-- 1. Drop staff SELECT policies with USING(true)
DROP POLICY IF EXISTS "Staff can view all order items" ON public.order_items;
DROP POLICY IF EXISTS "Staff can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can view all waiter calls" ON public.waiter_calls;

-- 2. Drop "Anyone can view" policies from baseline that were never dropped
--    by the earlier security migration (20260418000001).
--    These apply to ALL roles (no TO clause restriction) and use USING(true).
DROP POLICY IF EXISTS "Anyone can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can view order payments" ON public.order_payments;
DROP POLICY IF EXISTS "Anyone can view orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view waiter calls" ON public.waiter_calls;

-- 3. Create properly scoped staff SELECT replacements.
--    is_active_staff() checks: EXISTS (SELECT 1 FROM staff WHERE auth_user_id = auth.uid() AND is_active = true)
--    Combined with the existing tenant_isolation policy, this ensures:
--    - User must be an active staff member (is_active_staff())
--    - AND data must belong to their tenant (tenant_isolation)
CREATE POLICY "staff_read_orders" ON public.orders
  FOR SELECT TO authenticated USING (public.is_active_staff());

CREATE POLICY "staff_read_order_items" ON public.order_items
  FOR SELECT TO authenticated USING (public.is_active_staff());

CREATE POLICY "staff_read_waiter_calls" ON public.waiter_calls
  FOR SELECT TO authenticated USING (public.is_active_staff());

-- Note: order_payments already has "Staff can view all payments" with
-- USING(is_active_staff()) — that policy is correct and unchanged.

COMMIT;
