-- Fix all functions broken by search_path = '' (migration 20260228000003)
-- The previous migration set search_path to empty string for security,
-- but the function bodies reference tables without public. schema prefix.
-- This recreates all affected functions with explicit public. prefixes.

-- ============================================================
-- 1. generate_order_number — references orders
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS VARCHAR(15)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  new_number VARCHAR(15);
  counter INTEGER;
BEGIN
  SELECT COUNT(*) INTO counter
  FROM public.orders
  WHERE DATE(created_at) = CURRENT_DATE;

  new_number := 'ORD' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || LPAD((counter + 1)::TEXT, 3, '0');

  RETURN new_number;
END;
$$;

-- ============================================================
-- 2. set_order_number — calls generate_order_number
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := public.generate_order_number();
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. calculate_order_total — references cafe_settings, order_items, orders
--    (latest version from 20250131000003 with dynamic tax)
-- ============================================================
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
  -- Get tax settings from cafe_settings
  SELECT tax_enabled, tax_percentage
  INTO settings_tax_enabled, settings_tax_percentage
  FROM public.cafe_settings
  LIMIT 1;

  -- Calculate subtotal from order items
  SELECT COALESCE(SUM(item_price * quantity), 0)
  INTO calculated_subtotal
  FROM public.order_items
  WHERE order_id = order_uuid;

  -- Calculate tax only if enabled in settings
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

-- ============================================================
-- 4. recalculate_order_total — calls calculate_order_total
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalculate_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM public.calculate_order_total(COALESCE(NEW.order_id, OLD.order_id));
  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. update_table_status_on_order — references tables
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_table_status_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tables
    SET
      status = 'occupied',
      occupied_at = NOW(),
      current_session_id = NEW.id
    WHERE id = NEW.table_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'closed' AND OLD.status != 'closed' THEN
    UPDATE public.tables
    SET
      status = 'free',
      current_session_id = NULL
    WHERE id = NEW.table_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 6. enforce_single_cafe_settings — references cafe_settings
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_single_cafe_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.cafe_settings) > 0 THEN
    RAISE EXCEPTION 'Only one cafe_settings row is allowed';
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 7. get_order_remaining_balance — references orders, order_payments
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_order_remaining_balance(order_uuid UUID)
RETURNS DECIMAL(10, 2)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  order_total DECIMAL(10, 2);
  paid_amount DECIMAL(10, 2);
BEGIN
  SELECT total INTO order_total
  FROM public.orders
  WHERE id = order_uuid;

  IF order_total IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', order_uuid;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO paid_amount
  FROM public.order_payments
  WHERE order_id = order_uuid;

  RETURN order_total - paid_amount;
END;
$$;

-- ============================================================
-- 8. transfer_table — references orders, tables, table_transfers
-- ============================================================
CREATE OR REPLACE FUNCTION public.transfer_table(
  p_order_id UUID,
  p_from_table_id UUID,
  p_to_table_id UUID,
  p_staff_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_order_status VARCHAR(20);
BEGIN
  SELECT status INTO v_order_status
  FROM public.orders
  WHERE id = p_order_id AND table_id = p_from_table_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % does not belong to table %', p_order_id, p_from_table_id;
  END IF;

  IF v_order_status = 'closed' OR v_order_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot transfer closed or cancelled order';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tables
    WHERE id = p_to_table_id
    AND status NOT IN ('free', 'reserved')
  ) THEN
    RAISE EXCEPTION 'Target table is not available';
  END IF;

  UPDATE public.orders
  SET
    table_id = p_to_table_id,
    updated_at = NOW()
  WHERE id = p_order_id;

  UPDATE public.tables
  SET
    status = 'free',
    current_session_id = NULL,
    updated_at = NOW()
  WHERE id = p_from_table_id;

  UPDATE public.tables
  SET
    status = 'occupied',
    current_session_id = p_order_id,
    occupied_at = NOW(),
    updated_at = NOW()
  WHERE id = p_to_table_id;

  INSERT INTO public.table_transfers (
    order_id, from_table_id, to_table_id, transferred_by, reason
  ) VALUES (
    p_order_id, p_from_table_id, p_to_table_id, p_staff_id, p_reason
  );

  RETURN TRUE;
END;
$$;

-- ============================================================
-- 9. validate_payment_amount — calls get_order_remaining_balance
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_payment_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  remaining_balance DECIMAL(10, 2);
BEGIN
  remaining_balance := public.get_order_remaining_balance(NEW.order_id);

  IF NEW.amount > remaining_balance THEN
    RAISE EXCEPTION 'Payment amount (%) exceeds remaining balance (%)',
      NEW.amount, remaining_balance;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 10. update_order_payment_status — references order_payments, orders, tables
--     (latest version from 20250102000006 with auto-close)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_order_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  remaining DECIMAL(10, 2);
  total_paid DECIMAL(10, 2);
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

-- ============================================================
-- 11. validate_items_payment — references order_items
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_items_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  items_total DECIMAL(10, 2);
  calculated_amount DECIMAL(10, 2);
BEGIN
  IF NEW.payment_type = 'specific_items' THEN
    IF NEW.order_item_ids IS NULL OR array_length(NEW.order_item_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'order_item_ids must be provided for specific_items payment';
    END IF;

    SELECT COALESCE(SUM(item_price * quantity), 0) INTO calculated_amount
    FROM public.order_items
    WHERE id = ANY(NEW.order_item_ids)
    AND order_id = NEW.order_id;

    IF NEW.amount != calculated_amount THEN
      RAISE EXCEPTION 'Payment amount (%) does not match items total (%)',
        NEW.amount, calculated_amount;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
