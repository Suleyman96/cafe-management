-- Rollback for 20260604000003_modifier_aware_item_price.sql
--
-- Restores the pre-modifier function body: item_price snapshots the bare
-- menu_items.price and ignores selected_options deltas. Note this reinstates
-- the undercharge-on-modifiers behavior — only roll back if the modifiers
-- feature itself is being reverted.

BEGIN;

CREATE OR REPLACE FUNCTION public.snapshot_item_price_from_menu()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_menu_price numeric;
BEGIN
  SELECT price
    INTO v_menu_price
    FROM public.menu_items
   WHERE id = NEW.menu_item_id
     AND tenant_id = NEW.tenant_id;

  IF v_menu_price IS NULL THEN
    RAISE EXCEPTION 'menu_item_not_found_in_tenant'
      USING ERRCODE = 'P0001';
  END IF;

  NEW.item_price := v_menu_price;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.snapshot_item_price_from_menu() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_snapshot_item_price ON public.order_items;
CREATE TRIGGER trg_snapshot_item_price
  BEFORE INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_item_price_from_menu();

COMMIT;
