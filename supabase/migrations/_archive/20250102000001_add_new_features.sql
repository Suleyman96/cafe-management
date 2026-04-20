-- Migration: Add new features tables and columns
-- Date: 2025-01-02
-- Features: Split payments, table transfers, take-out orders, customer feedback

-- ========================================
-- 1. Enhance waiter_calls table
-- ========================================

ALTER TABLE waiter_calls 
ADD COLUMN IF NOT EXISTS call_type VARCHAR(50) DEFAULT 'assistance',
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';

COMMENT ON COLUMN waiter_calls.call_type IS 'assistance, bill, complaint, question, emergency';
COMMENT ON COLUMN waiter_calls.priority IS 'low, normal, high, urgent';

-- ========================================
-- 2. Create customer_feedback table
-- ========================================

CREATE TABLE IF NOT EXISTS customer_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  feedback_type VARCHAR(50) NOT NULL CHECK (
    feedback_type IN (
      'complaint_food',
      'complaint_service', 
      'complaint_staff',
      'question_menu',
      'request_general',
      'praise'
    )
  ),
  
  subject VARCHAR(255),
  message TEXT NOT NULL,
  
  status VARCHAR(20) DEFAULT 'pending' CHECK (
    status IN ('pending', 'acknowledged', 'resolved', 'dismissed')
  ),
  
  responded_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  response TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_customer_feedback_status ON customer_feedback(status);
CREATE INDEX idx_customer_feedback_table ON customer_feedback(table_id);
CREATE INDEX idx_customer_feedback_type ON customer_feedback(feedback_type);
CREATE INDEX idx_customer_feedback_created ON customer_feedback(created_at DESC);

COMMENT ON TABLE customer_feedback IS 'Customer complaints, questions, and general feedback';

-- ========================================
-- 3. Create order_payments table
-- ========================================

CREATE TABLE IF NOT EXISTS order_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  received_by UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  
  payment_type VARCHAR(20) NOT NULL CHECK (
    payment_type IN ('full', 'partial_amount', 'specific_items')
  ),
  
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(20) NOT NULL CHECK (
    payment_method IN ('cash', 'card', 'digital')
  ),
  
  -- For item-specific payments (array of order_item IDs)
  order_item_ids UUID[],
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_payments_order ON order_payments(order_id);
CREATE INDEX idx_order_payments_staff ON order_payments(received_by);
CREATE INDEX idx_order_payments_created ON order_payments(created_at DESC);

COMMENT ON TABLE order_payments IS 'Track split payments received by different waiters';
COMMENT ON COLUMN order_payments.order_item_ids IS 'Array of order_item IDs when payment_type is specific_items';

-- ========================================
-- 4. Create table_transfers table
-- ========================================

CREATE TABLE IF NOT EXISTS table_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_table_id UUID NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
  to_table_id UUID NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
  transferred_by UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT different_tables CHECK (from_table_id != to_table_id)
);

CREATE INDEX idx_table_transfers_order ON table_transfers(order_id);
CREATE INDEX idx_table_transfers_from ON table_transfers(from_table_id);
CREATE INDEX idx_table_transfers_to ON table_transfers(to_table_id);
CREATE INDEX idx_table_transfers_created ON table_transfers(created_at DESC);

COMMENT ON TABLE table_transfers IS 'History of table transfers for orders';

-- ========================================
-- 5. Modify orders table for take-out
-- ========================================

-- Add order_type column
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'dine_in' CHECK (
  order_type IN ('dine_in', 'takeout')
);

-- Add customer info for takeout orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20);

-- Make table_id nullable (required for takeout orders)
ALTER TABLE orders ALTER COLUMN table_id DROP NOT NULL;

-- Add constraint: dine_in orders must have table_id
ALTER TABLE orders 
ADD CONSTRAINT orders_dine_in_table_check 
CHECK (
  (order_type = 'dine_in' AND table_id IS NOT NULL) OR
  (order_type = 'takeout' AND table_id IS NULL)
);

-- Add constraint: takeout orders must have customer info
ALTER TABLE orders 
ADD CONSTRAINT orders_takeout_customer_check 
CHECK (
  (order_type = 'takeout' AND customer_name IS NOT NULL AND customer_phone IS NOT NULL) OR
  (order_type = 'dine_in')
);

CREATE INDEX idx_orders_type ON orders(order_type);

COMMENT ON COLUMN orders.order_type IS 'dine_in or takeout';
COMMENT ON COLUMN orders.customer_name IS 'Required for takeout orders';
COMMENT ON COLUMN orders.customer_phone IS 'Required for takeout orders';

-- ========================================
-- 6. Add index for order_items notes
-- ========================================

CREATE INDEX IF NOT EXISTS idx_order_items_with_notes ON order_items(order_id) 
WHERE notes IS NOT NULL;

COMMENT ON INDEX idx_order_items_with_notes IS 'Optimize queries for items with special notes';


