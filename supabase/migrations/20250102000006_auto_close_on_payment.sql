-- Migration: Auto-close order and free table when fully paid
-- When an order is fully paid, automatically:
-- 1. Set order status to 'closed'
-- 2. Set closed_at timestamp
-- 3. Free the associated table

CREATE OR REPLACE FUNCTION update_order_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  remaining DECIMAL(10, 2);
  total_paid DECIMAL(10, 2);
  order_table_id UUID;
BEGIN
  -- Calculate total paid amount
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM order_payments
  WHERE order_id = NEW.order_id;

  -- Calculate remaining balance
  remaining := get_order_remaining_balance(NEW.order_id);

  -- If fully paid, update order and free table
  IF remaining <= 0 THEN
    -- Get the table_id for this order
    SELECT table_id INTO order_table_id
    FROM orders
    WHERE id = NEW.order_id;

    -- Update order to closed status
    UPDATE orders
    SET
      status = 'closed',
      paid_at = NOW(),
      closed_at = NOW(),
      payment_method = 'split',
      updated_at = NOW()
    WHERE id = NEW.order_id;

    -- Free the table if there was one
    IF order_table_id IS NOT NULL THEN
      UPDATE tables
      SET
        status = 'free',
        current_session_id = NULL,
        updated_at = NOW()
      WHERE id = order_table_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_order_payment_status IS 'Automatically close order and free table when fully paid';
