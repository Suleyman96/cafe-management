-- Migration: install the BEFORE UPDATE trigger that wires
-- validate_order_status_transition into orders.status updates.
--
-- Paired follow-up to 20260504000007_order_status_state_machine.sql. The
-- function definition lives there; the CREATE TRIGGER is here in its own
-- file because the Supabase CLI's migration splitter rejects multi-statement
-- files that include a dollar-quoted function body.
--
-- The WHEN (OLD.status IS DISTINCT FROM NEW.status) clause means the
-- trigger only fires on real status changes — discount UPDATEs, item adds
-- via the recalc trigger, customer-note edits, etc. all skip it cheaply.

CREATE TRIGGER validate_order_status_transition
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.validate_order_status_transition();
