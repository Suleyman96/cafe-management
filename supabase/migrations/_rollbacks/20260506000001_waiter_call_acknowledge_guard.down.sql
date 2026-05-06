-- Rollback for 20260506000001_waiter_call_acknowledge_guard.sql.
-- Drops the triggers and guard functions, removes the partial unique
-- indexes, and drops the new columns ONLY if no rows reference them.
-- Idempotency keys are operationally valuable; if any row carries one,
-- preserve the column rather than lose provenance on a rollback.

BEGIN;

DROP TRIGGER IF EXISTS waiter_calls_guard_ack ON public.waiter_calls;
DROP TRIGGER IF EXISTS waiter_calls_guard_resolve ON public.waiter_calls;

DROP FUNCTION IF EXISTS public.guard_waiter_call_acknowledge();
DROP FUNCTION IF EXISTS public.guard_waiter_call_resolve();

DROP INDEX IF EXISTS public.waiter_calls_ack_dedupe;
DROP INDEX IF EXISTS public.waiter_calls_resolve_dedupe;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.waiter_calls
    WHERE acknowledged_client_request_id IS NOT NULL
       OR resolved_client_request_id IS NOT NULL
    LIMIT 1
  ) THEN
    ALTER TABLE public.waiter_calls
      DROP COLUMN IF EXISTS acknowledged_client_request_id,
      DROP COLUMN IF EXISTS resolved_client_request_id;
  ELSE
    RAISE NOTICE 'waiter_calls.*_client_request_id columns have data; preserving.';
  END IF;
END $$;

COMMIT;
