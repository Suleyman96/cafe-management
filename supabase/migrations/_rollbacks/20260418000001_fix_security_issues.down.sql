-- Rollback: revert RLS policy changes from fix_security_issues
-- WARNING: This re-opens anonymous access. Only use if the new policies cause issues.

-- ============================================================
-- 1. Drop scoped RPC functions
-- ============================================================

DROP FUNCTION IF EXISTS public.get_active_order_for_table(UUID);
DROP FUNCTION IF EXISTS public.get_delivery_order(UUID);
DROP FUNCTION IF EXISTS public.get_waiter_calls_for_table(UUID, TEXT);

-- ============================================================
-- 2. Drop the new restrictive/scoped policies
-- ============================================================

DROP POLICY IF EXISTS "anon_read_categories" ON public.categories;
DROP POLICY IF EXISTS "anon_read_menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "anon_read_cafe_settings" ON public.cafe_settings;
DROP POLICY IF EXISTS "anon_read_tables" ON public.tables;
DROP POLICY IF EXISTS "anon_read_orders_scoped" ON public.orders;
DROP POLICY IF EXISTS "anon_read_order_items_scoped" ON public.order_items;
DROP POLICY IF EXISTS "anon_read_waiter_calls_scoped" ON public.waiter_calls;
DROP POLICY IF EXISTS "anon_read_feedback_blocked" ON public.customer_feedback;
DROP POLICY IF EXISTS "anon_cancel_early_orders" ON public.orders;

-- ============================================================
-- 3. Recreate the original USING(true) policies from 20260412000003
-- ============================================================

CREATE POLICY "anon_read_orders" ON public.orders
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_order_items" ON public.order_items
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_waiter_calls" ON public.waiter_calls
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_feedback" ON public.customer_feedback
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_tables" ON public.tables
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_categories" ON public.categories
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_menu_items" ON public.menu_items
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_cafe_settings" ON public.cafe_settings
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_update_cancel" ON public.orders
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (status = 'cancelled');
