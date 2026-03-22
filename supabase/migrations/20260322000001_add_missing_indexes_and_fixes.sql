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

ALTER TABLE orders ALTER COLUMN subtotal TYPE NUMERIC(12,2);
ALTER TABLE orders ALTER COLUMN tax TYPE NUMERIC(12,2);
ALTER TABLE orders ALTER COLUMN total TYPE NUMERIC(12,2);
ALTER TABLE orders ALTER COLUMN delivery_fee TYPE NUMERIC(12,2);
ALTER TABLE order_items ALTER COLUMN item_price TYPE NUMERIC(12,2);
ALTER TABLE order_payments ALTER COLUMN amount TYPE NUMERIC(12,2);
ALTER TABLE order_payments ALTER COLUMN tip_amount TYPE NUMERIC(12,2);

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
