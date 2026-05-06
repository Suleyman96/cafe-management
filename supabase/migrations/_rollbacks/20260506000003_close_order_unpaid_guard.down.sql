-- Rollback for 20260506000003_close_order_unpaid_guard.sql.
-- Drops the trigger + function, then drops force_close_reason ONLY if no
-- row carries one. Force-close reasons are auditable history; if any close
-- has fired during the trigger's lifetime, preserve the column.

BEGIN;

DROP TRIGGER IF EXISTS guard_close_order_unpaid ON public.orders;
DROP FUNCTION IF EXISTS public.guard_close_order_unpaid();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE force_close_reason IS NOT NULL
    LIMIT 1
  ) THEN
    ALTER TABLE public.orders DROP COLUMN IF EXISTS force_close_reason;
  ELSE
    RAISE NOTICE 'orders.force_close_reason has data; preserving.';
  END IF;
END $$;

COMMIT;
