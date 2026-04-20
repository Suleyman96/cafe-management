-- Comprehensive RLS policy cleanup
-- Fixes all remaining minor issues after the critical recursion fix (000004) and missing policies (000005)
--
-- Issues addressed:
-- 1. waiter_calls: "High priority calls" policy has raw staff subquery (recursion risk)
-- 2. categories/menu_items: migration 007 left overly permissive INSERT/UPDATE/DELETE policies
-- 3. cafe_settings: missing INSERT/DELETE restriction
-- 4. tables: missing INSERT/DELETE policies for admin/owner
-- 5. stock/expense tables: any authenticated user can CRUD (should require active staff)
-- 6. waste/task/schedule tables: same overly permissive issue

-- ============================================================
-- 1. Fix waiter_calls "High priority calls" — replace raw staff subquery
-- ============================================================

DROP POLICY IF EXISTS "High priority calls notify all staff" ON waiter_calls;
CREATE POLICY "High priority calls notify all staff"
  ON waiter_calls FOR SELECT
  TO authenticated
  USING (
    priority IN ('high', 'urgent') OR public.is_active_staff()
  );

-- ============================================================
-- 2. Drop overly permissive category policies from migration 007
--    These bypass the admin-only check from migration 000004
-- ============================================================

-- Categories: drop permissive policies that allow any authenticated user to write
DROP POLICY IF EXISTS "Authenticated users can insert categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON categories;

-- Also clean up duplicate SELECT policies on categories
-- Keep only one: "Anyone can view categories" USING(true) covers everything
DROP POLICY IF EXISTS "Anyone can view active categories" ON categories;

-- Menu items: drop permissive policies that allow any authenticated user to write
DROP POLICY IF EXISTS "Authenticated users can insert menu items" ON menu_items;
DROP POLICY IF EXISTS "Authenticated users can update menu items" ON menu_items;
DROP POLICY IF EXISTS "Authenticated users can delete menu items" ON menu_items;

-- Clean up duplicate SELECT policies on menu_items
DROP POLICY IF EXISTS "Anyone can view available menu items" ON menu_items;

-- ============================================================
-- 3. Fix cafe_settings — add INSERT/DELETE restriction
-- ============================================================

-- INSERT is already blocked by the enforce_single_cafe_settings trigger,
-- but add a policy for defense in depth
DROP POLICY IF EXISTS "Admins can insert cafe settings" ON cafe_settings;
CREATE POLICY "Admins can insert cafe settings"
  ON cafe_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_staff_role() IN ('admin', 'owner'));

DROP POLICY IF EXISTS "Admins can delete cafe settings" ON cafe_settings;
CREATE POLICY "Admins can delete cafe settings"
  ON cafe_settings FOR DELETE
  TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

-- ============================================================
-- 4. Add missing tables INSERT/DELETE policies
-- ============================================================

DROP POLICY IF EXISTS "Admins can create tables" ON tables;
CREATE POLICY "Admins can create tables"
  ON tables FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_staff_role() IN ('admin', 'owner'));

DROP POLICY IF EXISTS "Admins can delete tables" ON tables;
CREATE POLICY "Admins can delete tables"
  ON tables FOR DELETE
  TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

-- ============================================================
-- 5. Tighten stock & expense policies
--    SELECT: any active staff | INSERT/UPDATE: any active staff | DELETE: admin/owner
-- ============================================================

-- stock_items
DROP POLICY IF EXISTS "Authenticated users can manage stock_items" ON stock_items;

CREATE POLICY "Staff can view stock_items"
  ON stock_items FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY "Staff can insert stock_items"
  ON stock_items FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff());

CREATE POLICY "Staff can update stock_items"
  ON stock_items FOR UPDATE TO authenticated
  USING (public.is_active_staff());

CREATE POLICY "Admins can delete stock_items"
  ON stock_items FOR DELETE TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

-- stock_movements
DROP POLICY IF EXISTS "Authenticated users can manage stock_movements" ON stock_movements;

CREATE POLICY "Staff can view stock_movements"
  ON stock_movements FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY "Staff can insert stock_movements"
  ON stock_movements FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff());

CREATE POLICY "Staff can update stock_movements"
  ON stock_movements FOR UPDATE TO authenticated
  USING (public.is_active_staff());

CREATE POLICY "Admins can delete stock_movements"
  ON stock_movements FOR DELETE TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

-- expense_categories
DROP POLICY IF EXISTS "Authenticated users can manage expense_categories" ON expense_categories;

CREATE POLICY "Staff can view expense_categories"
  ON expense_categories FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY "Admins can insert expense_categories"
  ON expense_categories FOR INSERT TO authenticated
  WITH CHECK (public.get_my_staff_role() IN ('admin', 'owner'));

CREATE POLICY "Admins can update expense_categories"
  ON expense_categories FOR UPDATE TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

CREATE POLICY "Admins can delete expense_categories"
  ON expense_categories FOR DELETE TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

-- expenses
DROP POLICY IF EXISTS "Authenticated users can manage expenses" ON expenses;

CREATE POLICY "Staff can view expenses"
  ON expenses FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY "Staff can insert expenses"
  ON expenses FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff());

CREATE POLICY "Staff can update expenses"
  ON expenses FOR UPDATE TO authenticated
  USING (public.is_active_staff());

CREATE POLICY "Admins can delete expenses"
  ON expenses FOR DELETE TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

-- ============================================================
-- 6. Tighten waste_logs, task_categories, tasks, staff_schedules
-- ============================================================

-- waste_logs: any staff can log waste, only admins delete
DROP POLICY IF EXISTS "Authenticated users can view waste_logs" ON waste_logs;
DROP POLICY IF EXISTS "Authenticated users can insert waste_logs" ON waste_logs;
DROP POLICY IF EXISTS "Authenticated users can update waste_logs" ON waste_logs;
DROP POLICY IF EXISTS "Authenticated users can delete waste_logs" ON waste_logs;

CREATE POLICY "Staff can view waste_logs"
  ON waste_logs FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY "Staff can insert waste_logs"
  ON waste_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff());

CREATE POLICY "Staff can update waste_logs"
  ON waste_logs FOR UPDATE TO authenticated
  USING (public.is_active_staff());

CREATE POLICY "Admins can delete waste_logs"
  ON waste_logs FOR DELETE TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

-- task_categories: all staff view, admins manage
DROP POLICY IF EXISTS "Authenticated users can view task_categories" ON task_categories;
DROP POLICY IF EXISTS "Authenticated users can insert task_categories" ON task_categories;
DROP POLICY IF EXISTS "Authenticated users can update task_categories" ON task_categories;
DROP POLICY IF EXISTS "Authenticated users can delete task_categories" ON task_categories;

CREATE POLICY "Staff can view task_categories"
  ON task_categories FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY "Admins can insert task_categories"
  ON task_categories FOR INSERT TO authenticated
  WITH CHECK (public.get_my_staff_role() IN ('admin', 'owner'));

CREATE POLICY "Admins can update task_categories"
  ON task_categories FOR UPDATE TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

CREATE POLICY "Admins can delete task_categories"
  ON task_categories FOR DELETE TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

-- tasks: all staff can view/create/update, admins can delete
DROP POLICY IF EXISTS "Authenticated users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can delete tasks" ON tasks;

CREATE POLICY "Staff can view tasks"
  ON tasks FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY "Staff can insert tasks"
  ON tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff());

CREATE POLICY "Staff can update tasks"
  ON tasks FOR UPDATE TO authenticated
  USING (public.is_active_staff());

CREATE POLICY "Admins can delete tasks"
  ON tasks FOR DELETE TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

-- staff_schedules: all staff can view, admins can manage
DROP POLICY IF EXISTS "staff_schedules_select" ON staff_schedules;
DROP POLICY IF EXISTS "staff_schedules_insert" ON staff_schedules;
DROP POLICY IF EXISTS "staff_schedules_update" ON staff_schedules;
DROP POLICY IF EXISTS "staff_schedules_delete" ON staff_schedules;

CREATE POLICY "Staff can view schedules"
  ON staff_schedules FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY "Admins can insert schedules"
  ON staff_schedules FOR INSERT TO authenticated
  WITH CHECK (public.get_my_staff_role() IN ('admin', 'owner'));

CREATE POLICY "Admins can update schedules"
  ON staff_schedules FOR UPDATE TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

CREATE POLICY "Admins can delete schedules"
  ON staff_schedules FOR DELETE TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));
