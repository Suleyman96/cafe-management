-- Add source column to orders table to track where the order came from
-- Values: 'customer' (QR code), 'waiter' (staff created), 'phone' (phone order)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'waiter';

-- Add index for filtering by source
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);

-- Update any existing orders to have source='waiter' (they were likely created by staff)
UPDATE orders SET source = 'waiter' WHERE source IS NULL;

-- Comment explaining the column
COMMENT ON COLUMN orders.source IS 'Order source: customer (QR code), waiter (staff created), phone (phone order)';
