-- Quantity-aware specific_items payments: let a multi-unit line item be paid a
-- few units at a time, tracked so units can't be paid twice.
--
-- Before: specific_items paid for a WHOLE line item (order_item_ids = distinct
-- ids; the trigger summed item_price*quantity). Paying "1 of 3 Cappuccinos"
-- therefore wasn't expressible — the modal fell back to partial_amount, which
-- records no items, so the same units could be selected and paid again.
--
-- Now: order_item_ids carries ONE element per paid unit (2 units of an item =
-- the id listed twice). The expected subtotal is item_price summed per element
-- (count = quantity), plus the items' proportional share of the order tax
-- (0.01 tolerance for JS/SQL rounding). A per-line cap rejects paying more
-- units than were ordered, counting prior specific_items payments — the
-- server-side guarantee behind the modal's "remaining quantity" selector.
--
-- order_item_ids is a uuid[] with no uniqueness constraint and only two readers
-- (this trigger + the payment modal, which now counts occurrences), so encoding
-- quantity as repeated ids needs no schema/type change. Trigger-only.

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
  v_unknown INT;
  rec RECORD;
BEGIN
  IF NEW.payment_type <> 'specific_items' THEN
    RETURN NEW;
  END IF;

  IF NEW.order_item_ids IS NULL OR array_length(NEW.order_item_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'order_item_ids must be provided for specific_items payment';
  END IF;

  -- Every element must reference a live line item of THIS order.
  SELECT count(*) INTO v_unknown
  FROM unnest(NEW.order_item_ids) AS u(id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.id = u.id AND oi.order_id = NEW.order_id AND oi.status <> 'cancelled'
  );
  IF v_unknown > 0 THEN
    RAISE EXCEPTION 'order_item_ids references an item not on this order'
      USING ERRCODE = 'check_violation';
  END IF;

  -- One element = one paid unit, so item_price summed per element (duplicates
  -- = quantity) is the selected subtotal.
  SELECT COALESCE(SUM(oi.item_price), 0) INTO v_items_subtotal
  FROM unnest(NEW.order_item_ids) AS u(id)
  JOIN public.order_items oi ON oi.id = u.id;

  -- Per-line cap: prior paid units (other specific_items payments) + this
  -- payment's units must not exceed the line's ordered quantity.
  FOR rec IN
    SELECT u.id AS item_id, count(*) AS new_qty
    FROM unnest(NEW.order_item_ids) AS u(id)
    GROUP BY u.id
  LOOP
    IF rec.new_qty + COALESCE((
      SELECT count(*)
      FROM public.order_payments p, unnest(p.order_item_ids) AS e(id)
      WHERE p.order_id = NEW.order_id
        AND p.payment_type = 'specific_items'
        AND e.id = rec.item_id
    ), 0) > (SELECT quantity FROM public.order_items WHERE id = rec.item_id) THEN
      RAISE EXCEPTION 'paid quantity exceeds ordered quantity for an item'
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  SELECT subtotal, tax INTO v_order_subtotal, v_order_tax
  FROM public.orders WHERE id = NEW.order_id;

  v_expected := v_items_subtotal
    + CASE
        WHEN COALESCE(v_order_subtotal, 0) > 0 AND COALESCE(v_order_tax, 0) > 0
        THEN round(v_order_tax * v_items_subtotal / v_order_subtotal, 2)
        ELSE 0
      END;

  IF abs(NEW.amount - v_expected) > 0.01 THEN
    RAISE EXCEPTION 'Payment amount (%) does not match items total (%)',
      NEW.amount, v_expected
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;
