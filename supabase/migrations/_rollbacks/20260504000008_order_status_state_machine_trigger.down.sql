-- Rollback for 20260504000008_order_status_state_machine_trigger.sql.
-- Drops the trigger. Run this BEFORE the 20260504000007 rollback so the
-- trigger doesn't reference a missing function.

DROP TRIGGER IF EXISTS validate_order_status_transition ON public.orders;
