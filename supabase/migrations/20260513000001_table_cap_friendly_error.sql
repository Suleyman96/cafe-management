-- ============================================================
-- Friendly table-cap error + dedup of redundant baseline trigger.
--
-- Before this migration there were three (!) enforcement layers on
-- `tables` insert, with drifted semantics:
--
--   1. Baseline trigger `enforce_table_limit` → `check_table_limit()`
--      Counts ALL rows (not active-only). English RAISE EXCEPTION
--      ("Table limit reached for X plan (max Y)") that
--      handle-route-error.ts substring-matches to return 403.
--
--   2. RLS RESTRICTIVE policy `plan_tables_insert` (migration
--      20260429000003) → `plan_allows_new_table()`. Counts ACTIVE
--      rows only. Returns false → Postgres rejects with code 42501
--      ("new row violates row-level security policy"), which the
--      client renders as a bare "Insufficient privileges" toast.
--
--   3. (NEW in this migration) BEFORE INSERT trigger raising the
--      `plan_required` sentinel with errcode P0001. Same counting
--      semantics as the RLS policy (active rows only) because it
--      shares `plan_allows_new_table()`.
--
-- Concrete failure on the unpatched state: pro tenant with 19 active
-- + 5 inactive tables.
--   - This trigger (active only): 19 < 20 → allow
--   - Baseline trigger (all rows): 24 >= 20 → reject with English
--     "Table limit reached for pro plan (max 20)"
-- Both triggers fired (BEFORE INSERT row triggers run in alpha order
-- by name; this one fires first). The user saw the baseline's
-- English error, not the localized sentinel — which was the whole
-- motivation for adding this trigger.
--
-- This migration:
--   - Adds the friendly trigger (raises plan_required / P0001).
--   - Drops the redundant baseline trigger `enforce_table_limit` so
--     only one trigger runs and `active`-only counting wins. The RLS
--     policy `plan_tables_insert` stays as defense-in-depth.
--   - Leaves the now-orphaned `check_table_limit()` function in place
--     to avoid colliding with the parallel `CREATE OR REPLACE` in
--     migration 20260515000001 (PR #142, business-tier cap fix). A
--     follow-up after both PRs land can drop the function.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_table_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.plan_allows_new_table(NEW.tenant_id) THEN
    RAISE EXCEPTION 'plan_required' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_table_cap() FROM public;

DROP TRIGGER IF EXISTS enforce_table_cap_trigger ON public.tables;

CREATE TRIGGER enforce_table_cap_trigger
  BEFORE INSERT ON public.tables
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_table_cap();

COMMENT ON FUNCTION public.enforce_table_cap() IS
  'Raises plan_required (P0001) when the tenant has no room for another table under their plan. Friendly-error layer over the plan_tables_insert RLS policy.';

-- Drop the redundant baseline trigger. The function it called
-- (check_table_limit) is intentionally NOT dropped here — see header
-- comment for rationale (avoids migration-ordering hazard with #142).
DROP TRIGGER IF EXISTS enforce_table_limit ON public.tables;
