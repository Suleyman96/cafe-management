-- Fix infinite recursion in staff RLS policies (production)
-- The issue: policies on "staff" that subquery "staff" cause recursion when RLS is enabled
-- Solution: Use SECURITY DEFINER functions that bypass RLS to check the current user's role

-- 1. Create helper function to get the current user's staff role (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_my_staff_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.staff
  WHERE auth_user_id = auth.uid()
  AND is_active = true
  LIMIT 1;
$$;

-- 2. Create helper function to check if user is active staff (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE auth_user_id = auth.uid()
    AND is_active = true
  );
$$;

-- 3. Create helper to get current user's staff ID (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_my_staff_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.staff
  WHERE auth_user_id = auth.uid()
  AND is_active = true
  LIMIT 1;
$$;

-- ============================================================
-- 4. Fix staff table policies (the main source of recursion)
-- ============================================================

DROP POLICY IF EXISTS "Users can view their own staff record" ON staff;
DROP POLICY IF EXISTS "Staff can view all staff" ON staff;
DROP POLICY IF EXISTS "Admins can manage staff" ON staff;

-- Users can always view their own record (no subquery needed)
CREATE POLICY "Users can view their own staff record"
  ON staff FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Active staff can view all staff records
CREATE POLICY "Staff can view all staff"
  ON staff FOR SELECT
  TO authenticated
  USING (public.is_active_staff());

-- Admins/owners can manage all staff records
CREATE POLICY "Admins can manage staff"
  ON staff FOR ALL
  TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

-- ============================================================
-- 5. Fix all other policies that subquery staff table
-- ============================================================

-- Tables
DROP POLICY IF EXISTS "Staff can update tables" ON tables;
CREATE POLICY "Staff can update tables"
  ON tables FOR UPDATE TO authenticated
  USING (public.get_my_staff_role() IN ('waiter', 'admin', 'owner'));

-- Categories
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

-- Menu items
DROP POLICY IF EXISTS "Admins can manage menu items" ON menu_items;
CREATE POLICY "Admins can manage menu items"
  ON menu_items FOR ALL TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

-- Orders - update
DROP POLICY IF EXISTS "Staff can update orders" ON orders;
CREATE POLICY "Staff can update orders"
  ON orders FOR UPDATE TO authenticated
  USING (public.get_my_staff_role() IN ('waiter', 'admin', 'owner'));

-- Orders - delete
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;
CREATE POLICY "Admins can delete orders"
  ON orders FOR DELETE TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

-- Order items - update
DROP POLICY IF EXISTS "Staff can update order items" ON order_items;
CREATE POLICY "Staff can update order items"
  ON order_items FOR UPDATE TO authenticated
  USING (public.get_my_staff_role() IN ('waiter', 'admin', 'kitchen', 'owner'));

-- Waiter calls - update
DROP POLICY IF EXISTS "Staff can update waiter calls" ON waiter_calls;
CREATE POLICY "Staff can update waiter calls"
  ON waiter_calls FOR UPDATE TO authenticated
  USING (public.get_my_staff_role() IN ('waiter', 'admin', 'owner'));

-- Customer feedback - update
DROP POLICY IF EXISTS "Staff can update feedback" ON customer_feedback;
CREATE POLICY "Staff can update feedback"
  ON customer_feedback FOR UPDATE TO authenticated
  USING (public.get_my_staff_role() IN ('waiter', 'admin', 'owner'));

-- Customer feedback - delete
DROP POLICY IF EXISTS "Admins can delete feedback" ON customer_feedback;
CREATE POLICY "Admins can delete feedback"
  ON customer_feedback FOR DELETE TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

-- Order payments - create
DROP POLICY IF EXISTS "Staff can create payments" ON order_payments;
CREATE POLICY "Staff can create payments"
  ON order_payments FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_staff_role() IN ('waiter', 'admin', 'owner')
    AND received_by = public.get_my_staff_id()
  );

-- Order payments - view
DROP POLICY IF EXISTS "Staff can view all payments" ON order_payments;
CREATE POLICY "Staff can view all payments"
  ON order_payments FOR SELECT TO authenticated
  USING (public.get_my_staff_role() IN ('waiter', 'admin', 'kitchen', 'owner'));

-- Order payments - delete
DROP POLICY IF EXISTS "Admins can delete payments" ON order_payments;
CREATE POLICY "Admins can delete payments"
  ON order_payments FOR DELETE TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

-- Table transfers - create
DROP POLICY IF EXISTS "Staff can log transfers" ON table_transfers;
CREATE POLICY "Staff can log transfers"
  ON table_transfers FOR INSERT TO authenticated
  WITH CHECK (public.get_my_staff_role() IN ('waiter', 'admin', 'owner'));

-- Table transfers - delete
DROP POLICY IF EXISTS "Admins can delete transfers" ON table_transfers;
CREATE POLICY "Admins can delete transfers"
  ON table_transfers FOR DELETE TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));
