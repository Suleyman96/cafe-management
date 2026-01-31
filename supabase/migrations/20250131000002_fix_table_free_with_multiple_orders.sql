-- Migration: Fix table freeing to check for other active orders
-- When an order is closed or cancelled, only free the table if there are no other active orders

CREATE OR REPLACE FUNCTION update_order_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  remaining DECIMAL(10, 2);
  total_paid DECIMAL(10, 2);
  order_table_id UUID;
  other_active_orders INTEGER;
BEGIN
  -- Calculate total paid amount
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM order_payments
  WHERE order_id = NEW.order_id;

  -- Calculate remaining balance
  remaining := get_order_remaining_balance(NEW.order_id);

  -- If fully paid, update order and potentially free table
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

    -- Free the table only if there are no other active orders
    IF order_table_id IS NOT NULL THEN
      -- Count other active orders on this table
      SELECT COUNT(*) INTO other_active_orders
      FROM orders
      WHERE table_id = order_table_id
        AND id != NEW.order_id
        AND status IN ('pending_approval', 'new', 'preparing', 'ready', 'served');

      -- Only free the table if no other active orders exist
      IF other_active_orders = 0 THEN
        UPDATE tables
        SET
          status = 'free',
          current_session_id = NULL,
          occupied_at = NULL,
          updated_at = NOW()
        WHERE id = order_table_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_order_payment_status IS 'Automatically close order and free table when fully paid (only if no other active orders)';
