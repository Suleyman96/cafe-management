-- Rollback: remove financial audit system
-- This reverts the triggers to their pre-audit versions and drops the audit table.

BEGIN;

-- 1. Revert recalculate_order_total to non-auditing version
CREATE OR REPLACE FUNCTION public.recalculate_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.calculate_order_total(COALESCE(NEW.order_id, OLD.order_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2. Revert calculate_order_total to non-auditing version (from 20260418100001)
CREATE OR REPLACE FUNCTION public.calculate_order_total(order_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  calculated_subtotal NUMERIC(14, 4);
  calculated_tax NUMERIC(14, 4);
  calculated_total NUMERIC(14, 4);
  order_discount_type VARCHAR(10);
  order_discount_value NUMERIC(14, 4);
  calculated_discount NUMERIC(14, 4);
  order_delivery_fee NUMERIC(14, 4);
  settings_tax_enabled BOOLEAN;
  settings_tax_percentage NUMERIC(7, 4);
  taxable_amount NUMERIC(14, 4);
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

  SELECT
    COALESCE(discount_type, 'none'),
    COALESCE(discount_value, 0),
    COALESCE(delivery_fee, 0)
  INTO order_discount_type, order_discount_value, order_delivery_fee
  FROM public.orders
  WHERE id = order_uuid;

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

-- 3. Revert recalculate_on_discount_change to non-auditing version
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

-- 4. Revert update_order_payment_status to non-auditing version
CREATE OR REPLACE FUNCTION public.update_order_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  remaining NUMERIC(14, 4);
  total_paid NUMERIC(14, 4);
  order_table_id UUID;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.order_payments
  WHERE order_id = NEW.order_id;

  remaining := public.get_order_remaining_balance(NEW.order_id);

  IF remaining <= 0 THEN
    SELECT table_id INTO order_table_id
    FROM public.orders
    WHERE id = NEW.order_id;

    UPDATE public.orders
    SET
      status = 'closed',
      paid_at = NOW(),
      closed_at = NOW(),
      payment_method = 'split',
      updated_at = NOW()
    WHERE id = NEW.order_id;

    IF order_table_id IS NOT NULL THEN
      UPDATE public.tables
      SET
        status = 'free',
        current_session_id = NULL,
        updated_at = NOW()
      WHERE id = order_table_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Drop audit functions and table
DROP FUNCTION IF EXISTS public.finalize_audit_entry(UUID);
DROP FUNCTION IF EXISTS public.log_order_financial_change(UUID, TEXT, TEXT);
DROP TABLE IF EXISTS public.financial_audit_log;

COMMIT;
