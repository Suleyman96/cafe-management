-- Rollback for 20260605000002_align_archive_schema.sql
--
-- Drops the columns re-added to the archive tables. NOTE: this reinstates the
-- schema-drift bug — run_data_retention will 42601 again on aged orders.

BEGIN;

ALTER TABLE archive.orders DROP COLUMN IF EXISTS force_close_reason;
ALTER TABLE archive.orders DROP COLUMN IF EXISTS version;

ALTER TABLE archive.order_items DROP COLUMN IF EXISTS category_id;
ALTER TABLE archive.order_items DROP COLUMN IF EXISTS selected_options;

ALTER TABLE archive.financial_audit_log DROP COLUMN IF EXISTS triggered_by_request_id;

COMMIT;
