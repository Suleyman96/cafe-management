-- Migration: Atomic cancel-order-item RPC.
--
-- Root cause being fixed:
--   The wrapper's `cancel(id, cancelQty)` for partial cancel was a
--   client-side SELECT → mutate-in-JS → UPDATE pattern. Two concurrent
--   partial-cancel calls (or a partial-cancel racing a status change)
--   each read the same `quantity`, both compute `quantity - cancelQty`
--   off the same baseline, and the second UPDATE clobbers the first —
--   classic lost-update under READ COMMITTED.
--
-- Fix:
--   Push the read-modify-write into a SECURITY DEFINER plpgsql function
--   that takes a row-level lock (`SELECT ... FOR UPDATE`) inside a single
--   transaction. Concurrent callers serialize on the lock and the second
--   one observes the first one's commit before computing.
--
-- Authorization:
--   SECURITY DEFINER bypasses RLS, so we re-establish the boundary
--   manually:
--     - The caller must have an active staff record (auth.uid()).
--     - The caller's tenant_id must match the order_item's tenant_id.
--   This mirrors the pattern used by transfer_table /
--   transfer_order_items (20260428000001).
--
-- Behavioral note:
--   The wrapper's previous contract treated `cancelQty >= quantity` as a
--   full cancel (slider value clamped server-side). We preserve that —
--   `>= v_row.quantity` triggers the full-cancel branch so callers don't
--   need to clamp before calling. Negative or zero quantities are
--   rejected.

BEGIN;

CREATE OR REPLACE FUNCTION public.cancel_order_item_qty(
  p_order_item_id UUID,
  p_cancel_qty INTEGER
)
RETURNS public.order_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.order_items;
  v_actor_id UUID;
  v_actor_tenant_id UUID;
BEGIN
  -- Authorize: caller must be active staff.
  SELECT id, tenant_id INTO v_actor_id, v_actor_tenant_id
  FROM public.staff
  WHERE auth_user_id = auth.uid() AND is_active = true
  LIMIT 1;

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'No active staff record for current user'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Lock the target row. Concurrent callers serialize here.
  SELECT * INTO v_row FROM public.order_items
    WHERE id = p_order_item_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_item not found' USING ERRCODE = 'no_data_found';
  END IF;

  -- Tenant isolation: caller's tenant must match the row's tenant.
  IF v_row.tenant_id IS DISTINCT FROM v_actor_tenant_id THEN
    RAISE EXCEPTION 'order_item_tenant_mismatch'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Reject mutations on terminal-state items.
  IF v_row.status IN ('cancelled', 'served') THEN
    RAISE EXCEPTION 'cannot cancel order_item in status %', v_row.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- Reject zero/negative quantities. Quantities >= v_row.quantity collapse
  -- to a full cancel (preserves the wrapper's clamp-on-the-server contract).
  IF p_cancel_qty <= 0 THEN
    RAISE EXCEPTION 'invalid cancel quantity'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_cancel_qty >= v_row.quantity THEN
    UPDATE public.order_items
      SET status = 'cancelled', updated_at = now()
      WHERE id = p_order_item_id
      RETURNING * INTO v_row;
  ELSE
    UPDATE public.order_items
      SET quantity = quantity - p_cancel_qty, updated_at = now()
      WHERE id = p_order_item_id
      RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.cancel_order_item_qty(UUID, INTEGER) IS
  'Atomically cancel an order_item fully or partially. Locks the row to prevent lost-update races. Authorizes via auth.uid() → active staff with matching tenant_id.';

GRANT EXECUTE ON FUNCTION public.cancel_order_item_qty(UUID, INTEGER) TO authenticated;

COMMIT;
