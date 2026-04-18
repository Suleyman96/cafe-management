-- Migration: Row Level Security policies for new tables
-- Date: 2025-01-02

-- ========================================
-- 1. RLS for customer_feedback table
-- ========================================

ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;

-- Customers can create feedback for their table
CREATE POLICY "Customers can create feedback for their table"
  ON customer_feedback FOR INSERT
  WITH CHECK (
    table_id IN (
      SELECT id FROM tables 
      WHERE qr_code = current_setting('app.qr_token', true)
    )
  );

-- Customers can view their own feedback
CREATE POLICY "Customers can view their feedback"
  ON customer_feedback FOR SELECT
  USING (
    table_id IN (
      SELECT id FROM tables 
      WHERE qr_code = current_setting('app.qr_token', true)
    )
  );

-- Staff can view all feedback
CREATE POLICY "Staff can view all feedback"
  ON customer_feedback FOR SELECT
  TO authenticated
  USING (true);

-- Staff can update feedback (acknowledge, respond, resolve)
CREATE POLICY "Staff can update feedback"
  ON customer_feedback FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin')
    )
  );

-- Only admins can delete feedback
CREATE POLICY "Admins can delete feedback"
  ON customer_feedback FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- ========================================
-- 2. RLS for order_payments table
-- ========================================

ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;

-- Only staff (waiters/admins) can create payments
CREATE POLICY "Staff can create payments"
  ON order_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin')
      AND id = received_by -- Must be receiving payment for themselves
    )
  );

-- Staff can view all payments
CREATE POLICY "Staff can view all payments"
  ON order_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin', 'kitchen')
    )
  );

-- Only admins can delete payments (for corrections)
CREATE POLICY "Admins can delete payments"
  ON order_payments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- ========================================
-- 3. RLS for table_transfers table
-- ========================================

ALTER TABLE table_transfers ENABLE ROW LEVEL SECURITY;

-- Staff can view all transfers
CREATE POLICY "Staff can view table transfers"
  ON table_transfers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
    )
  );

-- Only waiters and admins can create transfers (via function)
-- Note: Transfers should be done via transfer_table() function
CREATE POLICY "Staff can log transfers"
  ON table_transfers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('waiter', 'admin')
    )
  );

-- Only admins can delete transfer records
CREATE POLICY "Admins can delete transfers"
  ON table_transfers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- ========================================
-- 4. Update existing waiter_calls RLS
-- ========================================

-- Add policy for high-priority calls (emergency)
CREATE POLICY "High priority calls notify all staff"
  ON waiter_calls FOR SELECT
  TO authenticated
  USING (
    priority IN ('high', 'urgent') OR
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
    )
  );

-- ========================================
-- 5. Grant execute permissions on functions
-- ========================================

-- Allow authenticated users to call transfer_table function
GRANT EXECUTE ON FUNCTION transfer_table TO authenticated;

-- Allow anyone to call get_order_remaining_balance
GRANT EXECUTE ON FUNCTION get_order_remaining_balance TO authenticated, anon;

-- ========================================
-- 6. Create view for order payment summary
-- ========================================

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

-- Grant access to view
GRANT SELECT ON order_payment_summary TO authenticated;

COMMENT ON VIEW order_payment_summary IS 'Summary of order payments with remaining balance';


