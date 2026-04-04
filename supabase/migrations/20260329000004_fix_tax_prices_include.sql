-- Simplified tax: when tax_enabled, always add tax on top of base prices.
-- prices_include_tax and show_tax_separately are no longer used.

CREATE OR REPLACE FUNCTION public.calculate_order_total(order_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  calculated_subtotal DECIMAL(10, 2);
  calculated_tax DECIMAL(10, 2);
  calculated_total DECIMAL(10, 2);
  order_discount_type VARCHAR(10);
  order_discount_value DECIMAL(10, 2);
  calculated_discount DECIMAL(10, 2);
  order_delivery_fee DECIMAL(10, 2);
  settings_tax_enabled BOOLEAN;
  settings_tax_percentage DECIMAL(5, 2);
  taxable_amount DECIMAL(10, 2);
BEGIN
  SELECT tax_enabled, tax_percentage
  INTO settings_tax_enabled, settings_tax_percentage
  FROM public.cafe_settings
  LIMIT 1;

  SELECT COALESCE(SUM(item_price * quantity), 0)
  INTO calculated_subtotal
  FROM public.order_items
  WHERE order_id = order_uuid
    AND status != 'cancelled';

  -- Get discount info and delivery fee from the order
  SELECT
    COALESCE(discount_type, 'none'),
    COALESCE(discount_value, 0),
    COALESCE(delivery_fee, 0)
  INTO order_discount_type, order_discount_value, order_delivery_fee
  FROM public.orders
  WHERE id = order_uuid;

  -- Calculate discount amount (cannot exceed subtotal)
  IF order_discount_type = 'percentage' THEN
    calculated_discount := LEAST(calculated_subtotal, calculated_subtotal * order_discount_value / 100);
  ELSIF order_discount_type = 'fixed' THEN
    calculated_discount := LEAST(calculated_subtotal, order_discount_value);
  ELSE
    calculated_discount := 0;
  END IF;

  taxable_amount := calculated_subtotal - calculated_discount;

  IF settings_tax_enabled = true AND settings_tax_percentage > 0 THEN
    calculated_tax := taxable_amount * (settings_tax_percentage / 100);
    calculated_total := taxable_amount + calculated_tax + order_delivery_fee;
  ELSE
    calculated_tax := 0;
    calculated_total := taxable_amount + order_delivery_fee;
  END IF;

  UPDATE public.orders
  SET
    subtotal = calculated_subtotal,
    tax = calculated_tax,
    discount_amount = calculated_discount,
    total = calculated_total,
    updated_at = NOW()
  WHERE id = order_uuid;
END;
$$;
