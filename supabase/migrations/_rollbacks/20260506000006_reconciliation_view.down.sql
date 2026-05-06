-- Rollback for 20260506000006_reconciliation_view.sql.
-- Drops the RPC. No data to preserve — pure function.

BEGIN;

DROP FUNCTION IF EXISTS public.get_shift_reconciliation(TIMESTAMPTZ, TIMESTAMPTZ);

COMMIT;
