-- Restrict overly permissive customer RLS policies
-- Previously all policies used USING(true) / WITH CHECK(true) which allowed
-- anonymous users to read/modify ANY data across ALL tables.
-- This migration adds constraints so anonymous users can only perform
-- safe, expected operations.

-- ============================================================
-- 1. DROP overly permissive UPDATE policies
-- ============================================================

DROP POLICY IF EXISTS "Anyone can update orders" ON orders;
DROP POLICY IF EXISTS "Anyone can update order items" ON order_items;
DROP POLICY IF EXISTS "Anyone can update tables" ON tables;

-- ============================================================
-- 2. DROP overly permissive INSERT policies and recreate with constraints
-- ============================================================

DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
DROP POLICY IF EXISTS "Anyone can add order items" ON order_items;
DROP POLICY IF EXISTS "Anyone can create waiter calls" ON waiter_calls;
DROP POLICY IF EXISTS "Anyone can create feedback" ON customer_feedback;

-- ============================================================
-- 3. Restricted INSERT policies
-- ============================================================

-- Orders: customers can only create orders with safe initial status
CREATE POLICY "Anon can create orders with safe defaults"
  ON orders FOR INSERT
  WITH CHECK (
    status IN ('pending_approval', 'new')
    AND source = 'customer'
  );

-- Order items: customers can only create items with pending status
CREATE POLICY "Anon can create pending order items"
  ON order_items FOR INSERT
  WITH CHECK (
    status = 'pending'
  );

-- Waiter calls: customers can only create pending calls
CREATE POLICY "Anon can create pending waiter calls"
  ON waiter_calls FOR INSERT
  WITH CHECK (
    status = 'pending'
  );

-- Customer feedback: customers can only create pending feedback
CREATE POLICY "Anon can create pending feedback"
  ON customer_feedback FOR INSERT
  WITH CHECK (
    status = 'pending'
  );

-- ============================================================
-- 4. Restricted UPDATE policies
-- ============================================================

-- Orders: anonymous can ONLY cancel orders that are in early stages
-- Cannot change paid/served orders or set arbitrary statuses
CREATE POLICY "Anon can cancel early-stage orders"
  ON orders FOR UPDATE
  USING (status IN ('pending_approval', 'new'))
  WITH CHECK (status = 'cancelled');

-- Order items: anonymous can ONLY cancel pending items
-- Cannot modify items that are already being prepared/served
CREATE POLICY "Anon can cancel pending order items"
  ON order_items FOR UPDATE
  USING (status = 'pending')
  WITH CHECK (status = 'cancelled');

-- Tables: anonymous can ONLY free occupied tables (when last order cancelled)
-- Cannot set tables to reserved, closed, or other statuses
CREATE POLICY "Anon can free occupied tables"
  ON tables FOR UPDATE
  USING (status = 'occupied')
  WITH CHECK (status = 'free');
