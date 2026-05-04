-- Rollback for 20260504000007_order_status_state_machine.sql.
-- Drops the validation function. The trigger is dropped first by the
-- 20260504000008 rollback so this DROP FUNCTION succeeds without CASCADE.

DROP FUNCTION IF EXISTS public.validate_order_status_transition();
