-- Backfill onboarding_completed_at for pre-existing tenants.
--
-- Migration 20260728000002 added cafe_settings.onboarding_completed_at (default
-- NULL) and the staff-web landing routes any tenant with NULL to /onboarding.
-- But it never backfilled — so every cafe that existed BEFORE the onboarding
-- feature deployed (already named, with menu items and tables) is now forced
-- through the first-run checklist on every visit until an owner clicks "finish".
--
-- Any tenant that exists at the moment this migration runs is by definition not
-- a first-run tenant, so mark their onboarding complete. New tenants provisioned
-- AFTER this migration still start with NULL (their cafe_settings row is created
-- by the signup trigger, which runs later) and correctly see the checklist.
--
-- Idempotent: the IS NULL guard means a re-run touches nothing.
UPDATE public.cafe_settings
SET onboarding_completed_at = now()
WHERE onboarding_completed_at IS NULL;
