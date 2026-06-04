-- ============================================================
-- Make the server-authoritative item_price trigger modifier-aware.
--
-- Background: 20260503000002 added `snapshot_item_price_from_menu()`, a
-- BEFORE INSERT trigger that overwrites the client-supplied `item_price`
-- with the base `menu_items.price` so a tampered client can't undercut the
-- menu. That predates menu-item modifiers (20260604000002), so it discarded
-- the price deltas of chosen options: an order_item with a "+2" modifier was
-- billed at the base price while `selected_options` still showed the upsell.
-- Net effect — every paid modifier was silently undercharged.
--
-- Fix: keep the trigger as the single source of truth for price, but have it
-- ADD the modifier deltas. Deltas are re-derived from
-- `menu_item_option_values` by the `value_id`s present in
-- NEW.selected_options — NOT read from the snapshot's `price_delta` field,
-- which the client influenced. The DB therefore prices the line entirely
-- from its own tables; the snapshot remains display-only.
--
-- Safety properties preserved:
--   * A missing/cross-tenant menu_item still raises and aborts the insert.
--   * Only values that (a) belong to NEW.tenant_id and (b) hang off an option
--     group attached to NEW.menu_item_id contribute a delta. A tampered or
--     mismatched value_id simply contributes nothing (base price), so it can
--     never overcharge or attach another item's upsell.
--   * price_delta is CHECK (>= 0) at the column level, so the sum can only
--     raise the price toward the menu-configured value, never below base.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.snapshot_item_price_from_menu()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_menu_price numeric;
  v_delta_sum  numeric := 0;
BEGIN
  SELECT price
    INTO v_menu_price
    FROM public.menu_items
   WHERE id = NEW.menu_item_id
     AND tenant_id = NEW.tenant_id;

  IF v_menu_price IS NULL THEN
    -- Either the menu_item doesn't exist or it belongs to a different
    -- tenant. Either way the insert must fail — we will not create an
    -- order_item for an item the tenant doesn't own.
    RAISE EXCEPTION 'menu_item_not_found_in_tenant'
      USING ERRCODE = 'P0001';
  END IF;

  -- Sum the deltas of the chosen modifier values, re-derived from the
  -- catalog (never trusting the snapshot's own price_delta). Only values
  -- scoped to this tenant AND attached — via their option group — to this
  -- menu item count; anything else contributes 0.
  IF NEW.selected_options IS NOT NULL
     AND jsonb_typeof(NEW.selected_options) = 'array' THEN
    SELECT COALESCE(SUM(v.price_delta), 0)
      INTO v_delta_sum
      FROM jsonb_array_elements(NEW.selected_options) AS elem
      JOIN public.menu_item_option_values v
        ON v.id = (elem ->> 'value_id')::uuid
       AND v.tenant_id = NEW.tenant_id
      JOIN public.menu_item_options o
        ON o.id = v.option_id
       AND o.menu_item_id = NEW.menu_item_id;
  END IF;

  -- Always overwrite the client-supplied price. The receipt the customer
  -- sees is what menu_items + the chosen modifiers say — not what the POS
  -- app sent over the wire.
  NEW.item_price := v_menu_price + COALESCE(v_delta_sum, 0);
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.snapshot_item_price_from_menu() OWNER TO postgres;

-- Trigger binding is unchanged from 20260503000002; recreate idempotently so
-- this migration is self-contained if applied to a fresh shadow DB.
DROP TRIGGER IF EXISTS trg_snapshot_item_price ON public.order_items;
CREATE TRIGGER trg_snapshot_item_price
  BEFORE INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_item_price_from_menu();

COMMIT;
