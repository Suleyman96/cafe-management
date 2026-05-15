-- ============================================================
-- Single source of truth for the plan matrix.
--
-- Before this migration: four independent SQL definitions hardcoded
-- the same caps and feature flags, with drift accumulating quietly:
--
--   - plan_allows_feature()    feature flags (RLS helper)
--   - plan_allows_new_table()  table cap (trigger + RLS helper)
--   - check_table_limit()      table cap (orphan legacy trigger fn)
--   - check_order_limit()      order cap (active trigger)
--
-- Each had its own CASE block over plan name, and they had already
-- drifted by the time of this audit:
--   * `business` was finite (999 / 999999) in check_table_limit and
--     check_order_limit, but -1 (unlimited) in plan_allows_new_table
--     and @gustri/core PLAN_LIMITS — fixed in 20260515000001.
--   * check_table_limit counted all rows; plan_allows_new_table
--     counted only `is_active = true` — fixed in 20260513000001 by
--     dropping the legacy trigger.
--
-- This migration completes the consolidation:
--   1. Introduces a single SQL function `plan_limits(plan text)`
--      returning a composite of every per-plan limit. Mirrors
--      @gustri/core PLAN_LIMITS row-by-row.
--   2. Refactors plan_allows_feature and plan_allows_new_table to
--      consult plan_limits instead of their own CASE blocks.
--   3. Refactors check_order_limit to consult plan_limits AND raise
--      the `plan_required` sentinel (errcode P0001) instead of
--      English text. handleSupabaseError now maps that to
--      AuthorizationError('plan_required'), which the mutation cache
--      onError localizes via @gustri/i18n localizeErrorMessage.
--   4. Drops the orphan check_table_limit() function (dead code
--      after 20260513000001 dropped its trigger).
--
-- A CI integration test asserts plan_limits(p) returns the same
-- shape as PLAN_LIMITS[p] in TypeScript for every plan; adding a
-- new plan or changing a cap requires updating both, and the test
-- enforces the sync.
-- ============================================================

-- Composite return type. Postgres composite types serialize to
-- JSON via PostgREST, so supabase-js test clients see this as a
-- plain object: { max_tables, max_orders_per_month, ... }.
DROP TYPE IF EXISTS public.plan_limits_t CASCADE;
CREATE TYPE public.plan_limits_t AS (
  max_tables int,
  max_orders_per_month int,
  qr_ordering bool,
  kitchen_display bool,
  inventory bool,
  waste bool,
  scheduling bool,
  tasks bool,
  custom_branding bool,
  analytics text
);

CREATE OR REPLACE FUNCTION public.plan_limits(plan text)
RETURNS public.plan_limits_t
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  result public.plan_limits_t;
BEGIN
  -- Field order MUST match the composite type declaration above.
  -- The COALESCE/ELSE fallbacks default to free caps (fail-closed)
  -- so an unknown or NULL plan never silently grants paid features.
  CASE COALESCE(plan, 'free')
    WHEN 'free' THEN
      result := (5,  100,  false, true, false, false, false, false, false, 'basic');
    WHEN 'standard' THEN
      result := (10, 700,  true,  true, false, false, false, false, true,  'full');
    WHEN 'pro' THEN
      result := (20, 2200, true,  true, true,  true,  true,  true,  true,  'full');
    WHEN 'business' THEN
      result := (-1, -1,   true,  true, true,  true,  true,  true,  true,  'full');
    ELSE
      result := (5,  100,  false, true, false, false, false, false, false, 'basic');
  END CASE;
  RETURN result;
END;
$$;

-- plan_limits is a pure function over public knowledge (plan tiers
-- are marketed publicly). Granted to anon + authenticated so the
-- RLS sync test can call it without a service_role token.
REVOKE EXECUTE ON FUNCTION public.plan_limits(text) FROM public;
GRANT EXECUTE ON FUNCTION public.plan_limits(text) TO anon, authenticated;

COMMENT ON FUNCTION public.plan_limits(text) IS
  'Single source of truth for plan caps + feature flags. Mirrors @gustri/core PLAN_LIMITS — a CI integration test asserts row-by-row equality. Update both together.';

-- ============================================================
-- Refactor plan_allows_feature: now reads from plan_limits.
-- ============================================================
CREATE OR REPLACE FUNCTION public.plan_allows_feature(feature text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_tenant uuid;
  caller_plan text;
  limits public.plan_limits_t;
BEGIN
  caller_tenant := public.current_tenant_id();
  IF caller_tenant IS NULL THEN
    RETURN false;
  END IF;

  SELECT plan INTO caller_plan FROM public.tenants WHERE id = caller_tenant;
  IF caller_plan IS NULL THEN
    RETURN false;
  END IF;

  limits := public.plan_limits(caller_plan);

  CASE feature
    WHEN 'inventory'       THEN RETURN limits.inventory;
    WHEN 'waste'           THEN RETURN limits.waste;
    WHEN 'scheduling'      THEN RETURN limits.scheduling;
    WHEN 'tasks'           THEN RETURN limits.tasks;
    WHEN 'qr_ordering'     THEN RETURN limits.qr_ordering;
    WHEN 'custom_branding' THEN RETURN limits.custom_branding;
    ELSE
      -- Unknown feature name default-denies — a typo at a call site
      -- can't accidentally grant access.
      RETURN false;
  END CASE;
END;
$$;

COMMENT ON FUNCTION public.plan_allows_feature(text) IS
  'Returns TRUE when the caller''s tenant plan permits the named feature. Delegates to plan_limits() for the matrix.';

-- ============================================================
-- Refactor plan_allows_new_table: now reads from plan_limits.
-- ============================================================
CREATE OR REPLACE FUNCTION public.plan_allows_new_table(target_tenant uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_plan text;
  limits public.plan_limits_t;
  active_count int;
BEGIN
  IF target_tenant IS NULL THEN
    RETURN false;
  END IF;

  SELECT plan INTO caller_plan FROM public.tenants WHERE id = target_tenant;
  IF caller_plan IS NULL THEN
    RETURN false;
  END IF;

  limits := public.plan_limits(caller_plan);

  -- -1 = unlimited (business).
  IF limits.max_tables = -1 THEN
    RETURN true;
  END IF;

  SELECT COUNT(*)::int INTO active_count
  FROM public.tables
  WHERE tenant_id = target_tenant AND is_active = true;

  RETURN active_count < limits.max_tables;
END;
$$;

COMMENT ON FUNCTION public.plan_allows_new_table(uuid) IS
  'Returns TRUE when the tenant has room for one more active table under their plan. Delegates to plan_limits() for the cap.';

-- ============================================================
-- Refactor check_order_limit: now reads from plan_limits AND
-- raises the `plan_required` sentinel (P0001) so the client gets
-- a localized error via handleSupabaseError → AuthorizationError
-- → localizeErrorMessage. Pre-this-migration it raised the
-- English text "Monthly order limit reached for X plan (max Y)",
-- which handle-route-error.ts substring-matched to a 403 — a
-- fragile pattern this migration eliminates.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_order_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan text;
  v_count int;
  limits public.plan_limits_t;
BEGIN
  SELECT t.plan INTO v_plan FROM public.tenants t WHERE t.id = NEW.tenant_id;

  limits := public.plan_limits(v_plan);

  -- -1 = unlimited (business). Skip the COUNT(*) roundtrip.
  IF limits.max_orders_per_month = -1 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.orders
  WHERE tenant_id = NEW.tenant_id
    AND created_at >= date_trunc('month', NOW());

  IF v_count >= limits.max_orders_per_month THEN
    RAISE EXCEPTION 'plan_required' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- Drop the orphan check_table_limit() function. After
-- 20260513000001 dropped its trigger this function has been dead
-- code, and removing it now reduces drift surface.
-- ============================================================
DROP FUNCTION IF EXISTS public.check_table_limit();
