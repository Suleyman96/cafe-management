-- Rollback for 20260506000005_staff_pin.sql.
--
-- Drops the PIN columns and the per-tenant idle minutes setting. PIN data
-- is not preserved — once the feature is rolled back, staff would not have
-- a verifier for an already-set PIN, so deleting the hashes is correct
-- rather than leaving them stranded.

BEGIN;

ALTER TABLE public.cafe_settings
  DROP CONSTRAINT IF EXISTS cafe_settings_idle_soft_lock_minutes_chk;

ALTER TABLE public.cafe_settings
  DROP COLUMN IF EXISTS idle_soft_lock_minutes;

ALTER TABLE public.staff
  DROP COLUMN IF EXISTS pin_set_at,
  DROP COLUMN IF EXISTS pin_hash;

COMMIT;
