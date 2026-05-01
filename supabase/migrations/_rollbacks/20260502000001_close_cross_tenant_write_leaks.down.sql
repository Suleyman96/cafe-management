-- Rollback for 20260502000001_close_cross_tenant_write_leaks.
-- Re-creates the original baseline role-only policies that lacked tenant
-- predicates. APPLYING THIS ROLLBACK RE-OPENS THE CROSS-TENANT WRITE LEAK
-- across all 17 affected tables — only run as part of a full revert.

BEGIN;

-- cafe_settings
DROP POLICY IF EXISTS "Admins can insert cafe settings in tenant" ON public.cafe_settings;
DROP POLICY IF EXISTS "Admins can update cafe settings in tenant" ON public.cafe_settings;
DROP POLICY IF EXISTS "Admins can delete cafe settings in tenant" ON public.cafe_settings;
CREATE POLICY "Admins can insert cafe settings" ON public.cafe_settings FOR INSERT TO authenticated WITH CHECK (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Admins can update cafe settings" ON public.cafe_settings FOR UPDATE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Admins can delete cafe settings" ON public.cafe_settings FOR DELETE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));

-- categories
DROP POLICY IF EXISTS "Admins can insert categories in tenant" ON public.categories;
DROP POLICY IF EXISTS "Admins can update categories in tenant" ON public.categories;
DROP POLICY IF EXISTS "Admins can delete categories in tenant" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));

-- customer_feedback
DROP POLICY IF EXISTS "Admins can delete feedback in tenant" ON public.customer_feedback;
DROP POLICY IF EXISTS "Staff can update feedback in tenant" ON public.customer_feedback;
CREATE POLICY "Admins can delete feedback" ON public.customer_feedback FOR DELETE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Staff can update feedback" ON public.customer_feedback FOR UPDATE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['waiter'::text, 'admin'::text, 'owner'::text]));

-- expense_categories
DROP POLICY IF EXISTS "Admins can insert expense_categories in tenant" ON public.expense_categories;
DROP POLICY IF EXISTS "Admins can update expense_categories in tenant" ON public.expense_categories;
DROP POLICY IF EXISTS "Admins can delete expense_categories in tenant" ON public.expense_categories;
CREATE POLICY "Admins can insert expense_categories" ON public.expense_categories FOR INSERT TO authenticated WITH CHECK (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Admins can update expense_categories" ON public.expense_categories FOR UPDATE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Admins can delete expense_categories" ON public.expense_categories FOR DELETE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));

-- expenses
DROP POLICY IF EXISTS "Admins can delete expenses in tenant" ON public.expenses;
DROP POLICY IF EXISTS "Staff can insert expenses in tenant" ON public.expenses;
DROP POLICY IF EXISTS "Staff can update expenses in tenant" ON public.expenses;
CREATE POLICY "Admins can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Staff can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (public.is_active_staff());
CREATE POLICY "Staff can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (public.is_active_staff());

-- menu_items
DROP POLICY IF EXISTS "Admins can insert menu items in tenant" ON public.menu_items;
DROP POLICY IF EXISTS "Admins can update menu items in tenant" ON public.menu_items;
DROP POLICY IF EXISTS "Admins can delete menu items in tenant" ON public.menu_items;
CREATE POLICY "Admins can manage menu items" ON public.menu_items TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Admins can insert menu items" ON public.menu_items FOR INSERT TO authenticated WITH CHECK (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Admins can update menu items" ON public.menu_items FOR UPDATE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Admins can delete menu items" ON public.menu_items FOR DELETE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));

-- order_items
DROP POLICY IF EXISTS "Staff can update order items in tenant" ON public.order_items;
DROP POLICY IF EXISTS "Staff can delete order items in tenant" ON public.order_items;
CREATE POLICY "Staff can update order items" ON public.order_items FOR UPDATE TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can delete order items" ON public.order_items FOR DELETE TO authenticated USING (public.is_active_staff());

-- order_payments
DROP POLICY IF EXISTS "Admins can delete payments in tenant" ON public.order_payments;
DROP POLICY IF EXISTS "Staff can create payments in tenant" ON public.order_payments;
CREATE POLICY "Admins can delete payments" ON public.order_payments FOR DELETE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Staff can create payments" ON public.order_payments FOR INSERT TO authenticated WITH CHECK (public.get_my_staff_role() = ANY (ARRAY['waiter'::text, 'admin'::text, 'owner'::text]) AND received_by = public.get_my_staff_id());

-- orders
DROP POLICY IF EXISTS "Admins can delete orders in tenant" ON public.orders;
DROP POLICY IF EXISTS "Staff can create orders in tenant" ON public.orders;
DROP POLICY IF EXISTS "Staff can update orders in tenant" ON public.orders;
CREATE POLICY "Admins can delete orders" ON public.orders FOR DELETE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Staff can create orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (public.get_my_staff_role() = ANY (ARRAY['waiter'::text, 'admin'::text, 'owner'::text]));
CREATE POLICY "Staff can update orders" ON public.orders FOR UPDATE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['waiter'::text, 'admin'::text, 'owner'::text]));

-- staff_schedules
DROP POLICY IF EXISTS "Admins can insert schedules in tenant" ON public.staff_schedules;
DROP POLICY IF EXISTS "Admins can update schedules in tenant" ON public.staff_schedules;
DROP POLICY IF EXISTS "Admins can delete schedules in tenant" ON public.staff_schedules;
CREATE POLICY "Admins can insert schedules" ON public.staff_schedules FOR INSERT TO authenticated WITH CHECK (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Admins can update schedules" ON public.staff_schedules FOR UPDATE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Admins can delete schedules" ON public.staff_schedules FOR DELETE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));

-- stock_items
DROP POLICY IF EXISTS "Admins can delete stock_items in tenant" ON public.stock_items;
DROP POLICY IF EXISTS "Staff can insert stock_items in tenant" ON public.stock_items;
DROP POLICY IF EXISTS "Staff can update stock_items in tenant" ON public.stock_items;
CREATE POLICY "Admins can delete stock_items" ON public.stock_items FOR DELETE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Staff can insert stock_items" ON public.stock_items FOR INSERT TO authenticated WITH CHECK (public.is_active_staff());
CREATE POLICY "Staff can update stock_items" ON public.stock_items FOR UPDATE TO authenticated USING (public.is_active_staff());

-- stock_movements
DROP POLICY IF EXISTS "Admins can delete stock_movements in tenant" ON public.stock_movements;
DROP POLICY IF EXISTS "Staff can insert stock_movements in tenant" ON public.stock_movements;
DROP POLICY IF EXISTS "Staff can update stock_movements in tenant" ON public.stock_movements;
CREATE POLICY "Admins can delete stock_movements" ON public.stock_movements FOR DELETE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Staff can insert stock_movements" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (public.is_active_staff());
CREATE POLICY "Staff can update stock_movements" ON public.stock_movements FOR UPDATE TO authenticated USING (public.is_active_staff());

-- table_transfers
DROP POLICY IF EXISTS "Admins can delete transfers in tenant" ON public.table_transfers;
DROP POLICY IF EXISTS "Staff can log transfers in tenant" ON public.table_transfers;
CREATE POLICY "Admins can delete transfers" ON public.table_transfers FOR DELETE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Staff can log transfers" ON public.table_transfers FOR INSERT TO authenticated WITH CHECK (public.get_my_staff_role() = ANY (ARRAY['waiter'::text, 'admin'::text, 'owner'::text]));

-- tables
DROP POLICY IF EXISTS "Admins can create tables in tenant" ON public.tables;
DROP POLICY IF EXISTS "Admins can delete tables in tenant" ON public.tables;
DROP POLICY IF EXISTS "Staff can update tables in tenant" ON public.tables;
CREATE POLICY "Admins can create tables" ON public.tables FOR INSERT TO authenticated WITH CHECK (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Admins can delete tables" ON public.tables FOR DELETE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Staff can update tables" ON public.tables FOR UPDATE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['waiter'::text, 'admin'::text, 'owner'::text]));

-- task_categories
DROP POLICY IF EXISTS "Admins can insert task_categories in tenant" ON public.task_categories;
DROP POLICY IF EXISTS "Admins can update task_categories in tenant" ON public.task_categories;
DROP POLICY IF EXISTS "Admins can delete task_categories in tenant" ON public.task_categories;
CREATE POLICY "Admins can insert task_categories" ON public.task_categories FOR INSERT TO authenticated WITH CHECK (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Admins can update task_categories" ON public.task_categories FOR UPDATE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Admins can delete task_categories" ON public.task_categories FOR DELETE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));

-- tasks
DROP POLICY IF EXISTS "Admins can delete tasks in tenant" ON public.tasks;
DROP POLICY IF EXISTS "Staff can insert tasks in tenant" ON public.tasks;
DROP POLICY IF EXISTS "Staff can update tasks in tenant" ON public.tasks;
CREATE POLICY "Admins can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Staff can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.is_active_staff());
CREATE POLICY "Staff can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (public.is_active_staff());

-- waiter_calls
DROP POLICY IF EXISTS "Staff can update waiter calls in tenant" ON public.waiter_calls;
CREATE POLICY "Staff can update waiter calls" ON public.waiter_calls FOR UPDATE TO authenticated USING (public.is_active_staff());

-- waste_logs
DROP POLICY IF EXISTS "Admins can delete waste_logs in tenant" ON public.waste_logs;
DROP POLICY IF EXISTS "Staff can insert waste_logs in tenant" ON public.waste_logs;
DROP POLICY IF EXISTS "Staff can update waste_logs in tenant" ON public.waste_logs;
CREATE POLICY "Admins can delete waste_logs" ON public.waste_logs FOR DELETE TO authenticated USING (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text]));
CREATE POLICY "Staff can insert waste_logs" ON public.waste_logs FOR INSERT TO authenticated WITH CHECK (public.is_active_staff());
CREATE POLICY "Staff can update waste_logs" ON public.waste_logs FOR UPDATE TO authenticated USING (public.is_active_staff());

COMMIT;
