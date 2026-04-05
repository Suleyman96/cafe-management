-- When order status advances, cascade the status to order items that are behind.
-- e.g., order → "preparing" should move "pending" items to "preparing"
-- e.g., order → "served" should move "pending"/"preparing"/"ready" items to "served"

CREATE OR REPLACE FUNCTION public.cascade_order_status_to_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only act when status actually changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Map order status to the corresponding item status
  -- Order statuses: pending_approval, new, preparing, ready, served, closed, cancelled
  -- Item statuses:  pending, preparing, ready, served, cancelled

  IF NEW.status = 'preparing' THEN
    UPDATE public.order_items
    SET status = 'preparing', updated_at = NOW()
    WHERE order_id = NEW.id
      AND status = 'pending';

  ELSIF NEW.status = 'ready' THEN
    UPDATE public.order_items
    SET status = 'ready', updated_at = NOW()
    WHERE order_id = NEW.id
      AND status IN ('pending', 'preparing');

  ELSIF NEW.status IN ('served', 'delivered') THEN
    UPDATE public.order_items
    SET status = 'served', updated_at = NOW()
    WHERE order_id = NEW.id
      AND status IN ('pending', 'preparing', 'ready');

  ELSIF NEW.status = 'cancelled' THEN
    UPDATE public.order_items
    SET status = 'cancelled', updated_at = NOW()
    WHERE order_id = NEW.id
      AND status IN ('pending', 'preparing', 'ready');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cascade_order_status_trigger ON public.orders;
CREATE TRIGGER cascade_order_status_trigger
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_order_status_to_items();
