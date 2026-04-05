-- ============================================================
-- Gustri - Complete Database Reset SQL
-- Run this in Supabase Dashboard > SQL Editor to set up
-- the database from scratch.
--
-- WARNING: This will DROP all existing tables and data!
-- ============================================================

-- ============================================================
-- STEP 0: Drop everything (clean slate)
-- ============================================================

-- Drop views first
DROP VIEW IF EXISTS order_payment_summary CASCADE;
DROP VIEW IF EXISTS active_orders_view CASCADE;
DROP VIEW IF EXISTS sales_summary_view CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS update_staff_notes_updated_at ON staff_notes;
DROP TRIGGER IF EXISTS update_staff_updated_at ON staff;
DROP TRIGGER IF EXISTS update_tables_updated_at ON tables;
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
DROP TRIGGER IF EXISTS update_menu_items_updated_at ON menu_items;
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
DROP TRIGGER IF EXISTS update_order_items_updated_at ON order_items;
DROP TRIGGER IF EXISTS set_order_number_trigger ON orders;
DROP TRIGGER IF EXISTS recalculate_on_item_insert ON order_items;
DROP TRIGGER IF EXISTS recalculate_on_item_update ON order_items;
DROP TRIGGER IF EXISTS recalculate_on_item_delete ON order_items;
DROP TRIGGER IF EXISTS update_table_on_order ON orders;
DROP TRIGGER IF EXISTS validate_payment_amount_trigger ON order_payments;
DROP TRIGGER IF EXISTS update_order_payment_status_trigger ON order_payments;
DROP TRIGGER IF EXISTS validate_items_payment_trigger ON order_payments;
DROP TRIGGER IF EXISTS auto_acknowledge_feedback_trigger ON customer_feedback;
DROP TRIGGER IF EXISTS check_single_cafe_settings ON cafe_settings;
DROP TRIGGER IF EXISTS update_cafe_settings_timestamp ON cafe_settings;
DROP TRIGGER IF EXISTS update_stock_items_updated_at ON stock_items;
DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS generate_order_number() CASCADE;
DROP FUNCTION IF EXISTS set_order_number() CASCADE;
DROP FUNCTION IF EXISTS calculate_order_total(UUID) CASCADE;
DROP FUNCTION IF EXISTS recalculate_order_total() CASCADE;
DROP FUNCTION IF EXISTS update_table_status_on_order() CASCADE;
DROP FUNCTION IF EXISTS set_table_context(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_order_remaining_balance(UUID) CASCADE;
DROP FUNCTION IF EXISTS transfer_table(UUID, UUID, UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS validate_payment_amount() CASCADE;
DROP FUNCTION IF EXISTS update_order_payment_status() CASCADE;
DROP FUNCTION IF EXISTS validate_items_payment() CASCADE;
DROP FUNCTION IF EXISTS auto_acknowledge_feedback() CASCADE;
DROP FUNCTION IF EXISTS enforce_single_cafe_settings() CASCADE;

-- Drop tables (order matters due to foreign keys)
DROP TABLE IF EXISTS staff_notes CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS stock_items CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS expense_categories CASCADE;
DROP TABLE IF EXISTS staff_schedules CASCADE;
DROP TABLE IF EXISTS table_transfers CASCADE;
DROP TABLE IF EXISTS order_payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS waiter_calls CASCADE;
DROP TABLE IF EXISTS customer_feedback CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
DROP TABLE IF EXISTS cafe_settings CASCADE;
DROP TABLE IF EXISTS staff CASCADE;

-- ============================================================
-- STEP 1: Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- STEP 2: Core Tables
-- ============================================================

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

-- Tables (physical cafe tables)
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
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tables_status ON tables(status);
CREATE INDEX idx_tables_number ON tables(table_number);
CREATE INDEX idx_tables_qr ON tables(qr_code);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
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
  name VARCHAR(255) NOT NULL,
  description TEXT,
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
  table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
  assigned_waiter_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  order_number VARCHAR(15) UNIQUE NOT NULL,
  order_type VARCHAR(20) DEFAULT 'dine_in',
  status VARCHAR(20) NOT NULL DEFAULT 'new'
    CHECK (status IN ('pending_approval', 'new', 'preparing', 'ready', 'served', 'out_for_delivery', 'delivered', 'closed', 'cancelled')),
  source VARCHAR(20) NOT NULL DEFAULT 'waiter',
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tax DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  customer_notes TEXT,
  internal_notes TEXT,
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),
  -- Delivery fields
  delivery_address TEXT,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  delivery_notes TEXT,
  estimated_delivery_time TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  delivery_person_id UUID REFERENCES staff(id),
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  preparing_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  payment_method VARCHAR(20),
  paid_at TIMESTAMPTZ,
  -- Constraints
  CONSTRAINT orders_order_type_check CHECK (order_type IN ('dine_in', 'takeout', 'delivery')),
  CONSTRAINT orders_dine_in_table_check CHECK (
    (order_type = 'dine_in' AND table_id IS NOT NULL) OR
    (order_type = 'takeout' AND table_id IS NULL) OR
    (order_type = 'delivery' AND table_id IS NULL)
  ),
  CONSTRAINT orders_takeout_customer_check CHECK (
    (order_type = 'takeout' AND customer_name IS NOT NULL AND customer_phone IS NOT NULL) OR
    (order_type = 'delivery' AND customer_name IS NOT NULL AND customer_phone IS NOT NULL) OR
    (order_type = 'dine_in')
  )
);

CREATE INDEX idx_orders_table ON orders(table_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_waiter ON orders(assigned_waiter_id);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_type ON orders(order_type);
CREATE INDEX idx_orders_source ON orders(source);

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
CREATE INDEX IF NOT EXISTS idx_order_items_with_notes ON order_items(order_id) WHERE notes IS NOT NULL;

-- Waiter Calls
CREATE TABLE waiter_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  reason VARCHAR(50) DEFAULT 'assistance',
  call_type VARCHAR(50) DEFAULT 'assistance',
  priority VARCHAR(20) DEFAULT 'normal',
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

-- Customer Feedback
CREATE TABLE customer_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  feedback_type VARCHAR(50) NOT NULL CHECK (
    feedback_type IN ('complaint_food', 'complaint_service', 'complaint_staff', 'question_menu', 'request_general', 'praise')
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

-- Order Payments
CREATE TABLE order_payments (
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
  tip_amount DECIMAL(10, 2) DEFAULT 0,
  order_item_ids UUID[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_payments_order ON order_payments(order_id);
CREATE INDEX idx_order_payments_staff ON order_payments(received_by);
CREATE INDEX idx_order_payments_created ON order_payments(created_at DESC);

-- Table Transfers
CREATE TABLE table_transfers (
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

-- Cafe Settings
CREATE TABLE cafe_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Restaurant info
  restaurant_name VARCHAR(255) NOT NULL DEFAULT 'Gustri',
  restaurant_address TEXT,
  -- Tax settings
  tax_enabled BOOLEAN NOT NULL DEFAULT true,
  tax_percentage DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
  tax_label VARCHAR(50) NOT NULL DEFAULT 'Tax',
  prices_include_tax BOOLEAN NOT NULL DEFAULT false,
  show_tax_separately BOOLEAN NOT NULL DEFAULT true,
  -- Currency settings
  currency_symbol VARCHAR(10) NOT NULL DEFAULT 'AZN',
  currency_code VARCHAR(3) NOT NULL DEFAULT 'AZN',
  currency_position VARCHAR(10) NOT NULL DEFAULT 'after' CHECK (currency_position IN ('before', 'after')),
  currency_decimal_places INTEGER NOT NULL DEFAULT 2,
  -- Order settings
  minimum_order_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  allow_item_notes BOOLEAN NOT NULL DEFAULT true,
  allow_order_notes BOOLEAN NOT NULL DEFAULT true,
  -- Branding
  cafe_logo_url TEXT,
  hero_image_url TEXT,
  brand_primary_color VARCHAR(7) DEFAULT '#3B82F6',
  brand_secondary_color VARCHAR(7) DEFAULT '#1E40AF',
  welcome_heading VARCHAR(255),
  welcome_message TEXT,
  qr_ordering_enabled BOOLEAN NOT NULL DEFAULT true,
  contact_phone VARCHAR(20),
  contact_website TEXT,
  social_instagram TEXT,
  social_whatsapp TEXT,
  social_tiktok TEXT,
  social_telegram TEXT,
  social_line TEXT,
  location_maps_url TEXT,
  -- Language
  default_language VARCHAR(5) DEFAULT 'en',
  -- Tips
  tips_enabled BOOLEAN DEFAULT false,
  -- Delivery settings
  delivery_enabled BOOLEAN DEFAULT false,
  delivery_fee_default DECIMAL(10,2) DEFAULT 0,
  minimum_delivery_amount DECIMAL(10,2) DEFAULT 0,
  delivery_zone_info TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO cafe_settings (id) VALUES ('00000000-0000-0000-0000-000000000001');

-- Stock Items
CREATE TABLE stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  category VARCHAR NOT NULL DEFAULT 'General',
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit VARCHAR NOT NULL DEFAULT 'pieces',
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  minimum_stock_level NUMERIC(12,2) NOT NULL DEFAULT 0,
  supplier_name VARCHAR,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_items_category ON stock_items(category);
CREATE INDEX idx_stock_items_is_active ON stock_items(is_active);

-- Stock Movements (audit trail)
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  movement_type VARCHAR NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  quantity_change NUMERIC(12,2) NOT NULL,
  quantity_after NUMERIC(12,2) NOT NULL,
  reason TEXT,
  performed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movements_stock_item_id ON stock_movements(stock_item_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);

-- Expense Categories
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  icon VARCHAR,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  payment_method VARCHAR NOT NULL CHECK (payment_method IN ('cash', 'card', 'digital', 'bank_transfer')),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_category_id ON expenses(category_id);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX idx_expenses_created_by ON expenses(created_by);

-- Staff Schedules
CREATE TABLE staff_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  date DATE NOT NULL,
  planned_start TIME NOT NULL,
  planned_end TIME NOT NULL,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'missed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_staff_schedules_unique ON staff_schedules(staff_id, date, planned_start);

-- ============================================================
-- STEP 3: Functions & Triggers
-- ============================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
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
CREATE TRIGGER update_stock_items_updated_at BEFORE UPDATE ON stock_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cafe_settings_timestamp BEFORE UPDATE ON cafe_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Generate order number
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

-- Function: Calculate order total (uses cafe_settings tax)
CREATE OR REPLACE FUNCTION calculate_order_total(order_uuid UUID)
RETURNS VOID
SECURITY DEFINER AS $$
DECLARE
  calculated_subtotal DECIMAL(10, 2);
  calculated_tax DECIMAL(10, 2);
  calculated_total DECIMAL(10, 2);
  settings_tax_enabled BOOLEAN;
  settings_tax_percentage DECIMAL(5, 2);
BEGIN
  SELECT tax_enabled, tax_percentage
  INTO settings_tax_enabled, settings_tax_percentage
  FROM cafe_settings
  LIMIT 1;

  SELECT COALESCE(SUM(item_price * quantity), 0)
  INTO calculated_subtotal
  FROM order_items
  WHERE order_id = order_uuid;

  IF settings_tax_enabled = true AND settings_tax_percentage > 0 THEN
    calculated_tax := calculated_subtotal * (settings_tax_percentage / 100);
  ELSE
    calculated_tax := 0;
  END IF;

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
RETURNS TRIGGER
SECURITY DEFINER AS $$
BEGIN
  PERFORM calculate_order_total(COALESCE(NEW.order_id, OLD.order_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalculate_on_item_insert
  AFTER INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION recalculate_order_total();
CREATE TRIGGER recalculate_on_item_update
  AFTER UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION recalculate_order_total();
CREATE TRIGGER recalculate_on_item_delete
  AFTER DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION recalculate_order_total();

-- Function: Update table status on order changes
CREATE OR REPLACE FUNCTION update_table_status_on_order()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.table_id IS NOT NULL THEN
      UPDATE tables
      SET
        status = 'occupied',
        occupied_at = NOW(),
        current_session_id = NEW.id
      WHERE id = NEW.table_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'closed' AND OLD.status != 'closed' THEN
    IF NEW.table_id IS NOT NULL THEN
      UPDATE tables
      SET
        status = 'free',
        current_session_id = NULL
      WHERE id = NEW.table_id;
    END IF;
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

-- Function: Get order remaining balance
CREATE OR REPLACE FUNCTION get_order_remaining_balance(order_uuid UUID)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  order_total DECIMAL(10, 2);
  paid_amount DECIMAL(10, 2);
BEGIN
  SELECT total INTO order_total FROM orders WHERE id = order_uuid;
  IF order_total IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', order_uuid;
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO paid_amount
  FROM order_payments WHERE order_id = order_uuid;
  RETURN order_total - paid_amount;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Transfer table
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
  SELECT status INTO v_order_status
  FROM orders WHERE id = p_order_id AND table_id = p_from_table_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % does not belong to table %', p_order_id, p_from_table_id;
  END IF;
  IF v_order_status = 'closed' OR v_order_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot transfer closed or cancelled order';
  END IF;
  IF EXISTS (SELECT 1 FROM tables WHERE id = p_to_table_id AND status NOT IN ('free', 'reserved')) THEN
    RAISE EXCEPTION 'Target table is not available';
  END IF;
  UPDATE orders SET table_id = p_to_table_id, updated_at = NOW() WHERE id = p_order_id;
  UPDATE tables SET status = 'free', current_session_id = NULL, updated_at = NOW() WHERE id = p_from_table_id;
  UPDATE tables SET status = 'occupied', current_session_id = p_order_id, occupied_at = NOW(), updated_at = NOW() WHERE id = p_to_table_id;
  INSERT INTO table_transfers (order_id, from_table_id, to_table_id, transferred_by, reason)
  VALUES (p_order_id, p_from_table_id, p_to_table_id, p_staff_id, p_reason);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function: Validate payment amount
CREATE OR REPLACE FUNCTION validate_payment_amount()
RETURNS TRIGGER AS $$
DECLARE
  remaining_balance DECIMAL(10, 2);
BEGIN
  remaining_balance := get_order_remaining_balance(NEW.order_id);
  IF NEW.amount > remaining_balance THEN
    RAISE EXCEPTION 'Payment amount (%) exceeds remaining balance (%)', NEW.amount, remaining_balance;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_payment_amount_trigger
  BEFORE INSERT ON order_payments FOR EACH ROW EXECUTE FUNCTION validate_payment_amount();

-- Function: Update order payment status (auto-close when fully paid)
CREATE OR REPLACE FUNCTION update_order_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  remaining DECIMAL(10, 2);
  total_paid DECIMAL(10, 2);
  order_table_id UUID;
  other_active_orders INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM order_payments WHERE order_id = NEW.order_id;
  remaining := get_order_remaining_balance(NEW.order_id);
  IF remaining <= 0 THEN
    SELECT table_id INTO order_table_id FROM orders WHERE id = NEW.order_id;
    UPDATE orders SET status = 'closed', paid_at = NOW(), closed_at = NOW(), payment_method = 'split', updated_at = NOW()
    WHERE id = NEW.order_id;
    IF order_table_id IS NOT NULL THEN
      SELECT COUNT(*) INTO other_active_orders FROM orders
      WHERE table_id = order_table_id AND id != NEW.order_id
        AND status IN ('pending_approval', 'new', 'preparing', 'ready', 'served');
      IF other_active_orders = 0 THEN
        UPDATE tables SET status = 'free', current_session_id = NULL, occupied_at = NULL, updated_at = NOW()
        WHERE id = order_table_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_order_payment_status_trigger
  AFTER INSERT ON order_payments FOR EACH ROW EXECUTE FUNCTION update_order_payment_status();

-- Function: Validate specific items payment
CREATE OR REPLACE FUNCTION validate_items_payment()
RETURNS TRIGGER AS $$
DECLARE
  calculated_amount DECIMAL(10, 2);
BEGIN
  IF NEW.payment_type = 'specific_items' THEN
    IF NEW.order_item_ids IS NULL OR array_length(NEW.order_item_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'order_item_ids must be provided for specific_items payment';
    END IF;
    SELECT COALESCE(SUM(item_price * quantity), 0) INTO calculated_amount
    FROM order_items WHERE id = ANY(NEW.order_item_ids) AND order_id = NEW.order_id;
    IF NEW.amount != calculated_amount THEN
      RAISE EXCEPTION 'Payment amount (%) does not match items total (%)', NEW.amount, calculated_amount;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_items_payment_trigger
  BEFORE INSERT ON order_payments FOR EACH ROW EXECUTE FUNCTION validate_items_payment();

-- Function: Auto-acknowledge feedback
CREATE OR REPLACE FUNCTION auto_acknowledge_feedback()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'acknowledged' AND OLD.status = 'pending' THEN
    NEW.acknowledged_at := NOW();
  END IF;
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_acknowledge_feedback_trigger
  BEFORE UPDATE ON customer_feedback FOR EACH ROW EXECUTE FUNCTION auto_acknowledge_feedback();

-- Function: Enforce single cafe settings row
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

-- ============================================================
-- STEP 4: Views
-- ============================================================

CREATE OR REPLACE VIEW active_orders_view AS
SELECT
  o.id, o.order_number, o.status, o.created_at, o.updated_at,
  t.table_number, t.location,
  s.full_name AS waiter_name,
  COUNT(oi.id) AS item_count,
  SUM(oi.quantity) AS total_quantity,
  o.total,
  EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60 AS minutes_elapsed,
  json_agg(
    json_build_object('item_name', oi.item_name, 'quantity', oi.quantity, 'notes', oi.notes, 'status', oi.status)
    ORDER BY oi.created_at
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

CREATE OR REPLACE VIEW sales_summary_view AS
SELECT
  DATE(created_at) AS date,
  COUNT(DISTINCT id) AS order_count,
  SUM(total) AS total_revenue,
  AVG(total) AS average_order_value,
  COUNT(DISTINCT table_id) AS tables_served,
  AVG(EXTRACT(EPOCH FROM (served_at - created_at)) / 60) AS avg_service_time_minutes
FROM orders
WHERE status = 'closed' AND closed_at IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;

GRANT SELECT ON sales_summary_view TO authenticated;

CREATE OR REPLACE VIEW order_payment_summary AS
SELECT
  o.id AS order_id, o.order_number, o.total AS order_total,
  COALESCE(SUM(op.amount), 0) AS paid_amount,
  o.total - COALESCE(SUM(op.amount), 0) AS remaining_balance,
  COUNT(op.id) AS payment_count,
  json_agg(
    json_build_object('payment_id', op.id, 'amount', op.amount, 'payment_method', op.payment_method, 'received_by', s.full_name, 'created_at', op.created_at)
    ORDER BY op.created_at
  ) FILTER (WHERE op.id IS NOT NULL) AS payments
FROM orders o
LEFT JOIN order_payments op ON o.id = op.order_id
LEFT JOIN staff s ON op.received_by = s.id
GROUP BY o.id, o.order_number, o.total;

GRANT SELECT ON order_payment_summary TO authenticated;

-- ============================================================
-- STEP 5: Disable RLS for Development
-- ============================================================

ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_calls DISABLE ROW LEVEL SECURITY;
ALTER TABLE customer_feedback DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE table_transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE cafe_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedules DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 6: Enable Realtime
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE waiter_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE order_payments;

ALTER TABLE waiter_calls REPLICA IDENTITY FULL;
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE order_items REPLICA IDENTITY FULL;
ALTER TABLE order_payments REPLICA IDENTITY FULL;

-- ============================================================
-- STEP 7: Grant Function Permissions
-- ============================================================

GRANT EXECUTE ON FUNCTION transfer_table TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_remaining_balance TO authenticated, anon;

-- ============================================================
-- STEP 8: Seed Default Expense Categories
-- ============================================================

INSERT INTO expense_categories (name, description, icon) VALUES
  ('Rent', 'Monthly rent and lease payments', 'Building2'),
  ('Utilities', 'Electricity, water, gas, internet', 'Zap'),
  ('Salaries', 'Staff wages and benefits', 'Users'),
  ('Supplies', 'Kitchen and cleaning supplies', 'ShoppingCart'),
  ('Maintenance', 'Equipment repairs and maintenance', 'Wrench'),
  ('Marketing', 'Advertising and promotions', 'Megaphone'),
  ('Other', 'Miscellaneous expenses', 'MoreHorizontal');

-- ============================================================
-- STEP 9: Create Storage Bucket for Branding
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public read access for branding') THEN
        CREATE POLICY "Public read access for branding" ON storage.objects FOR SELECT USING (bucket_id = 'branding');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload branding') THEN
        CREATE POLICY "Authenticated users can upload branding" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'branding' AND auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can update branding') THEN
        CREATE POLICY "Authenticated users can update branding" ON storage.objects FOR UPDATE USING (bucket_id = 'branding' AND auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can delete branding') THEN
        CREATE POLICY "Authenticated users can delete branding" ON storage.objects FOR DELETE USING (bucket_id = 'branding' AND auth.role() = 'authenticated');
    END IF;
END $$;

-- ============================================================
-- DONE! Database is ready.
-- Next step: Create an admin user via Supabase Auth,
-- then insert a staff record linking to that auth user.
-- ============================================================
