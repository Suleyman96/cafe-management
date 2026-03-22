-- ============================================================
-- Migration: Add missing indexes and data type consistency fixes
-- Date: 2026-03-22
-- Purpose:
--   1. Add composite indexes for hot query paths
--   2. Standardize DECIMAL(10,2) → NUMERIC(12,2)
--   3. Enforce cafe_settings single-row at DDL level
-- ============================================================

-- ─── 1. Missing Composite Indexes ───────────────────────────────

-- Dashboard orders list (filtered by status, sorted by date)
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON orders (status, created_at DESC);

-- Active orders for a specific table
CREATE INDEX IF NOT EXISTS idx_orders_table_status
  ON orders (table_id, status);

-- Staff role checks (used in every RLS policy via get_my_staff_role())
CREATE INDEX IF NOT EXISTS idx_staff_role_active
  ON staff (role, is_active);

-- Menu display query (available items in display order)
CREATE INDEX IF NOT EXISTS idx_menu_items_available_order
  ON menu_items (is_available, display_order);

-- Category-filtered menu
CREATE INDEX IF NOT EXISTS idx_menu_items_category_available
  ON menu_items (category_id, is_available);

-- Payment history for an order
CREATE INDEX IF NOT EXISTS idx_order_payments_order_created
  ON order_payments (order_id, created_at DESC);

-- Stock movement history
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_created
  ON stock_movements (stock_item_id, created_at DESC);

-- ─── 2. Standardize Decimal Precision ───────────────────────────
-- stock/expenses already fixed in migration 20250222000002
-- Fix remaining order-related tables for consistency
--
-- Views that depend on these columns must be dropped first, then recreated.

-- Drop dependent views
DROP VIEW IF EXISTS active_orders_view CASCADE;
DROP VIEW IF EXISTS sales_summary_view CASCADE;
DROP VIEW IF EXISTS order_payment_summary CASCADE;

-- Alter column types
ALTER TABLE orders ALTER COLUMN subtotal TYPE NUMERIC(12,2);
ALTER TABLE orders ALTER COLUMN tax TYPE NUMERIC(12,2);
ALTER TABLE orders ALTER COLUMN total TYPE NUMERIC(12,2);
ALTER TABLE orders ALTER COLUMN delivery_fee TYPE NUMERIC(12,2);
ALTER TABLE order_items ALTER COLUMN item_price TYPE NUMERIC(12,2);
ALTER TABLE order_payments ALTER COLUMN amount TYPE NUMERIC(12,2);
ALTER TABLE order_payments ALTER COLUMN tip_amount TYPE NUMERIC(12,2);

-- Recreate active_orders_view
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
  EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60 AS minutes_elapsed,
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
GROUP BY o.id, t.id, s.id
ORDER BY o.created_at ASC;

GRANT SELECT ON active_orders_view TO authenticated;
GRANT SELECT ON active_orders_view TO anon;
ALTER VIEW active_orders_view SET (security_invoker = on);

-- Recreate sales_summary_view
CREATE OR REPLACE VIEW sales_summary_view AS
SELECT
  DATE(created_at) AS date,
  COUNT(DISTINCT id) AS order_count,
  SUM(total) AS total_revenue,
  AVG(total) AS average_order_value,
  COUNT(DISTINCT table_id) AS tables_served,
  AVG(EXTRACT(EPOCH FROM (served_at - created_at)) / 60) AS avg_service_time_minutes
FROM orders
WHERE status = 'closed'
  AND closed_at IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;

GRANT SELECT ON sales_summary_view TO authenticated;
ALTER VIEW sales_summary_view SET (security_invoker = on);

-- Recreate order_payment_summary
CREATE OR REPLACE VIEW order_payment_summary AS
SELECT
  o.id AS order_id,
  o.order_number,
  o.total AS order_total,
  COALESCE(SUM(op.amount), 0) AS paid_amount,
  o.total - COALESCE(SUM(op.amount), 0) AS remaining_balance,
  COUNT(op.id) AS payment_count,
  json_agg(
    json_build_object(
      'payment_id', op.id,
      'amount', op.amount,
      'payment_method', op.payment_method,
      'received_by', s.full_name,
      'created_at', op.created_at
    ) ORDER BY op.created_at
  ) FILTER (WHERE op.id IS NOT NULL) AS payments
FROM orders o
LEFT JOIN order_payments op ON o.id = op.order_id
LEFT JOIN staff s ON op.received_by = s.id
GROUP BY o.id, o.order_number, o.total;

GRANT SELECT ON order_payment_summary TO authenticated;
ALTER VIEW order_payment_summary SET (security_invoker = on);

-- ─── 3. Enforce cafe_settings Single Row at DDL Level ───────────
-- The trigger-based enforcement is fragile under concurrent inserts.
-- This CHECK constraint ensures only the known singleton ID can exist.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cafe_settings_single_row_check'
  ) THEN
    ALTER TABLE cafe_settings
      ADD CONSTRAINT cafe_settings_single_row_check
      CHECK (id = '00000000-0000-0000-0000-000000000001');
  END IF;
END $$;
