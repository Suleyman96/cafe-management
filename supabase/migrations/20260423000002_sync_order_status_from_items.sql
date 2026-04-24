-- Sync order status UP from items when an item status changes.
-- Replaces the client-side logic in orders/[id]/page.tsx handleItemStatusUpdate.
-- Eliminates the race condition where two staff members updating items simultaneously
-- could produce incorrect order status from stale local state.

CREATE OR REPLACE FUNCTION public.sync_order_status_from_items()
RETURNS TRIGGER AS $$
DECLARE
  v_current_status TEXT;
  v_all_served BOOLEAN;
  v_all_ready_or_served BOOLEAN;
  v_any_preparing BOOLEAN;
  v_non_cancelled_count INT;
  v_target_status TEXT;
BEGIN
  SELECT status INTO v_current_status
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

  IF v_target_status IS NOT NULL THEN
    UPDATE public.orders
    SET status = v_target_status, updated_at = NOW()
    WHERE id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

DROP TRIGGER IF EXISTS trg_sync_order_status_from_items ON public.order_items;
CREATE TRIGGER trg_sync_order_status_from_items
  AFTER UPDATE OF status ON public.order_items
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sync_order_status_from_items();
