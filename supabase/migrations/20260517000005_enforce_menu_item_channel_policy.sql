-- ============================================================
-- Server-side enforcement of menu_item channel policy on order_items.
-- ============================================================
--
-- Why this exists:
--   Migration 20260517000004 added is_takeoutable / is_deliverable
--   flags on menu_items. The staff-web and mobile pickers filter the
--   menu by these flags client-side, but nothing on the server
--   validates that the *items inserted into an order* match the
--   *order's order_type*. A buggy client (or anyone with raw SQL
--   access via the wrapper / API) could POST a non-deliverable item
--   onto a delivery order and the row would land.
--
--   This trigger closes the gap. BEFORE INSERT/UPDATE on order_items
--   looks up the parent order's order_type and the menu item's
--   channel flags, and rejects mismatches with sentinel exceptions
--   that the api-client error mapper translates to ConflictError +
--   i18n keys (errors.menu_item_not_takeoutable /
--   errors.menu_item_not_deliverable).
--
-- Scope decisions:
--   - Fires on INSERT (new line items) AND UPDATE *only when*
--     menu_item_id or order_id changes. Status-only updates (mark
--     ready/served) re-fire but short-circuit at the top — they don't
--     change channel-policy-relevant fields, so re-validating would
--     waste two row lookups per kitchen-bell tap.
--   - Does NOT enforce historical consistency. If an admin marks an
--     item non-takeoutable AFTER an existing takeout order has it,
--     the existing row stays valid. New rows are blocked. Historical
--     enforcement would require a trigger on menu_items.UPDATE that
--     scans all order_items — too expensive for a flag flip, and
--     the product policy is "going forward only".
--   - Does NOT enforce on orders.order_type change. The order_type
--     is set at creation and never changed in current flows; if a
--     future flow does mutate it, that flow needs its own validation.
--
-- Safe to roll out with the column defaults (true) — every existing
-- item passes both flags, so no existing order_item is in violation
-- at deploy time. Failures only start when admins explicitly opt
-- items out, which can't have happened before this migration ships.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_menu_item_channel_policy() RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
DECLARE
  v_order_type text;
  v_is_takeoutable boolean;
  v_is_deliverable boolean;
BEGIN
  -- UPDATE short-circuit: only revalidate when the channel-relevant
  -- columns actually change. Status-only updates (the common case —
  -- mark item ready/served) are no-ops here.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.menu_item_id IS NOT DISTINCT FROM OLD.menu_item_id
       AND NEW.order_id IS NOT DISTINCT FROM OLD.order_id THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Defensive: orphan inserts (no menu_item_id) shouldn't be possible
  -- under the existing FK, but if a future flow ever permits it, skip
  -- the check rather than crashing with a NULL comparison.
  IF NEW.menu_item_id IS NULL OR NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT order_type INTO v_order_type
    FROM public.orders WHERE id = NEW.order_id;

  -- Order missing means the FK is being violated; let the FK trigger
  -- raise its own clearer error rather than masking it here.
  IF v_order_type IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only takeout / delivery have channel restrictions. Dine-in (and
  -- any future order types) skip the lookup entirely — that's the
  -- vast majority of orders, so the early return matters for hot
  -- path performance.
  IF v_order_type NOT IN ('takeout', 'delivery') THEN
    RETURN NEW;
  END IF;

  SELECT is_takeoutable, is_deliverable
    INTO v_is_takeoutable, v_is_deliverable
    FROM public.menu_items WHERE id = NEW.menu_item_id;

  -- Menu item missing → same logic as missing order: let the FK
  -- trigger handle it.
  IF v_is_takeoutable IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_order_type = 'takeout' AND v_is_takeoutable = false THEN
    RAISE EXCEPTION 'menu_item_not_takeoutable'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_order_type = 'delivery' AND v_is_deliverable = false THEN
    RAISE EXCEPTION 'menu_item_not_deliverable'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_menu_item_channel_policy IS
  'BEFORE INSERT/UPDATE trigger on order_items. Rejects rows that pair a takeout/delivery order with a menu_item flagged not-takeoutable/not-deliverable. Raises check_violation with sentinel message that api-client error mapper translates to a localised ConflictError.';

DROP TRIGGER IF EXISTS enforce_menu_item_channel_policy_trigger ON public.order_items;

CREATE TRIGGER enforce_menu_item_channel_policy_trigger
  BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_menu_item_channel_policy();

COMMIT;
