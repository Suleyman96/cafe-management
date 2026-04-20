-- Migration: Add tip support to payment system
-- Allows staff to collect tips during payment

-- Add tip_amount column to order_payments
ALTER TABLE order_payments
ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10, 2) DEFAULT 0;

-- Add tips_enabled toggle to cafe_settings
ALTER TABLE cafe_settings
ADD COLUMN IF NOT EXISTS tips_enabled BOOLEAN DEFAULT false;

-- Comments for documentation
COMMENT ON COLUMN order_payments.tip_amount IS 'Tip/gratuity amount for this payment';
COMMENT ON COLUMN cafe_settings.tips_enabled IS 'Enable tip collection during payment';
