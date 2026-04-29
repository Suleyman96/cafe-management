-- ============================================================
-- C5 follow-up. Server-enforced table cap.
--
-- The web app's `useCreateTable` does a soft pre-check against
-- PLAN_LIMITS[plan].maxTables, but a modified client could call
-- the wrapper's `tables.create` directly. RLS is the only layer
-- that can stop it. The check counts only ACTIVE rows so a tenant
-- that downgraded after creating extra tables can still keep them
-- read-only — only NEW inserts are rejected once over the cap.
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

  -- Mirror of @gustri/core PLAN_LIMITS[*].maxTables. -1 = unlimited.
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

REVOKE EXECUTE ON FUNCTION public.plan_allows_new_table(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.plan_allows_new_table(uuid) TO authenticated;

COMMENT ON FUNCTION public.plan_allows_new_table(uuid) IS
  'Returns TRUE when the tenant has room for one more active table under their plan. Mirror of @gustri/core PLAN_LIMITS[*].maxTables.';

CREATE POLICY plan_tables_insert
  ON public.tables
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.plan_allows_new_table(tenant_id));
