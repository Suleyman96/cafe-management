-- Enable Row Level Security on all tables
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_calls ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STAFF POLICIES
-- ========================================

-- Staff can view all staff
CREATE POLICY "Staff can view all staff"
  ON staff FOR SELECT
  TO authenticated
  USING (true);

-- Admins can manage staff
CREATE POLICY "Admins can manage staff"
  ON staff FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- ========================================
-- TABLES POLICIES
-- ========================================

-- Anyone can view active tables
CREATE POLICY "Anyone can view active tables"
  ON tables FOR SELECT
  USING (is_active = true);

-- Staff can update tables
CREATE POLICY "Staff can update tables"
  ON tables FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin')
    )
  );

-- ========================================
-- CATEGORIES POLICIES
-- ========================================

-- Anyone can view active categories
CREATE POLICY "Anyone can view active categories"
  ON categories FOR SELECT
  USING (is_active = true);

-- Admins can manage categories
CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- ========================================
-- MENU ITEMS POLICIES
-- ========================================

-- Anyone can view available menu items
CREATE POLICY "Anyone can view available menu items"
  ON menu_items FOR SELECT
  USING (is_available = true);

-- Admins can manage menu items
CREATE POLICY "Admins can manage menu items"
  ON menu_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- ========================================
-- ORDERS POLICIES
-- ========================================

-- Customers can view their table's orders
CREATE POLICY "Customers can view their table orders"
  ON orders FOR SELECT
  USING (
    table_id IN (
      SELECT id FROM tables WHERE qr_code = current_setting('app.qr_token', true)
    )
  );

-- Customers can create orders for their table
CREATE POLICY "Customers can create orders for their table"
  ON orders FOR INSERT
  WITH CHECK (
    table_id IN (
      SELECT id FROM tables WHERE qr_code = current_setting('app.qr_token', true)
    )
    AND status = 'new'
  );

-- Staff can view all orders
CREATE POLICY "Staff can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (true);

-- Staff can update orders
CREATE POLICY "Staff can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin')
    )
  );

-- Admins can delete orders
CREATE POLICY "Admins can delete orders"
  ON orders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- ========================================
-- ORDER ITEMS POLICIES
-- ========================================

-- Customers can view their order items
CREATE POLICY "Customers can view their order items"
  ON order_items FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE table_id IN (
        SELECT id FROM tables WHERE qr_code = current_setting('app.qr_token', true)
      )
    )
  );

-- Customers can add items to new orders only
CREATE POLICY "Customers can add items to new orders"
  ON order_items FOR INSERT
  WITH CHECK (
    order_id IN (
      SELECT id FROM orders
      WHERE table_id IN (
        SELECT id FROM tables WHERE qr_code = current_setting('app.qr_token', true)
      )
      AND status = 'new'
    )
  );

-- Staff can view all order items
CREATE POLICY "Staff can view all order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (true);

-- Staff can update order items
CREATE POLICY "Staff can update order items"
  ON order_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin', 'kitchen')
    )
  );

-- ========================================
-- WAITER CALLS POLICIES
-- ========================================

-- Customers can create waiter calls
CREATE POLICY "Customers can create waiter calls"
  ON waiter_calls FOR INSERT
  WITH CHECK (
    table_id IN (
      SELECT id FROM tables WHERE qr_code = current_setting('app.qr_token', true)
    )
  );

-- Customers can view their waiter calls
CREATE POLICY "Customers can view their waiter calls"
  ON waiter_calls FOR SELECT
  USING (
    table_id IN (
      SELECT id FROM tables WHERE qr_code = current_setting('app.qr_token', true)
    )
  );

-- Staff can view all waiter calls
CREATE POLICY "Staff can view all waiter calls"
  ON waiter_calls FOR SELECT
  TO authenticated
  USING (true);

-- Staff can update waiter calls
CREATE POLICY "Staff can update waiter calls"
  ON waiter_calls FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin')
    )
  );


