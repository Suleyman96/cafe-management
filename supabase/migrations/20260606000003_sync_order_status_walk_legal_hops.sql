-- Audit should-fix: the item-status sync trigger collided with the order
-- state-machine validator.
--
-- When the last non-cancelled item was set to 'served' while the order was still
-- 'preparing' (e.g. a single-item dine-in order), sync_order_status_from_items
-- computed target='served' and issued `UPDATE orders SET status='served'`. That
-- fires validate_order_status_transition (20260504000007), which rejects
-- preparing->served for dine_in (only ready->served is legal) — the exception
-- aborted the ORIGINAL order_items UPDATE, so the item got stuck and staff saw a
-- generic "failed to update" error. The same happened for new->ready and
-- new->served jumps.
--
-- Fix: walk the order forward through legal SINGLE hops
-- (new -> preparing -> ready -> served) so every UPDATE is a transition the
-- validator accepts. Also clamp the 'served' target to dine_in — takeout and
-- delivery orders have no 'served' order status (their flow ends at 'ready'
-- before staff drive out_for_delivery/delivered), so targeting 'served' for
-- them would hit the same rejection. Behavior-preserving for the already-legal
-- single-step case; only the previously-aborting multi-hop case changes (it now
-- succeeds). The trigger binding is unchanged.

CREATE OR REPLACE FUNCTION public.sync_order_status_from_items()
RETURNS TRIGGER AS $$
DECLARE
  v_current_status TEXT;
  v_order_type TEXT;
  v_all_served BOOLEAN;
  v_all_ready_or_served BOOLEAN;
  v_any_preparing BOOLEAN;
  v_non_cancelled_count INT;
  v_target_status TEXT;
  v_chain TEXT[] := ARRAY['new', 'preparing', 'ready', 'served'];
  v_cur_idx INT;
  v_tgt_idx INT;
  i INT;
BEGIN
  SELECT status, order_type INTO v_current_status, v_order_type
  FROM public.orders
  WHERE id = NEW.order_id;

  -- Don't sync if order is in a terminal or non-syncable state
  IF v_current_status IN ('closed', 'cancelled', 'delivered', 'out_for_delivery', 'pending_approval') THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*),
    BOOL_AND(status = 'served'),
    BOOL_AND(status IN ('ready', 'served')),
    BOOL_OR(status = 'preparing')
  INTO v_non_cancelled_count, v_all_served, v_all_ready_or_served, v_any_preparing
  FROM public.order_items
  WHERE order_id = NEW.order_id
    AND status != 'cancelled';

  IF v_non_cancelled_count = 0 THEN
    RETURN NEW;
  END IF;

  v_target_status := NULL;
  IF v_all_served AND v_current_status != 'served' THEN
    v_target_status := 'served';
  ELSIF v_all_ready_or_served AND NOT v_all_served AND v_current_status != 'ready' THEN
    v_target_status := 'ready';
  ELSIF v_any_preparing AND v_current_status = 'new' THEN
    v_target_status := 'preparing';
  END IF;

  -- Only dine_in has a 'served' order status; clamp others to 'ready' so the
  -- target stays within their legal flow.
  IF v_target_status = 'served' AND v_order_type IS DISTINCT FROM 'dine_in' THEN
    v_target_status := 'ready';
  END IF;

  IF v_target_status IS NULL OR v_target_status = v_current_status THEN
    RETURN NEW;
  END IF;

  -- Walk forward one legal hop at a time so validate_order_status_transition
  -- (which rejects forward skips) accepts each step. Only advance forward within
  -- the chain; a non-forward / out-of-chain computed target is a no-op.
  v_cur_idx := array_position(v_chain, v_current_status);
  v_tgt_idx := array_position(v_chain, v_target_status);
  IF v_cur_idx IS NULL OR v_tgt_idx IS NULL OR v_tgt_idx <= v_cur_idx THEN
    RETURN NEW;
  END IF;

  FOR i IN (v_cur_idx + 1)..v_tgt_idx LOOP
    UPDATE public.orders
    SET status = v_chain[i], updated_at = NOW()
    WHERE id = NEW.order_id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';
