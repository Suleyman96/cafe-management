-- Migration: Functions and triggers for payment and table transfer features
-- Date: 2025-01-02

-- ========================================
-- 1. Function: Get order remaining balance
-- ========================================

CREATE OR REPLACE FUNCTION get_order_remaining_balance(order_uuid UUID)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  order_total DECIMAL(10, 2);
  paid_amount DECIMAL(10, 2);
BEGIN
  -- Get order total
  SELECT total INTO order_total 
  FROM orders 
  WHERE id = order_uuid;
  
  IF order_total IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', order_uuid;
  END IF;
  
  -- Get sum of all payments for this order
  SELECT COALESCE(SUM(amount), 0) INTO paid_amount
  FROM order_payments 
  WHERE order_id = order_uuid;
  
  RETURN order_total - paid_amount;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_order_remaining_balance IS 'Calculate remaining balance for an order after all payments';

-- ========================================
-- 2. Function: Transfer table
-- ========================================

CREATE OR REPLACE FUNCTION transfer_table(
  p_order_id UUID,
  p_from_table_id UUID,
  p_to_table_id UUID,
  p_staff_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_order_status VARCHAR(20);
BEGIN
  -- Verify order exists and belongs to from_table
  SELECT status INTO v_order_status
  FROM orders 
  WHERE id = p_order_id AND table_id = p_from_table_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % does not belong to table %', p_order_id, p_from_table_id;
  END IF;
  
  -- Don't allow transfer if order is closed
  IF v_order_status = 'closed' OR v_order_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot transfer closed or cancelled order';
  END IF;
  
  -- Check if target table is free or reserved
  IF EXISTS (
    SELECT 1 FROM tables 
    WHERE id = p_to_table_id 
    AND status NOT IN ('free', 'reserved')
  ) THEN
    RAISE EXCEPTION 'Target table is not available';
  END IF;
  
  -- Update order table_id
  UPDATE orders 
  SET 
    table_id = p_to_table_id,
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Update source table status (free it up)
  UPDATE tables 
  SET 
    status = 'free',
    current_session_id = NULL,
    updated_at = NOW()
  WHERE id = p_from_table_id;
  
  -- Update target table status (occupy it)
  UPDATE tables 
  SET 
    status = 'occupied',
    current_session_id = p_order_id,
    occupied_at = NOW(),
    updated_at = NOW()
  WHERE id = p_to_table_id;
  
  -- Log the transfer
  INSERT INTO table_transfers (
    order_id,
    from_table_id,
    to_table_id,
    transferred_by,
    reason
  ) VALUES (
    p_order_id,
    p_from_table_id,
    p_to_table_id,
    p_staff_id,
    p_reason
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION transfer_table IS 'Transfer an order from one table to another';

-- ========================================
-- 3. Function: Validate payment amount
-- ========================================

CREATE OR REPLACE FUNCTION validate_payment_amount()
RETURNS TRIGGER AS $$
DECLARE
  remaining_balance DECIMAL(10, 2);
BEGIN
  -- Get remaining balance before this payment
  remaining_balance := get_order_remaining_balance(NEW.order_id);
  
  -- Check if payment exceeds remaining balance
  IF NEW.amount > remaining_balance THEN
    RAISE EXCEPTION 'Payment amount (%) exceeds remaining balance (%)', 
      NEW.amount, remaining_balance;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_payment_amount_trigger
  BEFORE INSERT ON order_payments
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_amount();

COMMENT ON FUNCTION validate_payment_amount IS 'Prevent overpayment on orders';

-- ========================================
-- 4. Function: Update order payment status
-- ========================================

CREATE OR REPLACE FUNCTION update_order_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  remaining DECIMAL(10, 2);
  total_paid DECIMAL(10, 2);
BEGIN
  -- Calculate total paid amount
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM order_payments
  WHERE order_id = NEW.order_id;
  
  -- Calculate remaining balance
  remaining := get_order_remaining_balance(NEW.order_id);
  
  -- If fully paid, update order
  IF remaining <= 0 THEN
    UPDATE orders 
    SET 
      paid_at = NOW(),
      payment_method = 'split',
      updated_at = NOW()
    WHERE id = NEW.order_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_order_payment_status_trigger
  AFTER INSERT ON order_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_order_payment_status();

COMMENT ON FUNCTION update_order_payment_status IS 'Automatically mark order as paid when fully paid';

-- ========================================
-- 5. Function: Validate specific items payment
-- ========================================

CREATE OR REPLACE FUNCTION validate_items_payment()
RETURNS TRIGGER AS $$
DECLARE
  items_total DECIMAL(10, 2);
  calculated_amount DECIMAL(10, 2);
BEGIN
  -- Only validate if payment_type is 'specific_items'
  IF NEW.payment_type = 'specific_items' THEN
    
    -- Ensure order_item_ids is provided
    IF NEW.order_item_ids IS NULL OR array_length(NEW.order_item_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'order_item_ids must be provided for specific_items payment';
    END IF;
    
    -- Calculate total for specified items
    SELECT COALESCE(SUM(item_price * quantity), 0) INTO calculated_amount
    FROM order_items
    WHERE id = ANY(NEW.order_item_ids)
    AND order_id = NEW.order_id;
    
    -- Verify amount matches items total
    IF NEW.amount != calculated_amount THEN
      RAISE EXCEPTION 'Payment amount (%) does not match items total (%)', 
        NEW.amount, calculated_amount;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_items_payment_trigger
  BEFORE INSERT ON order_payments
  FOR EACH ROW
  EXECUTE FUNCTION validate_items_payment();

COMMENT ON FUNCTION validate_items_payment IS 'Validate payment amount matches selected items total';

-- ========================================
-- 6. Function: Auto-acknowledge feedback
-- ========================================

CREATE OR REPLACE FUNCTION auto_acknowledge_feedback()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed to 'acknowledged', set timestamp
  IF NEW.status = 'acknowledged' AND OLD.status = 'pending' THEN
    NEW.acknowledged_at := NOW();
  END IF;
  
  -- If status changed to 'resolved', set timestamp
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_acknowledge_feedback_trigger
  BEFORE UPDATE ON customer_feedback
  FOR EACH ROW
  EXECUTE FUNCTION auto_acknowledge_feedback();

COMMENT ON FUNCTION auto_acknowledge_feedback IS 'Automatically set timestamps when feedback status changes';


