-- Fix order_number column length
-- The generate_order_number function creates 'ORD' + YYMMDD (6) + counter (3) = 12 chars
-- But column was only VARCHAR(10)

-- Drop dependent views
DROP VIEW IF EXISTS order_payment_summary;
DROP VIEW IF EXISTS active_orders_view;

-- Alter the column
ALTER TABLE orders ALTER COLUMN order_number TYPE VARCHAR(15);

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

-- Recreate order_payment_summary view
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
