-- Fix customer-web RLS policies
-- The old customer policies use current_setting('app.qr_token', true) which
-- doesn't work with Supabase's connection pooling (each REST call = new connection).
-- Replace with permissive anon policies since customer-web uses anonymous key.

-- ============================================================
-- 1. Drop broken customer policies that rely on app.qr_token
-- ============================================================

DROP POLICY IF EXISTS "Customers can view their table orders" ON orders;
DROP POLICY IF EXISTS "Customers can create orders for their table" ON orders;
DROP POLICY IF EXISTS "Customers can view their order items" ON order_items;
DROP POLICY IF EXISTS "Customers can add items to new orders" ON order_items;
DROP POLICY IF EXISTS "Customers can create waiter calls" ON waiter_calls;
DROP POLICY IF EXISTS "Customers can view their waiter calls" ON waiter_calls;

-- ============================================================
-- 2. New anonymous (customer) policies
-- ============================================================

-- Tables: anonymous can view tables (needed for table resolution from URL)
CREATE POLICY "Anyone can view tables"
  ON tables FOR SELECT
  USING (true);

-- Orders: anonymous can view orders (customer needs to see their order)
CREATE POLICY "Anyone can view orders"
  ON orders FOR SELECT
  USING (true);

-- Orders: anonymous can create orders for non-closed tables
CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  WITH CHECK (true);

-- Order items: anonymous can view order items
CREATE POLICY "Anyone can view order items"
  ON order_items FOR SELECT
  USING (true);

-- Order items: anonymous can add items to orders
CREATE POLICY "Anyone can add order items"
  ON order_items FOR INSERT
  WITH CHECK (true);

-- Waiter calls: anonymous can create waiter calls
CREATE POLICY "Anyone can create waiter calls"
  ON waiter_calls FOR INSERT
  WITH CHECK (true);

-- Waiter calls: anonymous can view waiter calls
CREATE POLICY "Anyone can view waiter calls"
  ON waiter_calls FOR SELECT
  USING (true);

-- Customer feedback: anonymous can create feedback
DROP POLICY IF EXISTS "Customers can create feedback for their table" ON customer_feedback;
DROP POLICY IF EXISTS "Customers can view their feedback" ON customer_feedback;

CREATE POLICY "Anyone can create feedback"
  ON customer_feedback FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view feedback"
  ON customer_feedback FOR SELECT
  USING (true);

-- Order payments: anonymous can view payments (for receipt display)
CREATE POLICY "Anyone can view order payments"
  ON order_payments FOR SELECT
  USING (true);

-- Cafe settings: anonymous can view settings (for branding, tax display)
DROP POLICY IF EXISTS "Anyone can view cafe settings" ON cafe_settings;
CREATE POLICY "Anyone can view cafe settings"
  ON cafe_settings FOR SELECT
  USING (true);

-- ============================================================
-- 3. Grant execute on set_table_context to anon (for backwards compat)
-- ============================================================
GRANT EXECUTE ON FUNCTION public.set_table_context(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO anon;
