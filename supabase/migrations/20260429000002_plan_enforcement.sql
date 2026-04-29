-- ============================================================
-- C5. Server-side plan enforcement at the database layer.
--
-- The mobile + web apps hide pro-tier UI based on a client-side
-- `tenantPlan` flag. Routes that go through `/api/v1/*` get a
-- TypeScript `verifyPlan` middleware, but several pro features
-- (tasks, waste logs, staff schedules) write directly via
-- `@gustri/api-client` against the user's session client. RLS is
-- the only layer that can stop a modified client there.
--
-- This migration adds a helper `plan_allows_feature(feature)` that
-- consults `tenants.plan` for the caller's tenant, and a RESTRICTIVE
-- RLS policy on each pro-only table that requires the helper to
-- return TRUE for INSERT/UPDATE. RESTRICTIVE policies are AND-ed
-- with existing PERMISSIVE policies — the staff-role and tenant-
-- isolation policies still gate, and the new policy is an
-- additional gate that closes the plan-tier hole.
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
BEGIN
  caller_tenant := public.current_tenant_id();
  IF caller_tenant IS NULL THEN
    RETURN false;
  END IF;

  SELECT plan INTO caller_plan FROM public.tenants WHERE id = caller_tenant;
  IF caller_plan IS NULL THEN
    RETURN false;
  END IF;

  -- Mirror of @gustri/core PLAN_LIMITS. Keep these in sync; the TS
  -- copy is the design source of truth and this helper is the
  -- last-line server enforcement.
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
      -- Unknown feature names default-deny so a typo at a call site
      -- can't accidentally grant access.
      RETURN false;
  END CASE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.plan_allows_feature(text) FROM public;
GRANT EXECUTE ON FUNCTION public.plan_allows_feature(text) TO authenticated;

COMMENT ON FUNCTION public.plan_allows_feature(text) IS
  'Returns TRUE when the caller''s tenant plan permits the named feature. Mirror of @gustri/core PLAN_LIMITS.';

-- RESTRICTIVE policies: AND-ed with existing PERMISSIVE policies.
-- The names are namespaced ("plan_") so they don't collide with the
-- existing per-table policies. SELECT/DELETE are intentionally not
-- gated — read access stays available even after a downgrade so a
-- tenant can still see (and clean up) their pro-tier data.

CREATE POLICY plan_inventory_insert
  ON public.stock_movements
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.plan_allows_feature('inventory'));

CREATE POLICY plan_inventory_update
  ON public.stock_movements
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.plan_allows_feature('inventory'))
  WITH CHECK (public.plan_allows_feature('inventory'));

CREATE POLICY plan_inventory_items_insert
  ON public.stock_items
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.plan_allows_feature('inventory'));

CREATE POLICY plan_inventory_items_update
  ON public.stock_items
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.plan_allows_feature('inventory'))
  WITH CHECK (public.plan_allows_feature('inventory'));

CREATE POLICY plan_waste_insert
  ON public.waste_logs
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.plan_allows_feature('waste'));

CREATE POLICY plan_waste_update
  ON public.waste_logs
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.plan_allows_feature('waste'))
  WITH CHECK (public.plan_allows_feature('waste'));

CREATE POLICY plan_schedules_insert
  ON public.staff_schedules
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.plan_allows_feature('scheduling'));

CREATE POLICY plan_schedules_update
  ON public.staff_schedules
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.plan_allows_feature('scheduling'))
  WITH CHECK (public.plan_allows_feature('scheduling'));

CREATE POLICY plan_tasks_insert
  ON public.tasks
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.plan_allows_feature('tasks'));

CREATE POLICY plan_tasks_update
  ON public.tasks
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.plan_allows_feature('tasks'))
  WITH CHECK (public.plan_allows_feature('tasks'));
