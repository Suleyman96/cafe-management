-- Delivery Orders: Add delivery support to orders and cafe settings

-- 1. Add 'delivery' to order_type check constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_type_check
  CHECK (order_type IN ('dine_in', 'takeout', 'delivery'));

-- 2. Add delivery statuses to order status check constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending_approval', 'new', 'preparing', 'ready', 'served', 'out_for_delivery', 'delivered', 'closed', 'cancelled'));

-- 3. Add delivery columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_time TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_person_id UUID REFERENCES staff(id);

-- 4. Add delivery settings to cafe_settings
ALTER TABLE cafe_settings ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN DEFAULT false;
ALTER TABLE cafe_settings ADD COLUMN IF NOT EXISTS delivery_fee_default DECIMAL(10,2) DEFAULT 0;
ALTER TABLE cafe_settings ADD COLUMN IF NOT EXISTS minimum_delivery_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE cafe_settings ADD COLUMN IF NOT EXISTS delivery_zone_info TEXT;
