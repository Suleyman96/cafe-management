-- Migration: Upgrade all monetary/quantity columns to NUMERIC(14,4)
-- Supports high-denomination currencies (VND, IDR) and fractional pricing.
-- NUMERIC(14,4) allows values up to 9,999,999,999.9999
-- Date: 2026-04-18

BEGIN;

-- ========================================
-- 1. Drop dependent views
-- ========================================

DROP VIEW IF EXISTS active_orders_view CASCADE;
DROP VIEW IF EXISTS sales_summary_view CASCADE;
DROP VIEW IF EXISTS order_payment_summary CASCADE;

-- ========================================
-- 2. Drop column-specific trigger that blocks ALTER on discount_value
-- ========================================

DROP TRIGGER IF EXISTS recalculate_on_discount_change ON public.orders;

-- ========================================
-- 3. Upgrade columns still at DECIMAL(10,2)
-- ========================================

ALTER TABLE menu_items ALTER COLUMN price TYPE NUMERIC(14,4);
ALTER TABLE cafe_settings ALTER COLUMN minimum_order_amount TYPE NUMERIC(14,4);
ALTER TABLE cafe_settings ALTER COLUMN delivery_fee_default TYPE NUMERIC(14,4);
ALTER TABLE cafe_settings ALTER COLUMN minimum_delivery_amount TYPE NUMERIC(14,4);
ALTER TABLE cafe_settings ALTER COLUMN tax_percentage TYPE NUMERIC(7,4);
ALTER TABLE refunds ALTER COLUMN amount TYPE NUMERIC(14,4);
ALTER TABLE orders ALTER COLUMN discount_value TYPE NUMERIC(14,4);
ALTER TABLE orders ALTER COLUMN discount_amount TYPE NUMERIC(14,4);

-- ========================================
-- 3. Upgrade columns already at NUMERIC(12,2)
-- ========================================

ALTER TABLE orders ALTER COLUMN subtotal TYPE NUMERIC(14,4);
ALTER TABLE orders ALTER COLUMN tax TYPE NUMERIC(14,4);
ALTER TABLE orders ALTER COLUMN total TYPE NUMERIC(14,4);
ALTER TABLE orders ALTER COLUMN delivery_fee TYPE NUMERIC(14,4);
ALTER TABLE order_items ALTER COLUMN item_price TYPE NUMERIC(14,4);
ALTER TABLE order_payments ALTER COLUMN amount TYPE NUMERIC(14,4);
ALTER TABLE order_payments ALTER COLUMN tip_amount TYPE NUMERIC(14,4);
ALTER TABLE stock_items ALTER COLUMN quantity TYPE NUMERIC(14,4);
ALTER TABLE stock_items ALTER COLUMN cost_price TYPE NUMERIC(14,4);
ALTER TABLE stock_items ALTER COLUMN minimum_stock_level TYPE NUMERIC(14,4);
ALTER TABLE stock_movements ALTER COLUMN quantity_change TYPE NUMERIC(14,4);
ALTER TABLE stock_movements ALTER COLUMN quantity_after TYPE NUMERIC(14,4);
ALTER TABLE expenses ALTER COLUMN amount TYPE NUMERIC(14,4);
ALTER TABLE waste_logs ALTER COLUMN quantity TYPE NUMERIC(14,4);
ALTER TABLE waste_logs ALTER COLUMN cost_per_unit TYPE NUMERIC(14,4);
ALTER TABLE waste_logs ALTER COLUMN total_cost TYPE NUMERIC(14,4);

-- ========================================
-- 4. Recreate calculate_order_total with NUMERIC(14,4) local vars
-- ========================================

CREATE OR REPLACE FUNCTION public.calculate_order_total(order_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  calculated_subtotal NUMERIC(14, 4);
  calculated_tax NUMERIC(14, 4);
  calculated_total NUMERIC(14, 4);
  order_discount_type VARCHAR(10);
  order_discount_value NUMERIC(14, 4);
  calculated_discount NUMERIC(14, 4);
  order_delivery_fee NUMERIC(14, 4);
  settings_tax_enabled BOOLEAN;
  settings_tax_percentage NUMERIC(7, 4);
  taxable_amount NUMERIC(14, 4);
BEGIN
  SELECT tax_enabled, tax_percentage
  INTO settings_tax_enabled, settings_tax_percentage
  FROM public.cafe_settings
  LIMIT 1;

  SELECT COALESCE(SUM(item_price * quantity), 0)
  INTO calculated_subtotal
  FROM public.order_items
  WHERE order_id = order_uuid
    AND status != 'cancelled';

  -- Get discount info and delivery fee from the order
  SELECT
    COALESCE(discount_type, 'none'),
    COALESCE(discount_value, 0),
    COALESCE(delivery_fee, 0)
  INTO order_discount_type, order_discount_value, order_delivery_fee
  FROM public.orders
  WHERE id = order_uuid;

  -- Calculate discount amount (cannot exceed subtotal)
  IF order_discount_type = 'percentage' THEN
    calculated_discount := LEAST(calculated_subtotal, calculated_subtotal * order_discount_value / 100);
  ELSIF order_discount_type = 'fixed' THEN
    calculated_discount := LEAST(calculated_subtotal, order_discount_value);
  ELSE
    calculated_discount := 0;
  END IF;

  taxable_amount := calculated_subtotal - calculated_discount;

  IF settings_tax_enabled = true AND settings_tax_percentage > 0 THEN
    calculated_tax := taxable_amount * (settings_tax_percentage / 100);
    calculated_total := taxable_amount + calculated_tax + order_delivery_fee;
  ELSE
    calculated_tax := 0;
    calculated_total := taxable_amount + order_delivery_fee;
  END IF;

  UPDATE public.orders
  SET
    subtotal = calculated_subtotal,
    tax = calculated_tax,
    discount_amount = calculated_discount,
    total = calculated_total,
    updated_at = NOW()
  WHERE id = order_uuid;
END;
$$;

-- ========================================
-- 5. Recreate validate_refund_amount with NUMERIC(14,4) local vars
-- ========================================

CREATE OR REPLACE FUNCTION public.validate_refund_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  total_paid NUMERIC(14, 4);
  total_refunded NUMERIC(14, 4);
  available NUMERIC(14, 4);
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.order_payments
  WHERE order_id = NEW.order_id;

  SELECT COALESCE(SUM(amount), 0) INTO total_refunded
  FROM public.refunds
  WHERE order_id = NEW.order_id;

  available := total_paid - total_refunded;

  IF NEW.amount > available THEN
    RAISE EXCEPTION 'Refund amount (%) exceeds available amount (%)',
      NEW.amount, available;
  END IF;

  RETURN NEW;
END;
$$;

-- ========================================
-- 6. Recreate get_order_remaining_balance with NUMERIC(14,4)
-- ========================================

CREATE OR REPLACE FUNCTION public.get_order_remaining_balance(order_uuid UUID)
RETURNS NUMERIC(14, 4)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  order_total NUMERIC(14, 4);
  paid_amount NUMERIC(14, 4);
  refunded_amount NUMERIC(14, 4);
BEGIN
  SELECT total INTO order_total
  FROM public.orders
  WHERE id = order_uuid;

  IF order_total IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', order_uuid;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO paid_amount
  FROM public.order_payments
  WHERE order_id = order_uuid;

  SELECT COALESCE(SUM(amount), 0) INTO refunded_amount
  FROM public.refunds
  WHERE order_id = order_uuid;

  RETURN order_total - paid_amount + refunded_amount;
END;
$$;

-- ========================================
-- 7. Recreate views
-- ========================================

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

-- ========================================
-- 8. Recreate column-specific trigger dropped in step 2
-- ========================================

CREATE OR REPLACE TRIGGER recalculate_on_discount_change
  AFTER UPDATE OF discount_type, discount_value ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_on_discount_change();

COMMIT;
