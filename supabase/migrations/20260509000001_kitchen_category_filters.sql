-- ============================================================
-- Kitchen category filters
--
-- Per-staff selection of menu categories that should appear on
-- that staff's kitchen screen. Empty set (no rows for a staff)
-- means "show all categories" — this is enforced in the read
-- path, not in the schema, so an accidental delete-all never
-- produces a blank kitchen screen.
--
-- Today's table is per-staff. The shape is intentionally a
-- strict subset of a future per-station model: a follow-up can
-- introduce kitchen_stations + station_kitchen_filters with the
-- same (scope_id, category_id) pair structure, and existing rows
-- migrate as-is.
--
-- The filter is a UX preference, NOT an authorization boundary.
-- order_items RLS (already tenant-scoped) is the data boundary.
-- A spoofed client filter cannot widen visibility — it can only
-- hide items the staff is already permitted to see.
--
-- NOTE: Indexes are plain CREATE INDEX (not CONCURRENTLY)
-- because Supabase CLI's pipelined `db reset` rejects
-- CONCURRENTLY. See 20260429000001_staff_push_tokens.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.staff_kitchen_filters (
  staff_id    uuid NOT NULL REFERENCES public.staff(id)      ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id)    ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, category_id)
);

CREATE INDEX IF NOT EXISTS staff_kitchen_filters_tenant_staff_idx
  ON public.staff_kitchen_filters (tenant_id, staff_id);

-- ============================================================
-- Cross-tenant guard. Without this trigger an authenticated
-- staff member could insert a row whose category_id belongs to
-- a different tenant — RLS would reject the read but the write
-- would succeed and leave junk data. Belt-and-suspenders next
-- to the RLS policies below.
-- ============================================================

CREATE OR REPLACE FUNCTION public.staff_kitchen_filters_validate()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
DECLARE
  v_staff_tenant    uuid;
  v_category_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_staff_tenant
  FROM public.staff WHERE id = NEW.staff_id;

  IF v_staff_tenant IS NULL THEN
    RAISE EXCEPTION 'Staff % not found', NEW.staff_id;
  END IF;

  IF v_staff_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Tenant mismatch on staff_kitchen_filters: row tenant=%, staff tenant=%',
      NEW.tenant_id, v_staff_tenant;
  END IF;

  SELECT tenant_id INTO v_category_tenant
  FROM public.categories WHERE id = NEW.category_id;

  IF v_category_tenant IS NULL THEN
    RAISE EXCEPTION 'Category % not found', NEW.category_id;
  END IF;

  IF v_category_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Tenant mismatch on staff_kitchen_filters: row tenant=%, category tenant=%',
      NEW.tenant_id, v_category_tenant;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_kitchen_filters_validate_trg
  ON public.staff_kitchen_filters;

CREATE TRIGGER staff_kitchen_filters_validate_trg
  BEFORE INSERT OR UPDATE ON public.staff_kitchen_filters
  FOR EACH ROW EXECUTE FUNCTION public.staff_kitchen_filters_validate();

-- ============================================================
-- RLS
--
-- A staff member manages their own filter rows. Admins/owners
-- may manage any colleague's filters in their tenant — supports
-- a manager pre-configuring a station device.
-- ============================================================

ALTER TABLE public.staff_kitchen_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_kitchen_filters_select
  ON public.staff_kitchen_filters
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_staff()
    AND tenant_id = public.current_tenant_id()
    AND (
      staff_id = public.get_my_staff_id()
      OR public.get_my_staff_role() IN ('admin', 'owner')
    )
  );

CREATE POLICY staff_kitchen_filters_insert
  ON public.staff_kitchen_filters
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_staff()
    AND tenant_id = public.current_tenant_id()
    AND (
      staff_id = public.get_my_staff_id()
      OR public.get_my_staff_role() IN ('admin', 'owner')
    )
  );

CREATE POLICY staff_kitchen_filters_delete
  ON public.staff_kitchen_filters
  FOR DELETE
  TO authenticated
  USING (
    public.is_active_staff()
    AND tenant_id = public.current_tenant_id()
    AND (
      staff_id = public.get_my_staff_id()
      OR public.get_my_staff_role() IN ('admin', 'owner')
    )
  );

-- No UPDATE policy: rows are immutable. Replace = delete + insert.

COMMENT ON TABLE public.staff_kitchen_filters IS
  'Per-staff kitchen-screen category filter. Empty set means show-all (enforced in read path). UX preference, not an authz boundary.';
