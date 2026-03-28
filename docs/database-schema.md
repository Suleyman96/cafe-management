# Database Schema

## Overview

PostgreSQL database schema for Cafe Idare system with row-level security (RLS) enabled on all tables. Powered by Supabase (PostgreSQL 15).

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     tables      │──────<│     orders      │>──────│   order_items   │
│                 │ 1   * │                 │ 1   * │                 │
└───────┬─────────┘       └──┬──────┬───────┘       └────────┬────────┘
        │                    │      │                         │
        │ 1                  │      │ 1                       │ *
        │                    │      │                         │
        │ *                  │      │ *                       │ 1
┌───────▼─────────┐    ┌────▼───┐  │                  ┌──────▼────────┐
│  waiter_calls   │    │ staff  │  │                  │  menu_items   │
│                 │    │        │  │                  │               │
└─────────────────┘    └────┬───┘  │                  └──────┬────────┘
                            │      │                         │
┌─────────────────┐         │      │ *                       │ *
│customer_feedback│─────────┘  ┌───▼───────────┐             │ 1
│                 │            │order_payments  │      ┌──────▼────────┐
└─────────────────┘            └───────────────┘      │  categories   │
                                                      └───────────────┘
┌─────────────────┐       ┌─────────────────┐
│ table_transfers │──────>│     orders      │
│                 │       │   (via order_id) │
└─────────────────┘       └─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│ staff_schedules │──────>│     staff       │
│                 │ *   1 │                 │
└─────────────────┘       └─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│ cafe_settings   │       │  stock_items    │──────<┌─────────────────┐
│  (singleton)    │       │                 │ 1   * │ stock_movements │
└─────────────────┘       └─────────────────┘       └─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│expense_categories│─────<│    expenses     │
│                 │ 1   * │                 │
└─────────────────┘       └─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│  waste_logs     │       │task_categories  │──────<┌─────────────────┐
│                 │       │                 │ 1   * │     tasks       │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

## Tables

### 1. tables

Physical tables in the cafe.

```sql
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

-- RLS Policies
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active tables"
  ON tables FOR SELECT
  USING (is_active = true);

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
```

### 2. categories

Menu item categories.

```sql
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

-- RLS Policies
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active categories"
  ON categories FOR SELECT
  USING (is_active = true);

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
```

### 3. menu_items

Menu items available for ordering.

```sql
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

-- RLS Policies
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available menu items"
  ON menu_items FOR SELECT
  USING (is_available = true);

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
```

### 4. orders

Customer orders. `table_id` is nullable to support takeout/delivery orders.

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
  assigned_waiter_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  order_number VARCHAR(20) UNIQUE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'new'
    CHECK (status IN (
      'pending_approval', 'new', 'preparing', 'ready', 'served',
      'out_for_delivery', 'delivered', 'closed', 'cancelled'
    )),
  source VARCHAR(20) NOT NULL DEFAULT 'waiter'
    CHECK (source IN ('customer', 'waiter', 'phone')),
  order_type VARCHAR(20) NOT NULL DEFAULT 'dine_in'
    CHECK (order_type IN ('dine_in', 'takeout', 'delivery')),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(30),
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
  paid_at TIMESTAMPTZ,
  -- Delivery fields
  delivery_address TEXT,
  delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  delivery_notes TEXT,
  estimated_delivery_time TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  delivery_person_id UUID REFERENCES staff(id) ON DELETE SET NULL
);

CREATE INDEX idx_orders_table ON orders(table_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_waiter ON orders(assigned_waiter_id);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_number ON orders(order_number);

-- RLS Policies
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their table orders"
  ON orders FOR SELECT
  USING (
    table_id IN (
      SELECT id FROM tables WHERE qr_code = current_setting('app.qr_token', true)
    )
  );

CREATE POLICY "Customers can create orders for their table"
  ON orders FOR INSERT
  WITH CHECK (
    table_id IN (
      SELECT id FROM tables WHERE qr_code = current_setting('app.qr_token', true)
    )
  );

CREATE POLICY "Staff can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (true);

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
```

### 5. order_items

Individual items within an order.

```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  item_name VARCHAR(255) NOT NULL,
  item_price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'preparing', 'ready', 'served', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_menu ON order_items(menu_item_id);
CREATE INDEX idx_order_items_status ON order_items(status);

-- RLS Policies
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their order items"
  ON order_items FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE table_id IN (
        SELECT id FROM tables WHERE qr_code = current_setting('app.qr_token', true)
      )
    )
  );

CREATE POLICY "Customers can add items to their orders"
  ON order_items FOR INSERT
  WITH CHECK (
    order_id IN (
      SELECT id FROM orders
      WHERE table_id IN (
        SELECT id FROM tables WHERE qr_code = current_setting('app.qr_token', true)
      )
    )
  );

CREATE POLICY "Staff can view all order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (true);

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
```

### 6. waiter_calls

Customer requests for waiter assistance.

```sql
CREATE TABLE waiter_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  reason TEXT,
  call_type VARCHAR(20) NOT NULL DEFAULT 'assistance'
    CHECK (call_type IN ('assistance', 'bill', 'complaint', 'question', 'emergency')),
  priority VARCHAR(10) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
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

-- RLS Policies
ALTER TABLE waiter_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can create waiter calls"
  ON waiter_calls FOR INSERT
  WITH CHECK (
    table_id IN (
      SELECT id FROM tables WHERE qr_code = current_setting('app.qr_token', true)
    )
  );

CREATE POLICY "Customers can view their waiter calls"
  ON waiter_calls FOR SELECT
  USING (
    table_id IN (
      SELECT id FROM tables WHERE qr_code = current_setting('app.qr_token', true)
    )
  );

CREATE POLICY "Staff can view all waiter calls"
  ON waiter_calls FOR SELECT
  TO authenticated
  USING (true);

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
```

### 7. staff

Staff members who use the system.

```sql
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL
    CHECK (role IN ('waiter', 'admin', 'kitchen', 'owner')),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_language VARCHAR(10) NOT NULL DEFAULT 'en'
);

CREATE INDEX idx_staff_role ON staff(role);
CREATE INDEX idx_staff_active ON staff(is_active);
CREATE INDEX idx_staff_auth_user ON staff(auth_user_id);

-- RLS Policies
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all staff"
  ON staff FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage staff"
  ON staff FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );
```

### 8. customer_feedback

Customer complaints, questions, and praise.

```sql
CREATE TABLE customer_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  feedback_type VARCHAR(30) NOT NULL
    CHECK (feedback_type IN (
      'complaint_food', 'complaint_service', 'complaint_staff',
      'question_menu', 'request_general', 'praise'
    )),
  subject VARCHAR(255),
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'acknowledged', 'resolved', 'dismissed')),
  responded_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_feedback_status ON customer_feedback(status);
CREATE INDEX idx_feedback_table ON customer_feedback(table_id);
CREATE INDEX idx_feedback_order ON customer_feedback(order_id);

-- RLS Policies
ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can create feedback"
  ON customer_feedback FOR INSERT
  WITH CHECK (
    table_id IN (
      SELECT id FROM tables WHERE qr_code = current_setting('app.qr_token', true)
    )
  );

CREATE POLICY "Staff can view all feedback"
  ON customer_feedback FOR SELECT
  TO authenticated
  USING (true);

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
```

### 9. order_payments

Payment records for orders (supports split payments).

```sql
CREATE TABLE order_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  received_by UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  payment_type VARCHAR(20) NOT NULL
    CHECK (payment_type IN ('full', 'partial_amount', 'specific_items')),
  amount DECIMAL(10, 2) NOT NULL,
  tip_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(10) NOT NULL
    CHECK (payment_method IN ('cash', 'card', 'digital')),
  order_item_ids UUID[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_order ON order_payments(order_id);
CREATE INDEX idx_payments_received_by ON order_payments(received_by);

-- RLS Policies
ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all payments"
  ON order_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can create payments"
  ON order_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin', 'owner')
    )
  );
```

### 10. table_transfers

Audit log of table transfers.

```sql
CREATE TABLE table_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_table_id UUID NOT NULL REFERENCES tables(id),
  to_table_id UUID NOT NULL REFERENCES tables(id),
  transferred_by UUID NOT NULL REFERENCES staff(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transfers_order ON table_transfers(order_id);

-- RLS Policies
ALTER TABLE table_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view transfers"
  ON table_transfers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can create transfers"
  ON table_transfers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin', 'owner')
    )
  );
```

### 11. staff_schedules

Staff shift scheduling.

```sql
CREATE TABLE staff_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  planned_start TIME NOT NULL,
  planned_end TIME NOT NULL,
  actual_start TIME,
  actual_end TIME,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'missed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schedules_staff ON staff_schedules(staff_id);
CREATE INDEX idx_schedules_date ON staff_schedules(date);

-- RLS Policies
ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all schedules"
  ON staff_schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage schedules"
  ON staff_schedules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );
```

### 12. cafe_settings

Singleton row for restaurant configuration.

```sql
CREATE TABLE cafe_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_name VARCHAR(255) NOT NULL,
  -- Tax
  tax_enabled BOOLEAN DEFAULT true,
  tax_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0,
  tax_label VARCHAR(50) NOT NULL DEFAULT 'Tax',
  prices_include_tax BOOLEAN DEFAULT false,
  show_tax_separately BOOLEAN DEFAULT true,
  -- Currency
  currency_symbol VARCHAR(10) NOT NULL DEFAULT '$',
  currency_code VARCHAR(10) NOT NULL DEFAULT 'USD',
  currency_position VARCHAR(10) NOT NULL DEFAULT 'before'
    CHECK (currency_position IN ('before', 'after')),
  currency_decimal_places INTEGER NOT NULL DEFAULT 2,
  -- Order settings
  minimum_order_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  allow_item_notes BOOLEAN DEFAULT true,
  allow_order_notes BOOLEAN DEFAULT true,
  -- Branding
  cafe_logo_url TEXT,
  hero_image_url TEXT,
  brand_primary_color VARCHAR(20) NOT NULL DEFAULT '#000000',
  brand_secondary_color VARCHAR(20) NOT NULL DEFAULT '#ffffff',
  welcome_heading VARCHAR(255),
  welcome_message TEXT,
  -- Feature toggles
  qr_ordering_enabled BOOLEAN DEFAULT true,
  tips_enabled BOOLEAN DEFAULT false,
  waste_tracking_enabled BOOLEAN DEFAULT false,
  -- Delivery
  delivery_enabled BOOLEAN DEFAULT false,
  delivery_fee_default DECIMAL(10, 2) NOT NULL DEFAULT 0,
  minimum_delivery_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  delivery_zone_info TEXT,
  restaurant_address TEXT,
  -- Contact & social
  contact_phone VARCHAR(30),
  contact_website TEXT,
  social_instagram VARCHAR(255),
  social_whatsapp VARCHAR(255),
  social_tiktok VARCHAR(255),
  social_telegram VARCHAR(255),
  social_line VARCHAR(255),
  location_maps_url TEXT,
  default_language VARCHAR(10) NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE cafe_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view settings"
  ON cafe_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can update settings"
  ON cafe_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );
```

### 13. stock_items

Inventory items for stock management.

```sql
CREATE TABLE stock_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL,
  cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  minimum_stock_level DECIMAL(10, 2) NOT NULL DEFAULT 0,
  supplier_name VARCHAR(255),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_items_category ON stock_items(category);
CREATE INDEX idx_stock_items_active ON stock_items(is_active);

-- RLS Policies
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view stock items"
  ON stock_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage stock items"
  ON stock_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );
```

### 14. stock_movements

Audit trail for stock quantity changes.

```sql
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  movement_type VARCHAR(20) NOT NULL
    CHECK (movement_type IN ('in', 'out', 'adjustment')),
  quantity_change DECIMAL(10, 2) NOT NULL,
  quantity_after DECIMAL(10, 2) NOT NULL,
  reason TEXT,
  performed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_movements_item ON stock_movements(stock_item_id);
CREATE INDEX idx_movements_type ON stock_movements(movement_type);

-- RLS Policies
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view stock movements"
  ON stock_movements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can create stock movements"
  ON stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
    )
  );
```

### 15. expense_categories

Categories for expense tracking.

```sql
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view expense categories"
  ON expense_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage expense categories"
  ON expense_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );
```

### 16. expenses

Individual expense records.

```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT NOT NULL,
  payment_method VARCHAR(20) NOT NULL
    CHECK (payment_method IN ('cash', 'card', 'digital', 'bank_transfer')),
  expense_date DATE NOT NULL,
  receipt_url TEXT,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);

-- RLS Policies
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can create expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage expenses"
  ON expenses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );
```

### 17. waste_logs

Waste tracking records.

```sql
CREATE TABLE waste_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  cost_per_unit DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  reason VARCHAR(30) NOT NULL
    CHECK (reason IN (
      'expired', 'spoiled', 'overcooked', 'dropped',
      'returned_by_customer', 'preparation_waste', 'other'
    )),
  stock_item_id UUID REFERENCES stock_items(id) ON DELETE SET NULL,
  notes TEXT,
  logged_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  waste_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_waste_date ON waste_logs(waste_date);
CREATE INDEX idx_waste_reason ON waste_logs(reason);

-- RLS Policies
ALTER TABLE waste_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view waste logs"
  ON waste_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can create waste logs"
  ON waste_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
    )
  );
```

### 18. task_categories

Categories for staff task management.

```sql
CREATE TABLE task_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  color VARCHAR(20) NOT NULL DEFAULT '#000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view task categories"
  ON task_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage task categories"
  ON task_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );
```

### 19. tasks

Staff task management with optional recurrence.

```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES task_categories(id) ON DELETE SET NULL,
  priority VARCHAR(10) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  due_date DATE,
  due_time TIME,
  completed_at TIMESTAMPTZ,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern VARCHAR(10)
    CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly')),
  recurrence_days INTEGER[],
  parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_category ON tasks(category_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);

-- RLS Policies
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can create tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can update their tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
    )
  );
```

## Views

### 1. active_orders_view

Kitchen and waiter view of current orders with aggregated items.

```sql
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
GROUP BY o.id, t.id, s.id;

GRANT SELECT ON active_orders_view TO authenticated;
```

### 2. sales_summary_view

Daily sales summary for reporting.

```sql
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

GRANT SELECT ON sales_summary_view TO authenticated;
```

### 3. order_payment_summary

Payment summary per order showing paid vs remaining balance.

```sql
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
      'id', op.id,
      'amount', op.amount,
      'tip_amount', op.tip_amount,
      'payment_method', op.payment_method,
      'payment_type', op.payment_type,
      'created_at', op.created_at
    )
  ) FILTER (WHERE op.id IS NOT NULL) AS payments
FROM orders o
LEFT JOIN order_payments op ON o.id = op.order_id
GROUP BY o.id;

GRANT SELECT ON order_payment_summary TO authenticated;
```

## Functions

### 1. set_table_context(qr_token)

Sets the QR token in the session context for RLS policies (used by anonymous/customer access).

```sql
CREATE OR REPLACE FUNCTION set_table_context(qr_token TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.qr_token', qr_token, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. generate_order_number()

Generates a unique order number based on the current date and count.

```sql
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR AS $$
DECLARE
  new_number VARCHAR;
  counter INTEGER;
BEGIN
  SELECT COUNT(*) INTO counter
  FROM orders
  WHERE DATE(created_at) = CURRENT_DATE;

  new_number := 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((counter + 1)::TEXT, 3, '0');

  RETURN new_number;
END;
$$ LANGUAGE plpgsql;
```

### 3. calculate_order_total(order_uuid)

Recalculates subtotal, tax, and total for an order from its items.

```sql
CREATE OR REPLACE FUNCTION calculate_order_total(order_uuid UUID)
RETURNS VOID AS $$
DECLARE
  calculated_subtotal DECIMAL(10, 2);
  calculated_tax DECIMAL(10, 2);
  calculated_total DECIMAL(10, 2);
  tax_rate DECIMAL(5, 4);
BEGIN
  SELECT COALESCE(SUM(item_price * quantity), 0)
  INTO calculated_subtotal
  FROM order_items
  WHERE order_id = order_uuid
    AND status != 'cancelled';

  SELECT COALESCE(tax_percentage / 100, 0) INTO tax_rate
  FROM cafe_settings LIMIT 1;

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
```

### 4. get_order_remaining_balance(order_uuid)

Returns the unpaid balance for an order.

```sql
CREATE OR REPLACE FUNCTION get_order_remaining_balance(order_uuid UUID)
RETURNS DECIMAL AS $$
DECLARE
  order_total DECIMAL(10, 2);
  paid_amount DECIMAL(10, 2);
BEGIN
  SELECT total INTO order_total FROM orders WHERE id = order_uuid;
  SELECT COALESCE(SUM(amount), 0) INTO paid_amount FROM order_payments WHERE order_id = order_uuid;
  RETURN order_total - paid_amount;
END;
$$ LANGUAGE plpgsql;
```

### 5. transfer_table(p_order_id, p_from_table_id, p_to_table_id, p_staff_id, p_reason?)

Moves an order from one table to another, updating both table statuses and creating an audit record.

```sql
CREATE OR REPLACE FUNCTION transfer_table(
  p_order_id UUID,
  p_from_table_id UUID,
  p_to_table_id UUID,
  p_staff_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update the order's table reference
  UPDATE orders SET table_id = p_to_table_id, updated_at = NOW()
  WHERE id = p_order_id AND table_id = p_from_table_id;

  -- Free the old table
  UPDATE tables SET status = 'free', current_session_id = NULL WHERE id = p_from_table_id;

  -- Occupy the new table
  UPDATE tables SET status = 'occupied', current_session_id = p_order_id, occupied_at = NOW()
  WHERE id = p_to_table_id;

  -- Record the transfer
  INSERT INTO table_transfers (order_id, from_table_id, to_table_id, transferred_by, reason)
  VALUES (p_order_id, p_from_table_id, p_to_table_id, p_staff_id, p_reason);

  RETURN true;
END;
$$ LANGUAGE plpgsql;
```

## Triggers

### Auto-update timestamps

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied to all tables with updated_at column
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
CREATE TRIGGER update_cafe_settings_updated_at BEFORE UPDATE ON cafe_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staff_schedules_updated_at BEFORE UPDATE ON staff_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stock_items_updated_at BEFORE UPDATE ON stock_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Auto-generate order number

```sql
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();
```

### Auto-calculate order total on item changes

```sql
CREATE OR REPLACE FUNCTION recalculate_order_total()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_order_total(COALESCE(NEW.order_id, OLD.order_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalculate_on_item_insert AFTER INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION recalculate_order_total();
CREATE TRIGGER recalculate_on_item_update AFTER UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION recalculate_order_total();
CREATE TRIGGER recalculate_on_item_delete AFTER DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION recalculate_order_total();
```

### Update table status on order changes

```sql
CREATE OR REPLACE FUNCTION update_table_status_on_order()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.table_id IS NOT NULL THEN
    UPDATE tables
    SET status = 'occupied', occupied_at = NOW(), current_session_id = NEW.id
    WHERE id = NEW.table_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'closed' AND OLD.status != 'closed'
        AND NEW.table_id IS NOT NULL THEN
    UPDATE tables
    SET status = 'free', current_session_id = NULL
    WHERE id = NEW.table_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_table_on_order
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_table_status_on_order();
```

## Composite & Partial Indexes

```sql
CREATE INDEX idx_orders_table_status ON orders(table_id, status);
CREATE INDEX idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX idx_order_items_order_status ON order_items(order_id, status);
CREATE INDEX idx_menu_items_category_available ON menu_items(category_id, is_available);

-- Partial indexes
CREATE INDEX idx_active_orders ON orders(created_at DESC)
  WHERE status IN ('pending_approval', 'new', 'preparing', 'ready', 'out_for_delivery');

CREATE INDEX idx_pending_waiter_calls ON waiter_calls(created_at DESC)
  WHERE status = 'pending';
```
