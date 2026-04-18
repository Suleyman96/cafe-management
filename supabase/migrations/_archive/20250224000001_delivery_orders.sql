-- Delivery Orders: Add delivery support to orders and cafe settings

-- 1. Add 'delivery' to order_type check constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_type_check
  CHECK (order_type IN ('dine_in', 'takeout', 'delivery'));

-- 1b. Update dine_in_table_check to allow delivery orders (table_id IS NULL)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_dine_in_table_check;
ALTER TABLE orders ADD CONSTRAINT orders_dine_in_table_check
  CHECK (
    (order_type = 'dine_in' AND table_id IS NOT NULL) OR
    (order_type = 'takeout' AND table_id IS NULL) OR
    (order_type = 'delivery' AND table_id IS NULL)
  );

-- 1c. Update takeout_customer_check to also allow delivery orders
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_takeout_customer_check;
ALTER TABLE orders ADD CONSTRAINT orders_takeout_customer_check
  CHECK (
    (order_type = 'takeout' AND customer_name IS NOT NULL AND customer_phone IS NOT NULL) OR
    (order_type = 'delivery' AND customer_name IS NOT NULL AND customer_phone IS NOT NULL) OR
    (order_type = 'dine_in')
  );

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
