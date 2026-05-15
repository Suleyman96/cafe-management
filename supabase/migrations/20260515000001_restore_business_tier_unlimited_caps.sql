-- ============================================================
-- Restore business-tier unlimited caps on tables and monthly orders.
--
-- Migration 20260430000002 (security hardening) added a COALESCE
-- fallback so an unknown plan defaults to 'free' caps — that part is
-- correct. But in the same edit, the business branch silently changed
-- from -1 (unlimited) to finite numbers:
--
--   check_table_limit : business → 999     (was -1, unlimited)
--   check_order_limit : business → 999999  (was -1, unlimited)
--
-- This contradicts:
--   - @gustri/core PLAN_LIMITS.business → maxTables: -1, maxOrdersPerMonth: -1
--   - plan_allows_new_table from migration 20260429000003 → unlimited
--
-- A business-tier tenant who grows past 999 active tables (multi-location
-- chain) or 999,999 orders/month hits a hard wall with the misleading
-- error "Table limit reached for business plan (max 999)" on a plan
-- they paid for precisely to NOT have a cap.
--
-- This migration:
--   1. Restores business → -1 in both functions.
--   2. Adds `IF v_max = -1 THEN RETURN NEW` early return so business
--      callers don't pay the COUNT(*) roundtrip on every insert.
--
-- Every other branch (free/standard/pro) and the COALESCE-to-free
-- hardening from 20260430000002 are preserved verbatim. Error message
-- format is unchanged because handle-route-error.ts substring-matches
-- "order limit reached" / "table limit reached" to return 403; changing
-- the format here would silently fall through to a generic 500.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_order_limit() RETURNS TRIGGER
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_plan TEXT;
  v_count INT;
  v_max INT;
BEGIN
  SELECT t.plan INTO v_plan FROM public.tenants t WHERE t.id = NEW.tenant_id;

  v_max := CASE COALESCE(v_plan, 'free')
    WHEN 'free' THEN 100
    WHEN 'standard' THEN 700
    WHEN 'pro' THEN 2200
    WHEN 'business' THEN -1
    ELSE 100
  END;

  IF v_max = -1 THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_count FROM public.orders
  WHERE tenant_id = NEW.tenant_id
    AND created_at >= date_trunc('month', NOW());

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Monthly order limit reached for % plan (max %)',
      COALESCE(v_plan, 'free'), v_max;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_table_limit() RETURNS TRIGGER
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_plan TEXT;
  v_count INT;
  v_max INT;
BEGIN
  SELECT t.plan INTO v_plan FROM public.tenants t WHERE t.id = NEW.tenant_id;

  v_max := CASE COALESCE(v_plan, 'free')
    WHEN 'free' THEN 5
    WHEN 'standard' THEN 10
    WHEN 'pro' THEN 20
    WHEN 'business' THEN -1
    ELSE 5
  END;

  IF v_max = -1 THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_count FROM public.tables WHERE tenant_id = NEW.tenant_id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Table limit reached for % plan (max %)',
      COALESCE(v_plan, 'free'), v_max;
  END IF;

  RETURN NEW;
END;
$$;
