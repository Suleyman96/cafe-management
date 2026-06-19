-- Make specific_items payments tax-aware so per-item ("pay these items") split
-- payments work on taxed orders too.
--
-- Before: validate_items_payment required amount == raw item subtotal (no tax).
-- So on a taxed order the payment modal couldn't use specific_items (the
-- tax-inclusive amount wouldn't match) and fell back to partial_amount, which
-- records no order_item_ids — meaning the app never tracked WHICH items were
-- paid, and the same line item could be selected and paid twice.
--
-- After: the expected amount is the selected items' subtotal PLUS their
-- proportional share of the order-level tax — exactly what the client's
-- calculateSelectedItemsTotal() sends. A 0.01 tolerance absorbs JS-vs-SQL
-- rounding on the proportional tax. Also raise with ERRCODE check_violation so
-- handleSupabaseError maps it to a typed 409 instead of a 500.
--
-- Trigger-only (RETURNS trigger) → no generated-type change.

CREATE OR REPLACE FUNCTION public.validate_items_payment()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO ''
AS $function$
DECLARE
  v_items_subtotal DECIMAL(14, 4);
  v_order_subtotal DECIMAL(14, 4);
  v_order_tax DECIMAL(14, 4);
  v_expected DECIMAL(14, 4);
BEGIN
  IF NEW.payment_type = 'specific_items' THEN
    IF NEW.order_item_ids IS NULL OR array_length(NEW.order_item_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'order_item_ids must be provided for specific_items payment';
    END IF;

    SELECT COALESCE(SUM(item_price * quantity), 0) INTO v_items_subtotal
    FROM public.order_items
    WHERE id = ANY(NEW.order_item_ids)
      AND order_id = NEW.order_id
      AND status != 'cancelled';

    SELECT subtotal, tax INTO v_order_subtotal, v_order_tax
    FROM public.orders
    WHERE id = NEW.order_id;

    -- Items' subtotal + their proportional share of the order tax.
    v_expected := v_items_subtotal
      + CASE
          WHEN COALESCE(v_order_subtotal, 0) > 0 AND COALESCE(v_order_tax, 0) > 0
          THEN round(v_order_tax * v_items_subtotal / v_order_subtotal, 2)
          ELSE 0
        END;

    -- 0.01 tolerance for client(JS)/server(SQL) rounding of the proportional tax.
    IF abs(NEW.amount - v_expected) > 0.01 THEN
      RAISE EXCEPTION 'Payment amount (%) does not match items total (%)',
        NEW.amount, v_expected
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
