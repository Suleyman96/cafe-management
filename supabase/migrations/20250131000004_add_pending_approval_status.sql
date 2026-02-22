-- Migration: Add pending_approval status and source column for QR order approval workflow
-- This allows customer QR orders to require staff approval before going to kitchen

-- Add source column to track order origin (customer QR, waiter, phone)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'waiter';

-- Create index for source filtering
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);

-- Drop the old status constraint and add the new one with pending_approval
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check
CHECK (status IN ('pending_approval', 'new', 'preparing', 'ready', 'served', 'closed', 'cancelled'));

COMMENT ON COLUMN orders.source IS 'Order origin: customer (QR code), waiter (staff), phone (call-in)';
