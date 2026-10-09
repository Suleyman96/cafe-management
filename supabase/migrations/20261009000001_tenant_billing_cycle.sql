-- Billing cadence (monthly vs yearly) for a tenant's paid plan.
--
-- Cadence is ORTHOGONAL to the plan tier: monthly and yearly buy the SAME
-- capabilities (PLAN_LIMITS in @gustri/core is keyed by tier only) — they
-- differ only in price and renewal interval. So this is a single nullable
-- column, NOT a new tier/plan value.
--
-- The paid-through date reuses the existing `current_period_end` column (added
-- in 20260728000001); no new date column. Free/unset tenants leave both NULL.
--
-- RLS: writes to `tenants` are service-role only (via the /api/v1/platform/*
-- console routes) — there is no client INSERT/UPDATE policy. The existing
-- row-level SELECT policy (`tenant_read_own`) already covers this new column
-- unchanged: a tenant reads its own row (including billing_cycle), only the
-- service role writes it. No RLS change needed. Non-destructive → no rollback.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS billing_cycle text;

-- Constrain to the two supported cadences; NULL = free/unset (a CHECK passes
-- for NULL). Added idempotently so a re-run doesn't error on an existing
-- constraint (ADD CONSTRAINT has no IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_billing_cycle_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_billing_cycle_check
      CHECK (billing_cycle IN ('monthly', 'yearly'));
  END IF;
END $$;

COMMENT ON COLUMN public.tenants.billing_cycle IS
  'Billing cadence for the paid plan: monthly | yearly. NULL for free/unset. Orthogonal to `plan` (same capabilities either way); the paid-through date lives in `current_period_end`.';
