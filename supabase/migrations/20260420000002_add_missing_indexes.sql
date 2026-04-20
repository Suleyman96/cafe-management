-- Add missing composite indexes for common query patterns

-- Waiter calls: findByTable queries filter on (table_id, status) and sort by created_at
CREATE INDEX IF NOT EXISTS idx_waiter_calls_table_status
  ON waiter_calls (table_id, status, created_at DESC);

-- Order payments: payment history lookups by order with chronological ordering
CREATE INDEX IF NOT EXISTS idx_order_payments_order_created
  ON order_payments (order_id, created_at);
