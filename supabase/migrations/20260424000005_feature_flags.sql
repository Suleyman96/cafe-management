-- ============================================================
-- SCALE-27: Feature flags via cafe_settings
-- Adds a generic JSONB column for per-tenant feature toggles.
-- ============================================================

ALTER TABLE public.cafe_settings
ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}'::JSONB;

COMMENT ON COLUMN public.cafe_settings.feature_flags IS
  'Per-tenant feature toggles. Keys: feature name (string), values: boolean.';
