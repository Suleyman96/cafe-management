-- Migration: server-side enforcement of the order status state machine.
--
-- Root cause being fixed:
--   The schema's `orders_status_check` constraint validates that `status` is
--   one of the 9 enum values, but says nothing about transitions. Any UPDATE
--   that swaps `status` to a permitted value passes — including illegal
--   regressions (`served → new`, `closed → preparing`) and forward skips
--   (`new → served` without preparing/ready). A buggy client, a manual SQL
--   session, or a developer testing in production can violate the workflow
--   invariants the rest of the system assumes.
--
-- Fix:
--   BEFORE UPDATE OF status trigger that validates (OLD.status, NEW.status,
--   NEW.order_type) against the legal-transitions table encoded in the
--   function body. Two universal rules and a per-type linear flow:
--
--   1. Terminal states are immutable. closed and cancelled cannot transition
--      anywhere — including to themselves (no-ops are filtered earlier so
--      this rule only fires on a real attempt to leave the terminal state).
--
--   2. Any non-terminal state may transition to closed (full payment closes
--      the order via the update_order_payment_status trigger) or cancelled
--      (the cancelOrder wrapper path, customer-initiated cancellation).
--
--   3. Per-type forward flow:
--      dine_in:  pending_approval → new → preparing → ready → served
--      takeout:  pending_approval → new → preparing → ready
--      delivery: pending_approval → new → preparing → ready
--                                                 → out_for_delivery → delivered
--
-- Why BEFORE UPDATE OF status:
--   `OF status` narrows the trigger to status-touching updates only —
--   discounts, item adds, customer notes, etc. don't fire it. The function
--   itself short-circuits when OLD.status = NEW.status (idempotent re-write).
--   The existing AFTER UPDATE triggers (cascade_order_status_to_items,
--   update_table_status_on_order, update_orders_updated_at) run unchanged.
--
-- Existing-data note:
--   This trigger only fires on UPDATE — existing rows in any state are
--   untouched until something tries to mutate them. A bad-state row left
--   over from before the trigger shipped becomes mutable only via cancelled
--   or closed (the universal escape hatches), which is the right cleanup
--   path anyway. No data backfill needed.
--
-- Defense-in-depth note:
--   The orders wrapper (packages/api-client/src/wrapper/orders.ts:updateStatus)
--   already rejects `served` for delivery/takeout types client-side and
--   blocks advance into preparing/ready/served on empty orders. This trigger
--   is the server-side authority — clients still need their checks for
--   friendly UX, but the trigger is what survives a bypassed client.

CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $validate$
DECLARE
  v_old TEXT;
  v_new TEXT;
  v_type TEXT;
  v_legal BOOLEAN := false;
BEGIN
  v_old := OLD.status::TEXT;
  v_new := NEW.status::TEXT;
  v_type := NEW.order_type::TEXT;

  -- No-op writes (re-applying the same status) skip validation entirely.
  -- The trigger's WHEN clause should also filter these but the in-body
  -- guard makes the function safe to call from anywhere.
  IF v_old = v_new THEN
    RETURN NEW;
  END IF;

  -- Universal rule 1: terminal states are immutable. closed and cancelled
  -- cannot transition anywhere; once an order is closed/cancelled the row
  -- is finance-locked and any further status mutation is a bug.
  IF v_old IN ('closed', 'cancelled') THEN
    RAISE EXCEPTION 'order status transition % -> % is illegal: % is a terminal state',
      v_old, v_new, v_old
      USING ERRCODE = 'check_violation';
  END IF;

  -- Universal rule 2: any non-terminal state may jump to closed (payment
  -- closure) or cancelled (cancellation). Both are legitimate and don't
  -- require following the per-type linear flow.
  IF v_new IN ('closed', 'cancelled') THEN
    RETURN NEW;
  END IF;

  -- Per-type linear flow validation. Reject any transition not explicitly
  -- enumerated below — including legal-looking-but-undefined hops like
  -- new -> ready, ready -> preparing, etc.
  v_legal := CASE
    WHEN v_type = 'dine_in' THEN
      (v_old = 'pending_approval' AND v_new = 'new')
      OR (v_old = 'new' AND v_new = 'preparing')
      OR (v_old = 'preparing' AND v_new = 'ready')
      OR (v_old = 'ready' AND v_new = 'served')
    WHEN v_type = 'takeout' THEN
      (v_old = 'pending_approval' AND v_new = 'new')
      OR (v_old = 'new' AND v_new = 'preparing')
      OR (v_old = 'preparing' AND v_new = 'ready')
    WHEN v_type = 'delivery' THEN
      (v_old = 'pending_approval' AND v_new = 'new')
      OR (v_old = 'new' AND v_new = 'preparing')
      OR (v_old = 'preparing' AND v_new = 'ready')
      OR (v_old = 'ready' AND v_new = 'out_for_delivery')
      OR (v_old = 'out_for_delivery' AND v_new = 'delivered')
    ELSE
      false
  END;

  IF NOT v_legal THEN
    RAISE EXCEPTION 'order status transition % -> % is illegal for order_type=%',
      v_old, v_new, v_type
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$validate$;
