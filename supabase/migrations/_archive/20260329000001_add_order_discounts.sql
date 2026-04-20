-- Add discount support to orders
-- Discounts are applied before tax calculation

-- 1. Add discount columns to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(10) DEFAULT 'none'
    CHECK (discount_type IN ('none', 'percentage', 'fixed')),
  ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason TEXT,
  ADD COLUMN IF NOT EXISTS discount_applied_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;

-- 2. Update calculate_order_total to account for discounts
-- Discount is applied to subtotal before tax: total = (subtotal - discount) + tax + delivery_fee
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

  -- Tax is applied on discounted subtotal
  IF settings_tax_enabled = true AND settings_tax_percentage > 0 THEN
    calculated_tax := (calculated_subtotal - calculated_discount) * (settings_tax_percentage / 100);
  ELSE
    calculated_tax := 0;
  END IF;

  calculated_total := (calculated_subtotal - calculated_discount) + calculated_tax + order_delivery_fee;

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

-- 3. Create a trigger to recalculate order total when discount fields change
CREATE OR REPLACE FUNCTION public.recalculate_on_discount_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.discount_type IS DISTINCT FROM NEW.discount_type
    OR OLD.discount_value IS DISTINCT FROM NEW.discount_value THEN
    PERFORM public.calculate_order_total(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER recalculate_on_discount_change
  AFTER UPDATE OF discount_type, discount_value ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_on_discount_change();
