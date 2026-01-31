-- ============================================================================
-- COMBINED MIGRATION FILE FOR CAFE IDARE
-- Generated from all migration files in order
-- ============================================================================


-- ============================================================================
-- Migration: 20250101000001_initial_schema.sql
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Staff table (linked to auth.users)
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('waiter', 'admin', 'kitchen')),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_staff_role ON staff(role);
CREATE INDEX idx_staff_active ON staff(is_active);
CREATE INDEX idx_staff_auth_user ON staff(auth_user_id);

-- Tables (physical café tables)
CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_number VARCHAR(10) UNIQUE NOT NULL,
  qr_code TEXT UNIQUE NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  status VARCHAR(20) NOT NULL DEFAULT 'free'
    CHECK (status IN ('free', 'occupied', 'reserved', 'closed')),
  location VARCHAR(100),
  current_session_id UUID,
  occupied_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tables_status ON tables(status);
CREATE INDEX idx_tables_number ON tables(table_number);
CREATE INDEX idx_tables_qr ON tables(qr_code);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_en VARCHAR(100) NOT NULL,
  name_az VARCHAR(100),
  name_ru VARCHAR(100),
  name_tr VARCHAR(100),
  description_en TEXT,
  description_az TEXT,
  description_ru TEXT,
  description_tr TEXT,
  icon VARCHAR(50),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_order ON categories(display_order);
CREATE INDEX idx_categories_active ON categories(is_active);

-- Menu Items
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name_en VARCHAR(255) NOT NULL,
  name_az VARCHAR(255),
  name_ru VARCHAR(255),
  name_tr VARCHAR(255),
  description_en TEXT,
  description_az TEXT,
  description_ru TEXT,
  description_tr TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  preparation_time INTEGER,
  is_popular BOOLEAN DEFAULT false,
  is_vegetarian BOOLEAN DEFAULT false,
  is_vegan BOOLEAN DEFAULT false,
  is_gluten_free BOOLEAN DEFAULT false,
  is_spicy BOOLEAN DEFAULT false,
  allergens TEXT[],
  is_available BOOLEAN DEFAULT true,
  is_daily_special BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_available ON menu_items(is_available);
CREATE INDEX idx_menu_items_popular ON menu_items(is_popular);
CREATE INDEX idx_menu_items_order ON menu_items(display_order);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  assigned_waiter_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  order_number VARCHAR(10) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'preparing', 'ready', 'served', 'closed', 'cancelled')),
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tax DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  customer_notes TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  preparing_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  payment_method VARCHAR(20),
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_table ON orders(table_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_waiter ON orders(assigned_waiter_id);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_number ON orders(order_number);

-- Order Items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  item_name VARCHAR(255) NOT NULL,
  item_price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'preparing', 'ready', 'served')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_menu ON order_items(menu_item_id);
CREATE INDEX idx_order_items_status ON order_items(status);

-- Waiter Calls
CREATE TABLE waiter_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  reason VARCHAR(50) DEFAULT 'assistance',
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'acknowledged', 'resolved')),
  responded_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX idx_waiter_calls_table ON waiter_calls(table_id);
CREATE INDEX idx_waiter_calls_status ON waiter_calls(status);
CREATE INDEX idx_waiter_calls_created ON waiter_calls(created_at DESC);


-- ============================================================================
-- Migration: 20250101000002_functions_triggers.sql
-- ============================================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR(10) AS $$
DECLARE
  new_number VARCHAR(10);
  counter INTEGER;
BEGIN
  SELECT COUNT(*) INTO counter
  FROM orders
  WHERE DATE(created_at) = CURRENT_DATE;

  new_number := 'ORD' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || LPAD((counter + 1)::TEXT, 3, '0');

  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function: Set order number on insert
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Function: Calculate order total
CREATE OR REPLACE FUNCTION calculate_order_total(order_uuid UUID)
RETURNS VOID AS $$
DECLARE
  calculated_subtotal DECIMAL(10, 2);
  calculated_tax DECIMAL(10, 2);
  calculated_total DECIMAL(10, 2);
  tax_rate DECIMAL(5, 4) := 0.18; -- 18% tax
BEGIN
  SELECT COALESCE(SUM(item_price * quantity), 0)
  INTO calculated_subtotal
  FROM order_items
  WHERE order_id = order_uuid;

  calculated_tax := calculated_subtotal * tax_rate;
  calculated_total := calculated_subtotal + calculated_tax;

  UPDATE orders
  SET
    subtotal = calculated_subtotal,
    tax = calculated_tax,
    total = calculated_total,
    updated_at = NOW()
  WHERE id = order_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function: Recalculate order total on item changes
CREATE OR REPLACE FUNCTION recalculate_order_total()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_order_total(COALESCE(NEW.order_id, OLD.order_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalculate_on_item_insert
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_order_total();

CREATE TRIGGER recalculate_on_item_update
  AFTER UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_order_total();

CREATE TRIGGER recalculate_on_item_delete
  AFTER DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_order_total();

-- Function: Update table status on order changes
CREATE OR REPLACE FUNCTION update_table_status_on_order()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tables
    SET
      status = 'occupied',
      occupied_at = NOW(),
      current_session_id = NEW.id
    WHERE id = NEW.table_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'closed' AND OLD.status != 'closed' THEN
    UPDATE tables
    SET
      status = 'free',
      current_session_id = NULL
    WHERE id = NEW.table_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_table_on_order
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_table_status_on_order();

-- Function: Set table context for customers (RLS)
CREATE OR REPLACE FUNCTION set_table_context(qr_token TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.qr_token', qr_token, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- Migration: 20250101000003_rls_policies.sql
-- ============================================================================

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


-- ============================================================================
-- Migration: 20250101000004_views.sql
-- ============================================================================

-- Active Orders View (for kitchen and waiter)
CREATE OR REPLACE VIEW active_orders_view AS
SELECT
  o.id,
  o.order_number,
  o.status,
  o.created_at,
  o.updated_at,
  t.table_number,
  t.location,
  s.full_name AS waiter_name,
  COUNT(oi.id) AS item_count,
  SUM(oi.quantity) AS total_quantity,
  o.total,
  EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60 AS minutes_elapsed,
  json_agg(
    json_build_object(
      'item_name', oi.item_name,
      'quantity', oi.quantity,
      'notes', oi.notes,
      'status', oi.status
    ) ORDER BY oi.created_at
  ) AS items
FROM orders o
JOIN tables t ON o.table_id = t.id
LEFT JOIN staff s ON o.assigned_waiter_id = s.id
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.status IN ('new', 'preparing', 'ready')
GROUP BY o.id, t.id, s.id
ORDER BY o.created_at ASC;

-- Grant access to authenticated users
GRANT SELECT ON active_orders_view TO authenticated;
GRANT SELECT ON active_orders_view TO anon;

-- Sales Summary View
CREATE OR REPLACE VIEW sales_summary_view AS
SELECT
  DATE(created_at) AS date,
  COUNT(DISTINCT id) AS order_count,
  SUM(total) AS total_revenue,
  AVG(total) AS average_order_value,
  COUNT(DISTINCT table_id) AS tables_served,
  AVG(EXTRACT(EPOCH FROM (served_at - created_at)) / 60) AS avg_service_time_minutes
FROM orders
WHERE status = 'closed'
  AND closed_at IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Only admins can view sales summary
GRANT SELECT ON sales_summary_view TO authenticated;


-- ============================================================================
-- Migration: 20250101000005_fix_staff_rls_recursion.sql
-- ============================================================================

-- Fix infinite recursion in staff RLS policies
-- The issue: policies that check staff table while querying staff table

-- Drop the problematic policies
DROP POLICY IF EXISTS "Staff can view all staff" ON staff;
DROP POLICY IF EXISTS "Admins can manage staff" ON staff;

-- New approach: Allow users to read their own staff record first
-- This breaks the recursion because they can check their own role
CREATE POLICY "Users can view their own staff record"
  ON staff FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Then allow staff to view all staff (this works because they can already see their own)
CREATE POLICY "Staff can view all staff"
  ON staff FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.auth_user_id = auth.uid()
      AND s.is_active = true
    )
  );

-- Admins can manage staff (now this works because they can read their own record first)
CREATE POLICY "Admins can manage staff"
  ON staff FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.auth_user_id = auth.uid()
      AND s.role = 'admin'
      AND s.is_active = true
    )
  );


-- ============================================================================
-- Migration: 20250101000006_allow_staff_menu_access.sql
-- ============================================================================

-- Allow staff to view all menu items and categories for management
-- (Not just available/active ones)

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view available menu items" ON menu_items;
DROP POLICY IF EXISTS "Admins can manage menu items" ON menu_items;
DROP POLICY IF EXISTS "Anyone can view active categories" ON categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;

-- Allow anyone to view all menu items (for staff management)
CREATE POLICY "Anyone can view all menu items"
  ON menu_items FOR SELECT
  USING (true);

-- Allow anyone to manage menu items (for development - no auth required)
CREATE POLICY "Anyone can manage menu items"
  ON menu_items FOR ALL
  USING (true);

-- Allow anyone to view all categories (for staff management)
CREATE POLICY "Anyone can view all categories"
  ON categories FOR SELECT
  USING (true);

-- Allow anyone to manage categories (for development - no auth required)
CREATE POLICY "Anyone can manage categories"
  ON categories FOR ALL
  USING (true);


-- ============================================================================
-- Migration: 20250101000007_fix_categories_rls.sql
-- ============================================================================

-- Fix RLS policies for categories to avoid recursion
-- The issue: policies check staff role, which creates recursion

-- Drop existing policies
DROP POLICY IF EXISTS "Staff can view categories" ON categories;
DROP POLICY IF EXISTS "Admin can manage categories" ON categories;
DROP POLICY IF EXISTS "Public can view active categories" ON categories;

-- Allow everyone to SELECT categories (staff will be checked at app level if needed)
-- This avoids the recursion issue
CREATE POLICY "Anyone can view categories"
  ON categories
  FOR SELECT
  USING (true);

-- For INSERT/UPDATE/DELETE, just check if user is authenticated
-- The app-level logic will handle role-based permissions
CREATE POLICY "Authenticated users can manage categories"
  ON categories
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Alternative: If you want to keep role checking, use a simpler approach
-- that doesn't query the staff table recursively
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON categories;

CREATE POLICY "Authenticated users can insert categories"
  ON categories
  FOR INSERT
  WITH CHECK (
    -- Just check if user exists in auth.users, don't check staff table
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Authenticated users can update categories"
  ON categories
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Authenticated users can delete categories"
  ON categories
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  );

-- Do the same for menu_items to prevent similar issues
DROP POLICY IF EXISTS "Staff can view menu items" ON menu_items;
DROP POLICY IF EXISTS "Admin can manage menu items" ON menu_items;
DROP POLICY IF EXISTS "Public can view available menu items" ON menu_items;

CREATE POLICY "Anyone can view menu items"
  ON menu_items
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert menu items"
  ON menu_items
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Authenticated users can update menu items"
  ON menu_items
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Authenticated users can delete menu items"
  ON menu_items
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  );


-- ============================================================================
-- Migration: 20250101000008_disable_rls_for_dev.sql
-- ============================================================================

-- Disable RLS for development (no auth required)
-- This allows the app to work without authentication

-- Drop all existing policies
DROP POLICY IF EXISTS "Staff can view categories" ON categories;
DROP POLICY IF EXISTS "Admin can manage categories" ON categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
DROP POLICY IF EXISTS "Public can view active categories" ON categories;
DROP POLICY IF EXISTS "Anyone can view active categories" ON categories;
DROP POLICY IF EXISTS "Anyone can view categories" ON categories;
DROP POLICY IF EXISTS "Anyone can view all categories" ON categories;
DROP POLICY IF EXISTS "Anyone can manage categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can insert categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON categories;

DROP POLICY IF EXISTS "Staff can view menu items" ON menu_items;
DROP POLICY IF EXISTS "Admin can manage menu items" ON menu_items;
DROP POLICY IF EXISTS "Admins can manage menu items" ON menu_items;
DROP POLICY IF EXISTS "Public can view available menu items" ON menu_items;
DROP POLICY IF EXISTS "Anyone can view available menu items" ON menu_items;
DROP POLICY IF EXISTS "Anyone can view menu items" ON menu_items;
DROP POLICY IF EXISTS "Anyone can view all menu items" ON menu_items;
DROP POLICY IF EXISTS "Anyone can manage menu items" ON menu_items;
DROP POLICY IF EXISTS "Authenticated users can insert menu items" ON menu_items;
DROP POLICY IF EXISTS "Authenticated users can update menu items" ON menu_items;
DROP POLICY IF EXISTS "Authenticated users can delete menu items" ON menu_items;

-- Disable RLS entirely for development
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items DISABLE ROW LEVEL SECURITY;

-- Also disable for customer_feedback if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'customer_feedback') THEN
        ALTER TABLE customer_feedback DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

COMMENT ON TABLE categories IS 'RLS disabled for development - enable in production';
COMMENT ON TABLE menu_items IS 'RLS disabled for development - enable in production';


-- ============================================================================
-- Migration: 20250101000009_disable_all_rls_for_dev.sql
-- ============================================================================

-- Disable RLS for all tables in development
-- This allows the app to work without authentication

-- Disable RLS on orders and related tables
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_calls DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;

-- Also disable on payment-related tables if they exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'order_payments') THEN
        ALTER TABLE order_payments DISABLE ROW LEVEL SECURITY;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'table_transfers') THEN
        ALTER TABLE table_transfers DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

COMMENT ON TABLE orders IS 'RLS disabled for development - enable in production';
COMMENT ON TABLE order_items IS 'RLS disabled for development - enable in production';
COMMENT ON TABLE tables IS 'RLS disabled for development - enable in production';
COMMENT ON TABLE waiter_calls IS 'RLS disabled for development - enable in production';


-- ============================================================================
-- Migration: 20250102000001_add_new_features.sql
-- ============================================================================

-- Migration: Add new features tables and columns
-- Date: 2025-01-02
-- Features: Split payments, table transfers, take-out orders, customer feedback

-- ========================================
-- 1. Enhance waiter_calls table
-- ========================================

ALTER TABLE waiter_calls
ADD COLUMN IF NOT EXISTS call_type VARCHAR(50) DEFAULT 'assistance',
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';

COMMENT ON COLUMN waiter_calls.call_type IS 'assistance, bill, complaint, question, emergency';
COMMENT ON COLUMN waiter_calls.priority IS 'low, normal, high, urgent';

-- ========================================
-- 2. Create customer_feedback table
-- ========================================

CREATE TABLE IF NOT EXISTS customer_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,

  feedback_type VARCHAR(50) NOT NULL CHECK (
    feedback_type IN (
      'complaint_food',
      'complaint_service',
      'complaint_staff',
      'question_menu',
      'request_general',
      'praise'
    )
  ),

  subject VARCHAR(255),
  message TEXT NOT NULL,

  status VARCHAR(20) DEFAULT 'pending' CHECK (
    status IN ('pending', 'acknowledged', 'resolved', 'dismissed')
  ),

  responded_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  response TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_customer_feedback_status ON customer_feedback(status);
CREATE INDEX idx_customer_feedback_table ON customer_feedback(table_id);
CREATE INDEX idx_customer_feedback_type ON customer_feedback(feedback_type);
CREATE INDEX idx_customer_feedback_created ON customer_feedback(created_at DESC);

COMMENT ON TABLE customer_feedback IS 'Customer complaints, questions, and general feedback';

-- ========================================
-- 3. Create order_payments table
-- ========================================

CREATE TABLE IF NOT EXISTS order_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  received_by UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,

  payment_type VARCHAR(20) NOT NULL CHECK (
    payment_type IN ('full', 'partial_amount', 'specific_items')
  ),

  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(20) NOT NULL CHECK (
    payment_method IN ('cash', 'card', 'digital')
  ),

  -- For item-specific payments (array of order_item IDs)
  order_item_ids UUID[],

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_payments_order ON order_payments(order_id);
CREATE INDEX idx_order_payments_staff ON order_payments(received_by);
CREATE INDEX idx_order_payments_created ON order_payments(created_at DESC);

COMMENT ON TABLE order_payments IS 'Track split payments received by different waiters';
COMMENT ON COLUMN order_payments.order_item_ids IS 'Array of order_item IDs when payment_type is specific_items';

-- ========================================
-- 4. Create table_transfers table
-- ========================================

CREATE TABLE IF NOT EXISTS table_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_table_id UUID NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
  to_table_id UUID NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
  transferred_by UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT different_tables CHECK (from_table_id != to_table_id)
);

CREATE INDEX idx_table_transfers_order ON table_transfers(order_id);
CREATE INDEX idx_table_transfers_from ON table_transfers(from_table_id);
CREATE INDEX idx_table_transfers_to ON table_transfers(to_table_id);
CREATE INDEX idx_table_transfers_created ON table_transfers(created_at DESC);

COMMENT ON TABLE table_transfers IS 'History of table transfers for orders';

-- ========================================
-- 5. Modify orders table for take-out
-- ========================================

-- Add order_type column
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'dine_in' CHECK (
  order_type IN ('dine_in', 'takeout')
);

-- Add customer info for takeout orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20);

-- Make table_id nullable (required for takeout orders)
ALTER TABLE orders ALTER COLUMN table_id DROP NOT NULL;

-- Add constraint: dine_in orders must have table_id
ALTER TABLE orders
ADD CONSTRAINT orders_dine_in_table_check
CHECK (
  (order_type = 'dine_in' AND table_id IS NOT NULL) OR
  (order_type = 'takeout' AND table_id IS NULL)
);

-- Add constraint: takeout orders must have customer info
ALTER TABLE orders
ADD CONSTRAINT orders_takeout_customer_check
CHECK (
  (order_type = 'takeout' AND customer_name IS NOT NULL AND customer_phone IS NOT NULL) OR
  (order_type = 'dine_in')
);

CREATE INDEX idx_orders_type ON orders(order_type);

COMMENT ON COLUMN orders.order_type IS 'dine_in or takeout';
COMMENT ON COLUMN orders.customer_name IS 'Required for takeout orders';
COMMENT ON COLUMN orders.customer_phone IS 'Required for takeout orders';

-- ========================================
-- 6. Add index for order_items notes
-- ========================================

CREATE INDEX IF NOT EXISTS idx_order_items_with_notes ON order_items(order_id)
WHERE notes IS NOT NULL;

COMMENT ON INDEX idx_order_items_with_notes IS 'Optimize queries for items with special notes';


-- ============================================================================
-- Migration: 20250102000002_payment_functions.sql
-- ============================================================================

-- Migration: Functions and triggers for payment and table transfer features
-- Date: 2025-01-02

-- ========================================
-- 1. Function: Get order remaining balance
-- ========================================

CREATE OR REPLACE FUNCTION get_order_remaining_balance(order_uuid UUID)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  order_total DECIMAL(10, 2);
  paid_amount DECIMAL(10, 2);
BEGIN
  -- Get order total
  SELECT total INTO order_total
  FROM orders
  WHERE id = order_uuid;

  IF order_total IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', order_uuid;
  END IF;

  -- Get sum of all payments for this order
  SELECT COALESCE(SUM(amount), 0) INTO paid_amount
  FROM order_payments
  WHERE order_id = order_uuid;

  RETURN order_total - paid_amount;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_order_remaining_balance IS 'Calculate remaining balance for an order after all payments';

-- ========================================
-- 2. Function: Transfer table
-- ========================================

CREATE OR REPLACE FUNCTION transfer_table(
  p_order_id UUID,
  p_from_table_id UUID,
  p_to_table_id UUID,
  p_staff_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_order_status VARCHAR(20);
BEGIN
  -- Verify order exists and belongs to from_table
  SELECT status INTO v_order_status
  FROM orders
  WHERE id = p_order_id AND table_id = p_from_table_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % does not belong to table %', p_order_id, p_from_table_id;
  END IF;

  -- Don't allow transfer if order is closed
  IF v_order_status = 'closed' OR v_order_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot transfer closed or cancelled order';
  END IF;

  -- Check if target table is free or reserved
  IF EXISTS (
    SELECT 1 FROM tables
    WHERE id = p_to_table_id
    AND status NOT IN ('free', 'reserved')
  ) THEN
    RAISE EXCEPTION 'Target table is not available';
  END IF;

  -- Update order table_id
  UPDATE orders
  SET
    table_id = p_to_table_id,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Update source table status (free it up)
  UPDATE tables
  SET
    status = 'free',
    current_session_id = NULL,
    updated_at = NOW()
  WHERE id = p_from_table_id;

  -- Update target table status (occupy it)
  UPDATE tables
  SET
    status = 'occupied',
    current_session_id = p_order_id,
    occupied_at = NOW(),
    updated_at = NOW()
  WHERE id = p_to_table_id;

  -- Log the transfer
  INSERT INTO table_transfers (
    order_id,
    from_table_id,
    to_table_id,
    transferred_by,
    reason
  ) VALUES (
    p_order_id,
    p_from_table_id,
    p_to_table_id,
    p_staff_id,
    p_reason
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION transfer_table IS 'Transfer an order from one table to another';

-- ========================================
-- 3. Function: Validate payment amount
-- ========================================

CREATE OR REPLACE FUNCTION validate_payment_amount()
RETURNS TRIGGER AS $$
DECLARE
  remaining_balance DECIMAL(10, 2);
BEGIN
  -- Get remaining balance before this payment
  remaining_balance := get_order_remaining_balance(NEW.order_id);

  -- Check if payment exceeds remaining balance
  IF NEW.amount > remaining_balance THEN
    RAISE EXCEPTION 'Payment amount (%) exceeds remaining balance (%)',
      NEW.amount, remaining_balance;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_payment_amount_trigger
  BEFORE INSERT ON order_payments
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_amount();

COMMENT ON FUNCTION validate_payment_amount IS 'Prevent overpayment on orders';

-- ========================================
-- 4. Function: Update order payment status
-- ========================================

CREATE OR REPLACE FUNCTION update_order_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  remaining DECIMAL(10, 2);
  total_paid DECIMAL(10, 2);
BEGIN
  -- Calculate total paid amount
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM order_payments
  WHERE order_id = NEW.order_id;

  -- Calculate remaining balance
  remaining := get_order_remaining_balance(NEW.order_id);

  -- If fully paid, update order
  IF remaining <= 0 THEN
    UPDATE orders
    SET
      paid_at = NOW(),
      payment_method = 'split',
      updated_at = NOW()
    WHERE id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_order_payment_status_trigger
  AFTER INSERT ON order_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_order_payment_status();

COMMENT ON FUNCTION update_order_payment_status IS 'Automatically mark order as paid when fully paid';

-- ========================================
-- 5. Function: Validate specific items payment
-- ========================================

CREATE OR REPLACE FUNCTION validate_items_payment()
RETURNS TRIGGER AS $$
DECLARE
  items_total DECIMAL(10, 2);
  calculated_amount DECIMAL(10, 2);
BEGIN
  -- Only validate if payment_type is 'specific_items'
  IF NEW.payment_type = 'specific_items' THEN

    -- Ensure order_item_ids is provided
    IF NEW.order_item_ids IS NULL OR array_length(NEW.order_item_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'order_item_ids must be provided for specific_items payment';
    END IF;

    -- Calculate total for specified items
    SELECT COALESCE(SUM(item_price * quantity), 0) INTO calculated_amount
    FROM order_items
    WHERE id = ANY(NEW.order_item_ids)
    AND order_id = NEW.order_id;

    -- Verify amount matches items total
    IF NEW.amount != calculated_amount THEN
      RAISE EXCEPTION 'Payment amount (%) does not match items total (%)',
        NEW.amount, calculated_amount;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_items_payment_trigger
  BEFORE INSERT ON order_payments
  FOR EACH ROW
  EXECUTE FUNCTION validate_items_payment();

COMMENT ON FUNCTION validate_items_payment IS 'Validate payment amount matches selected items total';

-- ========================================
-- 6. Function: Auto-acknowledge feedback
-- ========================================

CREATE OR REPLACE FUNCTION auto_acknowledge_feedback()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed to 'acknowledged', set timestamp
  IF NEW.status = 'acknowledged' AND OLD.status = 'pending' THEN
    NEW.acknowledged_at := NOW();
  END IF;

  -- If status changed to 'resolved', set timestamp
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_acknowledge_feedback_trigger
  BEFORE UPDATE ON customer_feedback
  FOR EACH ROW
  EXECUTE FUNCTION auto_acknowledge_feedback();

COMMENT ON FUNCTION auto_acknowledge_feedback IS 'Automatically set timestamps when feedback status changes';


-- ============================================================================
-- Migration: 20250102000003_rls_new_tables.sql
-- ============================================================================

-- Migration: Row Level Security policies for new tables
-- Date: 2025-01-02

-- ========================================
-- 1. RLS for customer_feedback table
-- ========================================

ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;

-- Customers can create feedback for their table
CREATE POLICY "Customers can create feedback for their table"
  ON customer_feedback FOR INSERT
  WITH CHECK (
    table_id IN (
      SELECT id FROM tables
      WHERE qr_code = current_setting('app.qr_token', true)
    )
  );

-- Customers can view their own feedback
CREATE POLICY "Customers can view their feedback"
  ON customer_feedback FOR SELECT
  USING (
    table_id IN (
      SELECT id FROM tables
      WHERE qr_code = current_setting('app.qr_token', true)
    )
  );

-- Staff can view all feedback
CREATE POLICY "Staff can view all feedback"
  ON customer_feedback FOR SELECT
  TO authenticated
  USING (true);

-- Staff can update feedback (acknowledge, respond, resolve)
CREATE POLICY "Staff can update feedback"
  ON customer_feedback FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin')
    )
  );

-- Only admins can delete feedback
CREATE POLICY "Admins can delete feedback"
  ON customer_feedback FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- ========================================
-- 2. RLS for order_payments table
-- ========================================

ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;

-- Only staff (waiters/admins) can create payments
CREATE POLICY "Staff can create payments"
  ON order_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin')
      AND id = received_by -- Must be receiving payment for themselves
    )
  );

-- Staff can view all payments
CREATE POLICY "Staff can view all payments"
  ON order_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin', 'kitchen')
    )
  );

-- Only admins can delete payments (for corrections)
CREATE POLICY "Admins can delete payments"
  ON order_payments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- ========================================
-- 3. RLS for table_transfers table
-- ========================================

ALTER TABLE table_transfers ENABLE ROW LEVEL SECURITY;

-- Staff can view all transfers
CREATE POLICY "Staff can view table transfers"
  ON table_transfers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
    )
  );

-- Only waiters and admins can create transfers (via function)
-- Note: Transfers should be done via transfer_table() function
CREATE POLICY "Staff can log transfers"
  ON table_transfers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin')
    )
  );

-- Only admins can delete transfer records
CREATE POLICY "Admins can delete transfers"
  ON table_transfers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- ========================================
-- 4. Update existing waiter_calls RLS
-- ========================================

-- Add policy for high-priority calls (emergency)
CREATE POLICY "High priority calls notify all staff"
  ON waiter_calls FOR SELECT
  TO authenticated
  USING (
    priority IN ('high', 'urgent') OR
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
    )
  );

-- ========================================
-- 5. Grant execute permissions on functions
-- ========================================

-- Allow authenticated users to call transfer_table function
GRANT EXECUTE ON FUNCTION transfer_table TO authenticated;

-- Allow anyone to call get_order_remaining_balance
GRANT EXECUTE ON FUNCTION get_order_remaining_balance TO authenticated, anon;

-- ========================================
-- 6. Create view for order payment summary
-- ========================================

CREATE OR REPLACE VIEW order_payment_summary AS
SELECT
  o.id AS order_id,
  o.order_number,
  o.total AS order_total,
  COALESCE(SUM(op.amount), 0) AS paid_amount,
  o.total - COALESCE(SUM(op.amount), 0) AS remaining_balance,
  COUNT(op.id) AS payment_count,
  json_agg(
    json_build_object(
      'payment_id', op.id,
      'amount', op.amount,
      'payment_method', op.payment_method,
      'received_by', s.full_name,
      'created_at', op.created_at
    ) ORDER BY op.created_at
  ) FILTER (WHERE op.id IS NOT NULL) AS payments
FROM orders o
LEFT JOIN order_payments op ON o.id = op.order_id
LEFT JOIN staff s ON op.received_by = s.id
GROUP BY o.id, o.order_number, o.total;

-- Grant access to view
GRANT SELECT ON order_payment_summary TO authenticated;

COMMENT ON VIEW order_payment_summary IS 'Summary of order payments with remaining balance';


-- ============================================================================
-- Migration: 20250102000004_fix_order_number_length.sql
-- ============================================================================

-- Fix order_number column length
-- The generate_order_number function creates 'ORD' + YYMMDD (6) + counter (3) = 12 chars
-- But column was only VARCHAR(10)

-- Drop dependent views
DROP VIEW IF EXISTS order_payment_summary;
DROP VIEW IF EXISTS active_orders_view;

-- Alter the column
ALTER TABLE orders ALTER COLUMN order_number TYPE VARCHAR(15);

-- Recreate active_orders_view
CREATE OR REPLACE VIEW active_orders_view AS
SELECT
  o.id,
  o.order_number,
  o.status,
  o.created_at,
  o.updated_at,
  t.table_number,
  t.location,
  s.full_name AS waiter_name,
  COUNT(oi.id) AS item_count,
  SUM(oi.quantity) AS total_quantity,
  o.total,
  EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60 AS minutes_elapsed,
  json_agg(
    json_build_object(
      'item_name', oi.item_name,
      'quantity', oi.quantity,
      'notes', oi.notes,
      'status', oi.status
    ) ORDER BY oi.created_at
  ) AS items
FROM orders o
JOIN tables t ON o.table_id = t.id
LEFT JOIN staff s ON o.assigned_waiter_id = s.id
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.status IN ('new', 'preparing', 'ready')
GROUP BY o.id, t.id, s.id
ORDER BY o.created_at ASC;

GRANT SELECT ON active_orders_view TO authenticated;
GRANT SELECT ON active_orders_view TO anon;

-- Recreate order_payment_summary view
CREATE OR REPLACE VIEW order_payment_summary AS
SELECT
  o.id AS order_id,
  o.order_number,
  o.total AS order_total,
  COALESCE(SUM(op.amount), 0) AS paid_amount,
  o.total - COALESCE(SUM(op.amount), 0) AS remaining_balance,
  COUNT(op.id) AS payment_count,
  json_agg(
    json_build_object(
      'payment_id', op.id,
      'amount', op.amount,
      'payment_method', op.payment_method,
      'received_by', s.full_name,
      'created_at', op.created_at
    ) ORDER BY op.created_at
  ) FILTER (WHERE op.id IS NOT NULL) AS payments
FROM orders o
LEFT JOIN order_payments op ON o.id = op.order_id
LEFT JOIN staff s ON op.received_by = s.id
GROUP BY o.id, o.order_number, o.total;

GRANT SELECT ON order_payment_summary TO authenticated;


-- ============================================================================
-- Migration: 20250102000005_fix_order_number_function.sql
-- ============================================================================

-- Fix generate_order_number function return type
-- The function generates 'ORD' + YYMMDD (6) + counter (3) = 12 chars
-- But was returning VARCHAR(10), causing insert failures

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR(15) AS $$
DECLARE
  new_number VARCHAR(15);
  counter INTEGER;
BEGIN
  SELECT COUNT(*) INTO counter
  FROM orders
  WHERE DATE(created_at) = CURRENT_DATE;

  new_number := 'ORD' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || LPAD((counter + 1)::TEXT, 3, '0');

  RETURN new_number;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- Migration: 20250102000006_auto_close_on_payment.sql
-- ============================================================================

-- Migration: Auto-close order and free table when fully paid
-- When an order is fully paid, automatically:
-- 1. Set order status to 'closed'
-- 2. Set closed_at timestamp
-- 3. Free the associated table

CREATE OR REPLACE FUNCTION update_order_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  remaining DECIMAL(10, 2);
  total_paid DECIMAL(10, 2);
  order_table_id UUID;
BEGIN
  -- Calculate total paid amount
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM order_payments
  WHERE order_id = NEW.order_id;

  -- Calculate remaining balance
  remaining := get_order_remaining_balance(NEW.order_id);

  -- If fully paid, update order and free table
  IF remaining <= 0 THEN
    -- Get the table_id for this order
    SELECT table_id INTO order_table_id
    FROM orders
    WHERE id = NEW.order_id;

    -- Update order to closed status
    UPDATE orders
    SET
      status = 'closed',
      paid_at = NOW(),
      closed_at = NOW(),
      payment_method = 'split',
      updated_at = NOW()
    WHERE id = NEW.order_id;

    -- Free the table if there was one
    IF order_table_id IS NOT NULL THEN
      UPDATE tables
      SET
        status = 'free',
        current_session_id = NULL,
        updated_at = NOW()
      WHERE id = order_table_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_order_payment_status IS 'Automatically close order and free table when fully paid';


-- ============================================================================
-- Migration: 20250103000001_add_notes_features.sql
-- ============================================================================

-- Migration: Add notes features
-- 1. Add notes column to tables
-- 2. Create staff_notes table for internal communication

-- Add notes column to tables
ALTER TABLE tables ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create staff_notes table
CREATE TABLE IF NOT EXISTS staff_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_staff_notes_created_at ON staff_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_notes_priority ON staff_notes(priority);
CREATE INDEX IF NOT EXISTS idx_staff_notes_is_pinned ON staff_notes(is_pinned);

-- Add trigger to update updated_at
CREATE TRIGGER update_staff_notes_updated_at
    BEFORE UPDATE ON staff_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Disable RLS for staff_notes (following dev pattern)
ALTER TABLE staff_notes DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE staff_notes IS 'Internal staff communication notes/memos';
COMMENT ON COLUMN staff_notes.priority IS 'Note priority: low, normal, high, urgent';
COMMENT ON COLUMN staff_notes.is_pinned IS 'Pinned notes appear at the top';
COMMENT ON COLUMN staff_notes.expires_at IS 'Optional expiration date for the note';
COMMENT ON COLUMN tables.notes IS 'Staff notes about the table or current customers';


-- ============================================================================
-- Migration: 20250117000001_disable_customer_feedback_rls.sql
-- ============================================================================

-- Disable RLS for customer_feedback table in development
-- This allows the customer-web app to submit feedback without QR token authentication

ALTER TABLE customer_feedback DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE customer_feedback IS 'RLS disabled for development - enable in production';

-- Also ensure staff_notes has RLS disabled if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_notes') THEN
        ALTER TABLE staff_notes DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;


-- ============================================================================
-- Migration: 20250120000001_add_cafe_settings.sql
-- ============================================================================

-- Cafe Settings table for storing configurable settings
-- This is a single-row table that stores all cafe configuration

CREATE TABLE cafe_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Restaurant info
  restaurant_name VARCHAR(255) NOT NULL DEFAULT 'Cafe Idare',

  -- Tax settings
  tax_enabled BOOLEAN NOT NULL DEFAULT true,
  tax_percentage DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
  tax_label VARCHAR(50) NOT NULL DEFAULT 'Tax',
  prices_include_tax BOOLEAN NOT NULL DEFAULT false,
  show_tax_separately BOOLEAN NOT NULL DEFAULT true,

  -- Currency settings
  currency_symbol VARCHAR(10) NOT NULL DEFAULT '₼',
  currency_code VARCHAR(3) NOT NULL DEFAULT 'AZN',
  currency_position VARCHAR(10) NOT NULL DEFAULT 'after' CHECK (currency_position IN ('before', 'after')),
  currency_decimal_places INTEGER NOT NULL DEFAULT 2,

  -- Order settings
  minimum_order_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  allow_item_notes BOOLEAN NOT NULL DEFAULT true,
  allow_order_notes BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO cafe_settings (id) VALUES ('00000000-0000-0000-0000-000000000001');

-- Ensure only one row exists
CREATE OR REPLACE FUNCTION enforce_single_cafe_settings()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM cafe_settings) > 0 THEN
    RAISE EXCEPTION 'Only one cafe_settings row is allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_single_cafe_settings
  BEFORE INSERT ON cafe_settings
  FOR EACH ROW
  WHEN (NEW.id != '00000000-0000-0000-0000-000000000001')
  EXECUTE FUNCTION enforce_single_cafe_settings();

-- Update timestamp trigger
CREATE TRIGGER update_cafe_settings_timestamp
  BEFORE UPDATE ON cafe_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Disable RLS for dev (consistent with other tables)
ALTER TABLE cafe_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read settings (needed for customer app)
CREATE POLICY "Anyone can read cafe settings"
  ON cafe_settings FOR SELECT
  USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update cafe settings"
  ON cafe_settings FOR UPDATE
  USING (true);


-- ============================================================================
-- Migration: 20250121000001_add_cafe_branding.sql
-- ============================================================================

-- Migration: Add cafe branding fields for white-label multi-tenant support
-- Includes: visual branding, welcome screen customization, social links, and feature controls

-- Add all branding fields to cafe_settings
ALTER TABLE cafe_settings
-- Visual branding
ADD COLUMN IF NOT EXISTS cafe_logo_url TEXT,
ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
ADD COLUMN IF NOT EXISTS brand_primary_color VARCHAR(7) DEFAULT '#3B82F6',
ADD COLUMN IF NOT EXISTS brand_secondary_color VARCHAR(7) DEFAULT '#1E40AF',
-- Welcome screen customization
ADD COLUMN IF NOT EXISTS welcome_heading VARCHAR(255),
ADD COLUMN IF NOT EXISTS welcome_message TEXT,
-- Feature controls
ADD COLUMN IF NOT EXISTS qr_ordering_enabled BOOLEAN NOT NULL DEFAULT true,
-- Contact & social links
ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS contact_website TEXT,
ADD COLUMN IF NOT EXISTS social_instagram TEXT,
ADD COLUMN IF NOT EXISTS social_whatsapp TEXT,
ADD COLUMN IF NOT EXISTS location_maps_url TEXT;

-- Create storage bucket for branding assets (logos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for public read access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects'
        AND policyname = 'Public read access for branding'
    ) THEN
        CREATE POLICY "Public read access for branding"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'branding');
    END IF;
END $$;

-- Storage policy for authenticated uploads
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects'
        AND policyname = 'Authenticated users can upload branding'
    ) THEN
        CREATE POLICY "Authenticated users can upload branding"
        ON storage.objects FOR INSERT
        WITH CHECK (bucket_id = 'branding' AND auth.role() = 'authenticated');
    END IF;
END $$;

-- Storage policy for authenticated updates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects'
        AND policyname = 'Authenticated users can update branding'
    ) THEN
        CREATE POLICY "Authenticated users can update branding"
        ON storage.objects FOR UPDATE
        USING (bucket_id = 'branding' AND auth.role() = 'authenticated');
    END IF;
END $$;

-- Storage policy for authenticated deletes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects'
        AND policyname = 'Authenticated users can delete branding'
    ) THEN
        CREATE POLICY "Authenticated users can delete branding"
        ON storage.objects FOR DELETE
        USING (bucket_id = 'branding' AND auth.role() = 'authenticated');
    END IF;
END $$;
