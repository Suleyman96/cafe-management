-- Waste Management & Task Management Feature
-- Adds waste tracking and internal task system for staff coordination

-- ============================================
-- 1. Waste Logs Table
-- ============================================
CREATE TABLE waste_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name VARCHAR NOT NULL,
  category VARCHAR NOT NULL DEFAULT 'General',
  quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  unit VARCHAR NOT NULL DEFAULT 'pieces',
  cost_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason VARCHAR NOT NULL CHECK (reason IN ('expired', 'spoiled', 'overcooked', 'dropped', 'returned_by_customer', 'preparation_waste', 'other')),
  stock_item_id UUID REFERENCES stock_items(id) ON DELETE SET NULL,
  notes TEXT,
  logged_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  waste_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_waste_logs_date ON waste_logs(waste_date);
CREATE INDEX idx_waste_logs_reason ON waste_logs(reason);
CREATE INDEX idx_waste_logs_stock_item ON waste_logs(stock_item_id);
CREATE INDEX idx_waste_logs_logged_by ON waste_logs(logged_by);

-- ============================================
-- 2. Task Categories Table
-- ============================================
CREATE TABLE task_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  icon VARCHAR,
  color VARCHAR(7) DEFAULT '#6B7280',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 3. Tasks Table
-- ============================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR NOT NULL,
  description TEXT,
  category_id UUID REFERENCES task_categories(id) ON DELETE SET NULL,
  priority VARCHAR NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status VARCHAR NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  due_date DATE,
  due_time TIME,
  completed_at TIMESTAMPTZ,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_pattern VARCHAR CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly')),
  recurrence_days INTEGER[],
  parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_category ON tasks(category_id);
CREATE INDEX idx_tasks_recurring ON tasks(is_recurring) WHERE is_recurring = true;
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);

-- ============================================
-- 4. Triggers
-- ============================================
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. Disable RLS for Development
-- ============================================
ALTER TABLE waste_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. Enable Realtime for Tasks
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER TABLE tasks REPLICA IDENTITY FULL;

-- ============================================
-- 7. Seed Default Task Categories
-- ============================================
INSERT INTO task_categories (name, icon, color) VALUES
  ('Cleaning', 'Sparkles', '#367B8B'),
  ('Inventory', 'Package', '#F59E0B'),
  ('Maintenance', 'Wrench', '#EF4444'),
  ('Preparation', 'ChefHat', '#8B5CF6'),
  ('Administrative', 'FileText', '#6366F1'),
  ('General', 'CheckSquare', '#6B7280');
