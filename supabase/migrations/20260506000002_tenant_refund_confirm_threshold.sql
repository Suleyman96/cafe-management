-- ============================================================
-- Post-audit Plan 3: refund / discount confirm step threshold.
-- ============================================================
--
-- Goal: refunds and manual discount overrides above a tenant-configurable
-- amount require an explicit type-to-confirm step in the staff-web UI.
-- Below the threshold, the existing summary-then-submit flow stands so
-- small refunds keep low friction.
--
-- This is a tenant-level operational setting only — no server-side
-- enforcement. The actual gate lives in the client modal because the
-- threshold is purely a UX guard against £200 misclicks; the server
-- still validates `amount <= total_paid - total_refunded` independently
-- via `process_refund` (migration 20260505000002), so a malicious client
-- can't escape the underlying money-safety invariants by skipping the
-- prompt.
--
-- Why NUMERIC and not INT: matches the precision of order totals
-- elsewhere (`orders.total NUMERIC(14,4)`); the threshold is compared
-- against currency amounts and a decimal is sometimes useful (e.g.,
-- 49.99). Default 100 is in tenant currency — owners tune via the
-- existing settings UI.
--
-- Rollout: column is nullable-with-default, so existing rows pick up
-- the default automatically. No backfill required.

BEGIN;

ALTER TABLE public.cafe_settings
  ADD COLUMN IF NOT EXISTS refund_type_to_confirm_threshold NUMERIC(14, 4) DEFAULT 100 NOT NULL;

COMMENT ON COLUMN public.cafe_settings.refund_type_to_confirm_threshold IS
  'Amount in tenant currency above which staff-web requires a type-to-confirm step on refunds and manual discount overrides. Owner-configurable. Pure UX guard; server-side money-safety invariants are independent of this value.';

COMMIT;
