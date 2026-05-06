-- Rollback for 20260506000002_tenant_refund_confirm_threshold.sql.
-- The column is a pure UX setting with no foreign keys or dependent
-- constraints; safe to drop unconditionally.

BEGIN;

ALTER TABLE public.cafe_settings
  DROP COLUMN IF EXISTS refund_type_to_confirm_threshold;

COMMIT;
