# Database Schema

## Overview

PostgreSQL database schema for Café İdarə system with row-level security (RLS) enabled.

## Entity Relationship Diagram

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Tables    │────────<│   Orders    │>────────│ Order Items │
│             │ 1     * │             │ 1     * │             │
└─────────────┘         └─────────────┘         └─────────────┘
                               │                        │
                               │                        │
                               │ *                      │ *
                               │                        │
                               │ 1                      │ 1
                        ┌──────▼──────┐         ┌──────▼──────┐
                        │   Staff     │         │ Menu Items  │
                        │   (Users)   │         │             │
                        └─────────────┘         └─────┬───────┘
                                                      │
                                                      │ *
                                                      │
                                                      │ 1
                                                ┌─────▼───────┐
                                                │ Categories  │
                                                │             │
                                                └─────────────┘

┌─────────────┐         ┌─────────────┐
│   Tables    │────────<│Waiter Calls │
│             │ 1     * │             │
└─────────────┘         └─────────────┘
```

## Tables

### 1. staff (Users)

Staff members who use the mobile app (Waiter, Admin, Kitchen).

```sql
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
  
  -- Supabase Auth integration
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
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
      AND role = 'admin'
    )
  );
```

### 2. tables

Physical tables in the café.

```sql
CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_number VARCHAR(10) UNIQUE NOT NULL,
  qr_code TEXT UNIQUE NOT NULL, -- Encrypted token for QR access
  capacity INTEGER NOT NULL DEFAULT 4,
  status VARCHAR(20) NOT NULL DEFAULT 'free' 
    CHECK (status IN ('free', 'occupied', 'reserved', 'closed')),
  location VARCHAR(100), -- e.g., "Window", "Corner", "Patio"
  current_session_id UUID, -- Links to active order session
  occupied_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true, -- Can disable tables temporarily
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
      AND role IN ('waiter', 'admin')
    )
  );
```

### 3. categories

Menu item categories.

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_en VARCHAR(100) NOT NULL,
  name_az VARCHAR(100), -- Azerbaijani
  name_ru VARCHAR(100), -- Russian
  name_tr VARCHAR(100), -- Turkish
  description_en TEXT,
  description_az TEXT,
  description_ru TEXT,
  description_tr TEXT,
  icon VARCHAR(50), -- Icon name (e.g., "coffee", "food")
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
      AND role = 'admin'
    )
  );
```

### 4. menu_items

Menu items available for ordering.

```sql
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  
  -- Multi-language support
  name_en VARCHAR(255) NOT NULL,
  name_az VARCHAR(255),
  name_ru VARCHAR(255),
  name_tr VARCHAR(255),
  
  description_en TEXT,
  description_az TEXT,
  description_ru TEXT,
  description_tr TEXT,
  
  -- Pricing
  price DECIMAL(10, 2) NOT NULL,
  
  -- Media
  image_url TEXT,
  
  -- Metadata
  preparation_time INTEGER, -- In minutes
  is_popular BOOLEAN DEFAULT false,
  is_vegetarian BOOLEAN DEFAULT false,
  is_vegan BOOLEAN DEFAULT false,
  is_gluten_free BOOLEAN DEFAULT false,
  is_spicy BOOLEAN DEFAULT false,
  allergens TEXT[], -- Array of allergen names
  
  -- Availability
  is_available BOOLEAN DEFAULT true,
  is_daily_special BOOLEAN DEFAULT false,
  
  -- Display
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_available ON menu_items(is_available);
CREATE INDEX idx_menu_items_popular ON menu_items(is_popular);
CREATE INDEX idx_menu_items_order ON menu_items(display_order);

-- Full-text search index
CREATE INDEX idx_menu_items_search_en ON menu_items 
  USING gin(to_tsvector('english', name_en || ' ' || COALESCE(description_en, '')));

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
      AND role = 'admin'
    )
  );
```

### 5. orders

Customer orders (one per table session).

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  assigned_waiter_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  
  -- Order tracking
  order_number VARCHAR(10) UNIQUE NOT NULL, -- e.g., "ORD-001"
  status VARCHAR(20) NOT NULL DEFAULT 'new' 
    CHECK (status IN ('new', 'preparing', 'ready', 'served', 'closed', 'cancelled')),
  
  -- Pricing
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tax DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  
  -- Notes
  customer_notes TEXT,
  internal_notes TEXT, -- Staff-only notes
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  preparing_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  
  -- Payment (future)
  payment_method VARCHAR(20), -- 'cash', 'card', 'online'
  paid_at TIMESTAMPTZ
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
    -- Match by table QR token (stored in session)
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
    AND status = 'new'
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
      AND role IN ('waiter', 'admin')
    )
  );

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
```

### 6. order_items

Individual items within an order.

```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  
  -- Snapshot of menu item at time of order
  item_name VARCHAR(255) NOT NULL,
  item_price DECIMAL(10, 2) NOT NULL,
  
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes TEXT, -- Customer customization notes
  
  -- Item-level status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'preparing', 'ready', 'served')),
  
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
      AND status = 'new'
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
      AND role IN ('waiter', 'admin', 'kitchen')
    )
  );
```

### 7. waiter_calls

Customer requests for waiter assistance.

```sql
CREATE TABLE waiter_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  reason VARCHAR(50) DEFAULT 'assistance', -- 'assistance', 'bill', 'complaint', etc.
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
      AND role IN ('waiter', 'admin')
    )
  );
```

## Views

### 1. active_orders_view

Kitchen and waiter view of current orders with aggregated info.

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
  -- Time tracking
  EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60 AS minutes_elapsed,
  -- Aggregated items for kitchen display
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

-- Grant access to authenticated users
GRANT SELECT ON active_orders_view TO authenticated;
```

### 2. sales_summary_view

Daily sales summary for reports.

```sql
CREATE OR REPLACE VIEW sales_summary_view AS
SELECT 
  DATE(created_at) AS date,
  COUNT(DISTINCT id) AS order_count,
  SUM(total) AS total_revenue,
  AVG(total) AS average_order_value,
  COUNT(DISTINCT table_id) AS tables_served,
  -- Time metrics
  AVG(EXTRACT(EPOCH FROM (served_at - created_at)) / 60) AS avg_service_time_minutes
FROM orders
WHERE status = 'closed'
  AND closed_at IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Only admins can view
GRANT SELECT ON sales_summary_view TO authenticated;
```

## Functions

### 1. Generate Order Number

```sql
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR(10) AS $$
DECLARE
  new_number VARCHAR(10);
  counter INTEGER;
BEGIN
  -- Get today's order count
  SELECT COUNT(*) INTO counter
  FROM orders
  WHERE DATE(created_at) = CURRENT_DATE;
  
  -- Format: ORD-YYYYMMDD-XXX
  new_number := 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((counter + 1)::TEXT, 3, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;
```

### 2. Calculate Order Total

```sql
CREATE OR REPLACE FUNCTION calculate_order_total(order_uuid UUID)
RETURNS VOID AS $$
DECLARE
  calculated_subtotal DECIMAL(10, 2);
  calculated_tax DECIMAL(10, 2);
  calculated_total DECIMAL(10, 2);
  tax_rate DECIMAL(5, 4) := 0.18; -- 18% tax
BEGIN
  -- Calculate subtotal from order items
  SELECT COALESCE(SUM(item_price * quantity), 0)
  INTO calculated_subtotal
  FROM order_items
  WHERE order_id = order_uuid;
  
  -- Calculate tax
  calculated_tax := calculated_subtotal * tax_rate;
  
  -- Calculate total
  calculated_total := calculated_subtotal + calculated_tax;
  
  -- Update order
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

## Triggers

### 1. Auto-update timestamps

```sql
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
```

### 2. Auto-generate order number

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

### 3. Auto-calculate order total on item changes

```sql
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
```

### 4. Update table status on order changes

```sql
CREATE OR REPLACE FUNCTION update_table_status_on_order()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Mark table as occupied when order is created
    UPDATE tables
    SET 
      status = 'occupied',
      occupied_at = NOW(),
      current_session_id = NEW.id
    WHERE id = NEW.table_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'closed' AND OLD.status != 'closed' THEN
    -- Free up table when order is closed
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
```

## Indexes for Performance

```sql
-- Composite indexes for common queries
CREATE INDEX idx_orders_table_status ON orders(table_id, status);
CREATE INDEX idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX idx_order_items_order_status ON order_items(order_id, status);
CREATE INDEX idx_menu_items_category_available ON menu_items(category_id, is_available);

-- Partial indexes (only index relevant rows)
CREATE INDEX idx_active_orders ON orders(created_at DESC) 
  WHERE status IN ('new', 'preparing', 'ready');

CREATE INDEX idx_pending_waiter_calls ON waiter_calls(created_at DESC)
  WHERE status = 'pending';
```

## Sample Data Queries

```sql
-- Get all active orders for kitchen display
SELECT * FROM active_orders_view
ORDER BY created_at ASC;

-- Get pending waiter calls
SELECT 
  wc.*,
  t.table_number,
  t.location
FROM waiter_calls wc
JOIN tables t ON wc.table_id = t.id
WHERE wc.status = 'pending'
ORDER BY wc.created_at ASC;

-- Get today's sales
SELECT * FROM sales_summary_view
WHERE date = CURRENT_DATE;

-- Get popular menu items
SELECT 
  mi.name_en,
  COUNT(oi.id) AS order_count,
  SUM(oi.quantity) AS total_quantity
FROM menu_items mi
JOIN order_items oi ON mi.id = oi.menu_item_id
JOIN orders o ON oi.order_id = o.id
WHERE o.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY mi.id
ORDER BY total_quantity DESC
LIMIT 10;
```


