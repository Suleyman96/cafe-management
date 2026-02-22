-- Migration: Fix tax calculation to use cafe_settings
-- Instead of hardcoded 18% tax, read from cafe_settings table

CREATE OR REPLACE FUNCTION calculate_order_total(order_uuid UUID)
RETURNS VOID AS $$
DECLARE
  calculated_subtotal DECIMAL(10, 2);
  calculated_tax DECIMAL(10, 2);
  calculated_total DECIMAL(10, 2);
  settings_tax_enabled BOOLEAN;
  settings_tax_percentage DECIMAL(5, 2);
BEGIN
  -- Get tax settings from cafe_settings
  SELECT tax_enabled, tax_percentage
  INTO settings_tax_enabled, settings_tax_percentage
  FROM cafe_settings
  LIMIT 1;

  -- Calculate subtotal from order items
  SELECT COALESCE(SUM(item_price * quantity), 0)
  INTO calculated_subtotal
  FROM order_items
  WHERE order_id = order_uuid;

  -- Calculate tax only if enabled in settings
  IF settings_tax_enabled = true AND settings_tax_percentage > 0 THEN
    calculated_tax := calculated_subtotal * (settings_tax_percentage / 100);
  ELSE
    calculated_tax := 0;
  END IF;

  calculated_total := calculated_subtotal + calculated_tax;

  UPDATE orders
  SET
    subtotal = calculated_subtotal,
    tax = calculated_tax,
    total = calculated_total,
    updated_at = NOW()
  WHERE id = order_uuid;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_order_total IS 'Calculate order total with tax based on cafe_settings (not hardcoded)';
