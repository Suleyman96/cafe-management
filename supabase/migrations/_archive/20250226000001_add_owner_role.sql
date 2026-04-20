-- Add 'owner' role to the staff table
-- Owner has all admin privileges plus exclusive access to reports

-- Update the role CHECK constraint
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN ('waiter', 'admin', 'kitchen', 'owner'));

-- Update RLS policies to include owner wherever admin is allowed

-- 1. Staff management (from fix_staff_rls_recursion migration)
DROP POLICY IF EXISTS "Admins can manage staff" ON staff;
CREATE POLICY "Admins can manage staff"
  ON staff FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.auth_user_id = auth.uid()
      AND s.role IN ('admin', 'owner')
      AND s.is_active = true
    )
  );

-- 2. Tables - update
DROP POLICY IF EXISTS "Staff can update tables" ON tables;
CREATE POLICY "Staff can update tables"
  ON tables FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin', 'owner')
    )
  );

-- 3. Categories - manage
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- 4. Menu items - manage
DROP POLICY IF EXISTS "Admins can manage menu items" ON menu_items;
CREATE POLICY "Admins can manage menu items"
  ON menu_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- 5. Orders - update
DROP POLICY IF EXISTS "Staff can update orders" ON orders;
CREATE POLICY "Staff can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin', 'owner')
    )
  );

-- 6. Orders - delete
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;
CREATE POLICY "Admins can delete orders"
  ON orders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- 7. Order items - update
DROP POLICY IF EXISTS "Staff can update order items" ON order_items;
CREATE POLICY "Staff can update order items"
  ON order_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin', 'kitchen', 'owner')
    )
  );

-- 8. Waiter calls - update
DROP POLICY IF EXISTS "Staff can update waiter calls" ON waiter_calls;
CREATE POLICY "Staff can update waiter calls"
  ON waiter_calls FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin', 'owner')
    )
  );

-- 9. Customer feedback - update
DROP POLICY IF EXISTS "Staff can update feedback" ON customer_feedback;
CREATE POLICY "Staff can update feedback"
  ON customer_feedback FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin', 'owner')
    )
  );

-- 10. Customer feedback - delete
DROP POLICY IF EXISTS "Admins can delete feedback" ON customer_feedback;
CREATE POLICY "Admins can delete feedback"
  ON customer_feedback FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- 11. Order payments - create
DROP POLICY IF EXISTS "Staff can create payments" ON order_payments;
CREATE POLICY "Staff can create payments"
  ON order_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin', 'owner')
      AND id = received_by
    )
  );

-- 12. Order payments - view
DROP POLICY IF EXISTS "Staff can view all payments" ON order_payments;
CREATE POLICY "Staff can view all payments"
  ON order_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin', 'kitchen', 'owner')
    )
  );

-- 13. Order payments - delete
DROP POLICY IF EXISTS "Admins can delete payments" ON order_payments;
CREATE POLICY "Admins can delete payments"
  ON order_payments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- 14. Table transfers - create
DROP POLICY IF EXISTS "Staff can log transfers" ON table_transfers;
CREATE POLICY "Staff can log transfers"
  ON table_transfers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin', 'owner')
    )
  );

-- 15. Table transfers - delete
DROP POLICY IF EXISTS "Admins can delete transfers" ON table_transfers;
CREATE POLICY "Admins can delete transfers"
  ON table_transfers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );
