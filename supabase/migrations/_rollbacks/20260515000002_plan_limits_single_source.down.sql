-- Rollback for the plan_limits single-source-of-truth migration.
-- Restores the per-function CASE blocks to the state after
-- 20260515000001 (PR #142 business-tier cap fix). Recreates the
-- orphan check_table_limit() function so consumers of this rollback
-- can also roll back 20260513000001 (table-cap trigger dedup) if
-- needed.

-- Restore plan_allows_feature() with its own CASE block.
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
BEGIN
  caller_tenant := public.current_tenant_id();
  IF caller_tenant IS NULL THEN
    RETURN false;
  END IF;

  SELECT plan INTO caller_plan FROM public.tenants WHERE id = caller_tenant;
  IF caller_plan IS NULL THEN
    RETURN false;
  END IF;

  CASE feature
    WHEN 'inventory' THEN
      RETURN caller_plan IN ('pro', 'business');
    WHEN 'waste' THEN
      RETURN caller_plan IN ('pro', 'business');
    WHEN 'scheduling' THEN
      RETURN caller_plan IN ('pro', 'business');
    WHEN 'tasks' THEN
      RETURN caller_plan IN ('pro', 'business');
    WHEN 'qr_ordering' THEN
      RETURN caller_plan IN ('standard', 'pro', 'business');
    WHEN 'custom_branding' THEN
      RETURN caller_plan IN ('standard', 'pro', 'business');
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- Restore plan_allows_new_table() with its own CASE block.
CREATE OR REPLACE FUNCTION public.plan_allows_new_table(target_tenant uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_plan text;
  cap int;
  active_count int;
BEGIN
  IF target_tenant IS NULL THEN
    RETURN false;
  END IF;

  SELECT plan INTO caller_plan FROM public.tenants WHERE id = target_tenant;
  IF caller_plan IS NULL THEN
    RETURN false;
  END IF;

  CASE caller_plan
    WHEN 'free'     THEN cap := 5;
    WHEN 'standard' THEN cap := 10;
    WHEN 'pro'      THEN cap := 20;
    WHEN 'business' THEN cap := -1;
    ELSE cap := 0;
  END CASE;

  IF cap = -1 THEN
    RETURN true;
  END IF;

  SELECT COUNT(*)::int INTO active_count
  FROM public.tables
  WHERE tenant_id = target_tenant AND is_active = true;

  RETURN active_count < cap;
END;
$$;

-- Restore check_order_limit() with English RAISE and own CASE block
-- (state after 20260515000001 business-cap fix).
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

-- Recreate the orphan check_table_limit() function. The trigger
-- enforce_table_limit was dropped by 20260513000001; this rollback
-- restores the function only (no trigger) for completeness.
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

-- Drop the plan_limits function + type last so the refactored
-- callers above don't reference a missing dependency at any point
-- during rollback.
DROP FUNCTION IF EXISTS public.plan_limits(text);
DROP TYPE IF EXISTS public.plan_limits_t;
