-- Enable RLS on all public tables for production
-- Previously disabled for development convenience

-- ============================================================
-- 1. Enable RLS on tables that have policies but RLS was disabled
-- ============================================================

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_payments' AND table_schema = 'public') THEN
    ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'table_transfers' AND table_schema = 'public') THEN
    ALTER TABLE table_transfers ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================================
-- 2. Enable RLS + add policies for tables that have neither
--    Use DROP IF EXISTS + CREATE to be idempotent
-- ============================================================

-- waste_logs
ALTER TABLE waste_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view waste_logs" ON waste_logs;
CREATE POLICY "Authenticated users can view waste_logs"
  ON waste_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert waste_logs" ON waste_logs;
CREATE POLICY "Authenticated users can insert waste_logs"
  ON waste_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update waste_logs" ON waste_logs;
CREATE POLICY "Authenticated users can update waste_logs"
  ON waste_logs FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete waste_logs" ON waste_logs;
CREATE POLICY "Authenticated users can delete waste_logs"
  ON waste_logs FOR DELETE TO authenticated USING (true);

-- task_categories
ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view task_categories" ON task_categories;
CREATE POLICY "Authenticated users can view task_categories"
  ON task_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert task_categories" ON task_categories;
CREATE POLICY "Authenticated users can insert task_categories"
  ON task_categories FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update task_categories" ON task_categories;
CREATE POLICY "Authenticated users can update task_categories"
  ON task_categories FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete task_categories" ON task_categories;
CREATE POLICY "Authenticated users can delete task_categories"
  ON task_categories FOR DELETE TO authenticated USING (true);

-- tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view tasks" ON tasks;
CREATE POLICY "Authenticated users can view tasks"
  ON tasks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON tasks;
CREATE POLICY "Authenticated users can insert tasks"
  ON tasks FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update tasks" ON tasks;
CREATE POLICY "Authenticated users can update tasks"
  ON tasks FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete tasks" ON tasks;
CREATE POLICY "Authenticated users can delete tasks"
  ON tasks FOR DELETE TO authenticated USING (true);
