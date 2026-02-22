-- Stock & Expenses Feature
-- Adds inventory tracking and expense management for admin users

-- ============================================
-- 1. Stock Items Table
-- ============================================
CREATE TABLE stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  category VARCHAR NOT NULL DEFAULT 'General',
  quantity DECIMAL NOT NULL DEFAULT 0,
  unit VARCHAR NOT NULL DEFAULT 'pieces',
  cost_price DECIMAL NOT NULL DEFAULT 0,
  minimum_stock_level DECIMAL NOT NULL DEFAULT 0,
  supplier_name VARCHAR,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 2. Stock Movements Table (audit trail)
-- ============================================
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  movement_type VARCHAR NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  quantity_change DECIMAL NOT NULL,
  quantity_after DECIMAL NOT NULL,
  reason TEXT,
  performed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 3. Expense Categories Table
-- ============================================
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  icon VARCHAR,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 4. Expenses Table
-- ============================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  amount DECIMAL NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  payment_method VARCHAR NOT NULL CHECK (payment_method IN ('cash', 'card', 'digital', 'bank_transfer')),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 5. Updated_at Triggers
-- ============================================
CREATE TRIGGER update_stock_items_updated_at
  BEFORE UPDATE ON stock_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. Indexes
-- ============================================
CREATE INDEX idx_stock_items_category ON stock_items(category);
CREATE INDEX idx_stock_items_is_active ON stock_items(is_active);
CREATE INDEX idx_stock_movements_stock_item_id ON stock_movements(stock_item_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX idx_expenses_category_id ON expenses(category_id);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX idx_expenses_created_by ON expenses(created_by);

-- ============================================
-- 7. RLS Policies
-- ============================================
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (admin check done at app level)
CREATE POLICY "Authenticated users can manage stock_items"
  ON stock_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage stock_movements"
  ON stock_movements FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage expense_categories"
  ON expense_categories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage expenses"
  ON expenses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 8. Seed Default Expense Categories
-- ============================================
INSERT INTO expense_categories (name, description, icon) VALUES
  ('Rent', 'Monthly rent and lease payments', 'Building2'),
  ('Utilities', 'Electricity, water, gas, internet', 'Zap'),
  ('Salaries', 'Staff wages and benefits', 'Users'),
  ('Supplies', 'Kitchen and cleaning supplies', 'ShoppingCart'),
  ('Maintenance', 'Equipment repairs and maintenance', 'Wrench'),
  ('Marketing', 'Advertising and promotions', 'Megaphone'),
  ('Other', 'Miscellaneous expenses', 'MoreHorizontal');
