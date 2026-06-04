-- Enforce a non-negative tax_percentage on cafe_settings.
--
-- Defense-in-depth for the tax math in @gustri/core
-- (calculateTaxWithSettings / getDisplaySubtotal). In the tax-inclusive
-- branch a tax_percentage <= -100 makes (1 + rate) <= 0 and divides by
-- zero/Infinity, and any corrupt value silently poisons every downstream
-- order total. The core helpers now clamp non-finite/negative rates to 0;
-- this constraint stops bad data at the source.
--
-- tax_percentage defaults to 18.00 and is NOT NULL, so existing rows already
-- satisfy >= 0. Idempotent — safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cafe_settings_tax_percentage_nonneg'
  ) THEN
    ALTER TABLE cafe_settings
      ADD CONSTRAINT cafe_settings_tax_percentage_nonneg
      CHECK (tax_percentage >= 0);
  END IF;
END $$;
