-- Rollback for 20260507000002_anon_write_velocity_trigger.sql.
--
-- Drops triggers and functions but keeps the supporting indexes —
-- they're harmless when the triggers are gone, and a re-apply doesn't
-- need to recreate them. If you want a fully clean slate, drop the
-- indexes manually after running this rollback.

BEGIN;

DROP TRIGGER IF EXISTS waiter_calls_velocity_guard ON public.waiter_calls;
DROP FUNCTION IF EXISTS public.guard_waiter_call_velocity();

DROP TRIGGER IF EXISTS customer_feedback_velocity_guard ON public.customer_feedback;
DROP FUNCTION IF EXISTS public.guard_customer_feedback_velocity();

COMMIT;
