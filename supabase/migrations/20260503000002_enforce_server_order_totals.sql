-- ============================================================
-- C2 / M2. Server-side enforcement of order item prices and totals.
--
-- The pre-fix flow let a client send `item_price` (and `subtotal/tax/total`)
-- with arbitrary values: a staffer could POST real items at $0.01 each and
-- pocket the cash difference between the receipt and what they actually
-- charged at the table. Two layers of defense:
--
--   1. BEFORE INSERT trigger on order_items snapshots `item_price` from
--      the menu_items row, scoped to the same tenant. Whatever the client
--      sends is overwritten — the price the customer is billed is always
--      the price configured for the menu item at the time of ordering.
--      A missing menu item (cross-tenant, or deleted) raises and aborts
--      the insert, so callers can't slip in items that don't belong to
--      their tenant.
--
--   2. CHECK (subtotal, tax, total >= 0) on orders. Defense in depth in
--      case any future code path bypasses the recompute trigger; combined
--      with the existing `recalculate_on_item_insert` trigger this keeps
--      stored totals on the correct side of zero even if a caller tries
--      a negative-price stunt.
--
-- The existing AFTER INSERT/UPDATE/DELETE triggers on order_items already
-- call `calculate_order_total(order_id)` which rewrites
-- subtotal/tax/total from the (now-snapshotted) item_price values. So this
-- migration closes the price side of the loop; the totals side was already
-- protected as long as the price was honest.
-- ============================================================

BEGIN;

-- ── 1. item_price snapshot trigger ─────────────────────────────────

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
    -- Either the menu_item doesn't exist or it belongs to a different
    -- tenant. Either way the insert must fail — we will not create an
    -- order_item for an item the tenant doesn't own.
    RAISE EXCEPTION 'menu_item_not_found_in_tenant'
      USING ERRCODE = 'P0001';
  END IF;

  -- Always overwrite the client-supplied price. The receipt the customer
  -- sees is what menu_items says — not what the POS app sent over the wire.
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

-- ── 2. defensive non-negative CHECKs on orders ─────────────────────

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_totals_nonnegative_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_totals_nonnegative_check
  CHECK (subtotal >= 0 AND tax >= 0 AND total >= 0);

COMMIT;
