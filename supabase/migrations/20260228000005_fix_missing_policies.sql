-- Fix missing and broken RLS policies for production
-- Issues:
-- 1. Staff have no INSERT policy on orders, order_items, waiter_calls
-- 2. cafe_settings UPDATE allows anyone (no role check)
-- 3. Some policies still query staff table directly (recursion risk)

-- ============================================================
-- 1. Add missing staff INSERT policies
-- ============================================================

-- Staff can create orders (waiters take orders on behalf of tables)
CREATE POLICY "Staff can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_staff_role() IN ('waiter', 'admin', 'owner'));

-- Staff can add items to orders
CREATE POLICY "Staff can add order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_staff_role() IN ('waiter', 'admin', 'owner'));

-- Staff can delete order items (e.g., remove items before sending)
DROP POLICY IF EXISTS "Staff can delete order items" ON order_items;
CREATE POLICY "Staff can delete order items"
  ON order_items FOR DELETE
  TO authenticated
  USING (public.get_my_staff_role() IN ('waiter', 'admin', 'owner'));

-- ============================================================
-- 2. Fix cafe_settings UPDATE policy (was USING(true) with no role check)
-- ============================================================

DROP POLICY IF EXISTS "Admins can update cafe settings" ON cafe_settings;
CREATE POLICY "Admins can update cafe settings"
  ON cafe_settings FOR UPDATE
  TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

-- ============================================================
-- 3. Fix remaining policies that query staff table directly
--    (these cause recursion now that RLS is enabled on staff)
-- ============================================================

-- Orders: "Staff can update orders" from migration 3 had subquery on staff
-- Already fixed in 20260228000004, but verify no duplicates
-- (These were already handled)

-- Fix: "Staff can view all orders" - original uses USING(true), no recursion - OK
-- Fix: "Staff can view all order items" - original uses USING(true), no recursion - OK
-- Fix: "Staff can view all waiter calls" - original uses USING(true), no recursion - OK

-- ============================================================
-- 4. Fix order_payments INSERT policy (may still reference staff table)
-- ============================================================

-- The INSERT policy from 20260228000004 already uses get_my_staff_id()
-- But also check the original SELECT for payments
DROP POLICY IF EXISTS "Staff can view all payments" ON order_payments;
CREATE POLICY "Staff can view all payments"
  ON order_payments FOR SELECT
  TO authenticated
  USING (public.is_active_staff());

-- ============================================================
-- 5. Fix customer_feedback policies that may reference staff table
-- ============================================================

-- Check: "Staff can view all feedback" - if it queries staff, fix it
DROP POLICY IF EXISTS "Staff can view all feedback" ON customer_feedback;
CREATE POLICY "Staff can view all feedback"
  ON customer_feedback FOR SELECT
  TO authenticated
  USING (public.is_active_staff());

-- ============================================================
-- 6. Fix table_transfers SELECT policy (staff need to view transfers)
-- ============================================================

DROP POLICY IF EXISTS "Staff can view transfers" ON table_transfers;
CREATE POLICY "Staff can view transfers"
  ON table_transfers FOR SELECT
  TO authenticated
  USING (public.is_active_staff());

-- ============================================================
-- 7. Ensure staff_schedules policies work (currently USING(true))
--    These are fine as-is since they use TO authenticated USING(true)
-- ============================================================

-- No changes needed for staff_schedules (all authenticated can manage)
