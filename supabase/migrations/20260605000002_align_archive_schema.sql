-- Fix data-retention archival broken by schema drift (M11 / L4).
--
-- `run_data_retention()` (migration 20260424000004) archives aged rows with
-- `INSERT INTO archive.X SELECT * FROM public.X`. That positional copy requires
-- archive.X to have the SAME columns, in the same order, as public.X. Since the
-- archive tables were snapshotted, public.orders / order_items /
-- financial_audit_log each gained columns via later migrations:
--   * orders            : force_close_reason (20260506000003), version (20260506000004)
--   * order_items       : category_id (category snapshot), selected_options (20260604000002)
--   * financial_audit_log: triggered_by_request_id
-- so the archive INSERT now throws 42601 "INSERT has more expressions than
-- target columns" the moment there's an aged order to archive — i.e. the
-- retention endpoint is broken in production for any recent order.
--
-- Fix: add the missing columns to the archive tables, in the same order
-- Postgres appended them to the public tables (ALTER ADD COLUMN always appends),
-- so the positional `SELECT *` realigns. Archive columns are plain nullable
-- storage — no constraints/defaults needed; the SELECT supplies every value.
--
-- INVARIANT going forward: any migration that ADDs a column to public.orders,
-- public.order_items, public.order_payments, public.refunds,
-- public.table_transfers, or public.financial_audit_log MUST mirror it here,
-- or run_data_retention breaks. (table_transfers joined the archived set in
-- 20261010000004_retention_archive_financial.sql — its archive table is
-- created there via LIKE INCLUDING ALL, so it is column-aligned as of that
-- migration; future columns on it must be mirrored here too.)
-- The `data-retention` RLS test archives a real order+item (+refund+audit
-- +transfer) and will fail if this drifts again.

BEGIN;

ALTER TABLE archive.orders ADD COLUMN IF NOT EXISTS force_close_reason text;
ALTER TABLE archive.orders ADD COLUMN IF NOT EXISTS version integer;

ALTER TABLE archive.order_items ADD COLUMN IF NOT EXISTS category_id uuid;
ALTER TABLE archive.order_items ADD COLUMN IF NOT EXISTS selected_options jsonb;

ALTER TABLE archive.financial_audit_log ADD COLUMN IF NOT EXISTS triggered_by_request_id uuid;

COMMIT;
