-- Fix: Replace anon INSERT/UPDATE policies that rely on the transaction-local
-- session variable (app.current_tenant_id) set by set_table_context().
-- Each Supabase JS HTTP request runs in a separate transaction, so the variable
-- is always empty when the INSERT/UPDATE runs. Instead, validate tenant_id
-- against the related table's tenant (for dine-in) or check tenant exists
-- (for delivery).

-- ============================================================
-- 1. Orders — anon INSERT
-- ============================================================
DROP POLICY IF EXISTS "anon_insert_via_context" ON public.orders;

CREATE POLICY "anon_insert_orders" ON public.orders
  FOR INSERT TO anon
  WITH CHECK (
    -- Dine-in: tenant_id must match the table's tenant
    (table_id IS NOT NULL AND tenant_id = (SELECT t.tenant_id FROM public.tables t WHERE t.id = table_id))
    OR
    -- Delivery/takeout (no table): tenant must exist
    (table_id IS NULL AND EXISTS (SELECT 1 FROM public.tenants WHERE id = tenant_id))
  );

-- ============================================================
-- 2. Orders — anon UPDATE (cancel only)
-- ============================================================
DROP POLICY IF EXISTS "anon_update_cancel" ON public.orders;

CREATE POLICY "anon_update_cancel" ON public.orders
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (status = 'cancelled');

-- ============================================================
-- 3. Order items — anon INSERT
-- ============================================================
DROP POLICY IF EXISTS "anon_insert_via_context" ON public.order_items;

CREATE POLICY "anon_insert_order_items" ON public.order_items
  FOR INSERT TO anon
  WITH CHECK (
    tenant_id = (SELECT o.tenant_id FROM public.orders o WHERE o.id = order_id)
  );

-- ============================================================
-- 4. Waiter calls — anon INSERT
-- ============================================================
DROP POLICY IF EXISTS "anon_insert_via_context" ON public.waiter_calls;

CREATE POLICY "anon_insert_waiter_calls" ON public.waiter_calls
  FOR INSERT TO anon
  WITH CHECK (
    tenant_id = (SELECT t.tenant_id FROM public.tables t WHERE t.id = table_id)
  );

-- ============================================================
-- 5. Customer feedback — anon INSERT
-- ============================================================
DROP POLICY IF EXISTS "anon_insert_via_context" ON public.customer_feedback;

CREATE POLICY "anon_insert_feedback" ON public.customer_feedback
  FOR INSERT TO anon
  WITH CHECK (
    tenant_id = (SELECT t.tenant_id FROM public.tables t WHERE t.id = table_id)
  );

-- ============================================================
-- 6. Fix anon SELECT policies for orders/order_items/waiter_calls/feedback
--    The current anon_read_via_context policies also rely on the broken
--    session variable. Add permissive read policies so customers can see
--    their order status.
-- ============================================================

-- Orders: customers need to read orders by table_id
DROP POLICY IF EXISTS "anon_read_via_context" ON public.orders;
CREATE POLICY "anon_read_orders" ON public.orders
  FOR SELECT TO anon
  USING (true);

-- Order items: customers need to see items in their order
DROP POLICY IF EXISTS "anon_read_via_context" ON public.order_items;
CREATE POLICY "anon_read_order_items" ON public.order_items
  FOR SELECT TO anon
  USING (true);

-- Waiter calls: customers need to see pending calls for their table
DROP POLICY IF EXISTS "anon_read_via_context" ON public.waiter_calls;
CREATE POLICY "anon_read_waiter_calls" ON public.waiter_calls
  FOR SELECT TO anon
  USING (true);

-- Customer feedback: no read needed for anon, but keep permissive for safety
DROP POLICY IF EXISTS "anon_read_via_context" ON public.customer_feedback;
CREATE POLICY "anon_read_feedback" ON public.customer_feedback
  FOR SELECT TO anon
  USING (true);

-- Tables: already has old "Anyone can view" policy, but fix the broken one
DROP POLICY IF EXISTS "anon_read_via_context" ON public.tables;
CREATE POLICY "anon_read_tables" ON public.tables
  FOR SELECT TO anon
  USING (true);

-- Categories: already has old "Anyone can view" policy
DROP POLICY IF EXISTS "anon_read_via_context" ON public.categories;
CREATE POLICY "anon_read_categories" ON public.categories
  FOR SELECT TO anon
  USING (true);

-- Menu items: already has old "Anyone can view" policy
DROP POLICY IF EXISTS "anon_read_via_context" ON public.menu_items;
CREATE POLICY "anon_read_menu_items" ON public.menu_items
  FOR SELECT TO anon
  USING (true);

-- Cafe settings: already has old "Anyone can view" policy
DROP POLICY IF EXISTS "anon_read_via_context" ON public.cafe_settings;
CREATE POLICY "anon_read_cafe_settings" ON public.cafe_settings
  FOR SELECT TO anon
  USING (true);
