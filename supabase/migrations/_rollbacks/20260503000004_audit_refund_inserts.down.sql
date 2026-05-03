-- Rollback for 20260503000004_audit_refund_inserts.sql.
-- Removes the refund trigger, the trigger function, and the audit columns added
-- for refund context. Backfilled rows are deleted because the details column
-- they live in is being dropped.

BEGIN;

DROP TRIGGER IF EXISTS trg_log_refund_on_insert ON public.refunds;
DROP FUNCTION IF EXISTS public.log_refund_on_insert();

DELETE FROM public.financial_audit_log WHERE action = 'refund';

DROP INDEX IF EXISTS public.idx_financial_audit_staff;

ALTER TABLE public.financial_audit_log
  DROP COLUMN IF EXISTS details,
  DROP COLUMN IF EXISTS staff_id;

COMMIT;
