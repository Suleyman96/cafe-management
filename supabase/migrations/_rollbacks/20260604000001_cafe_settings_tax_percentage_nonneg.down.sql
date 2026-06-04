-- Rollback for 20260604000001_cafe_settings_tax_percentage_nonneg.sql
ALTER TABLE cafe_settings
  DROP CONSTRAINT IF EXISTS cafe_settings_tax_percentage_nonneg;
