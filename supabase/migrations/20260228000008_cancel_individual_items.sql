-- Allow cancelling individual order items
-- Adds 'cancelled' status to order_items and updates functions to exclude cancelled items

-- 1. Add 'cancelled' to order_items status CHECK constraint
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_status_check;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_status_check
  CHECK (status IN ('pending', 'preparing', 'ready', 'served', 'cancelled'));

-- 2. Update calculate_order_total to exclude cancelled items
CREATE OR REPLACE FUNCTION public.calculate_order_total(order_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  calculated_subtotal DECIMAL(10, 2);
  calculated_tax DECIMAL(10, 2);
  calculated_total DECIMAL(10, 2);
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

  IF settings_tax_enabled = true AND settings_tax_percentage > 0 THEN
    calculated_tax := calculated_subtotal * (settings_tax_percentage / 100);
  ELSE
    calculated_tax := 0;
  END IF;

  calculated_total := calculated_subtotal + calculated_tax;

  UPDATE public.orders
  SET
    subtotal = calculated_subtotal,
    tax = calculated_tax,
    total = calculated_total,
    updated_at = NOW()
  WHERE id = order_uuid;
END;
$$;

-- 3. Update validate_items_payment to exclude cancelled items
CREATE OR REPLACE FUNCTION public.validate_items_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  calculated_amount DECIMAL(10, 2);
BEGIN
  IF NEW.payment_type = 'specific_items' THEN
    IF NEW.order_item_ids IS NULL OR array_length(NEW.order_item_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'order_item_ids must be provided for specific_items payment';
    END IF;

    SELECT COALESCE(SUM(item_price * quantity), 0) INTO calculated_amount
    FROM public.order_items
    WHERE id = ANY(NEW.order_item_ids)
      AND order_id = NEW.order_id
      AND status != 'cancelled';

    IF NEW.amount != calculated_amount THEN
      RAISE EXCEPTION 'Payment amount (%) does not match items total (%)',
        NEW.amount, calculated_amount;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
