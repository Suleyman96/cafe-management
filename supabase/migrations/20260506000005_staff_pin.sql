-- ============================================================
-- Post-audit Plan 13: idle-session soft-lock backing storage.
-- ============================================================
--
-- Problem: a tablet at a host stand stays authenticated indefinitely. After
-- 60 min of no input on a staff-web tab, the UI now blurs and demands a PIN
-- re-entry (see apps/staff-web/src/components/auth/idle-soft-lock.tsx).
--
-- This migration only adds storage:
--   - staff.pin_hash, staff.pin_set_at: the PIN itself is hashed in Node
--     (apps/staff-web/src/lib/api/pin-hash.ts using crypto.scryptSync) and
--     written via /api/v1/staff/pin. We do not use pgcrypto here — the
--     verification endpoint runs in the API route, not in SQL, so keeping
--     the KDF in one place (Node) is simpler than splitting between
--     scrypt-in-Node and crypt-in-Postgres.
--   - cafe_settings.idle_soft_lock_minutes: per-tenant tuning. CHECK keeps
--     it in a sane range — too short locks staff mid-order, too long
--     defeats the point.
--
-- Both columns are nullable / defaulted, so existing rows are untouched.
-- The feature itself is gated client-side by feature flag
-- `idle_soft_lock_pin` (per CLAUDE.md feature-flag rule for staged
-- rollouts), so this storage being present does not change behavior on
-- its own.

BEGIN;

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS pin_set_at TIMESTAMPTZ;

COMMENT ON COLUMN public.staff.pin_hash IS
  'Optional staff PIN for the idle soft-lock (Plan 13). Hashed via crypto.scryptSync in apps/staff-web/src/lib/api/pin-hash.ts. NULL means the staff member has not set a PIN yet — the soft-lock falls back to the password reauth path.';

COMMENT ON COLUMN public.staff.pin_set_at IS
  'When the current PIN was last set. Surfaced in the settings UI so admins/staff know if a stale PIN should be rotated.';

ALTER TABLE public.cafe_settings
  ADD COLUMN IF NOT EXISTS idle_soft_lock_minutes INTEGER NOT NULL DEFAULT 60;

-- Bounds: 5 minutes is the floor (anything shorter would lock cashiers
-- mid-payment); 8 hours is the ceiling (a full shift — beyond which the
-- feature provides no security value over an absent timeout).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cafe_settings_idle_soft_lock_minutes_chk'
  ) THEN
    ALTER TABLE public.cafe_settings
      ADD CONSTRAINT cafe_settings_idle_soft_lock_minutes_chk
        CHECK (idle_soft_lock_minutes BETWEEN 5 AND 480);
  END IF;
END $$;

COMMENT ON COLUMN public.cafe_settings.idle_soft_lock_minutes IS
  'Minutes of inactivity before staff-web blurs the UI and requires PIN re-entry (Plan 13). Bounded 5-480 by check constraint.';

COMMIT;
