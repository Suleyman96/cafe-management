-- M8 — soft-delete for the catalog tables (menu_items, categories).
--
-- Deleting a menu item or category was a hard DELETE, which destroyed the row
-- even though historical order_items still logically reference it (they snapshot
-- name/price/category, so orders survive — but the catalog row, and any audit
-- trail of what was on the menu, was gone). Soft-delete retains the row while
-- removing it from every reader.
--
-- Enforcement is a single RESTRICTIVE `FOR SELECT` policy per table. Restrictive
-- policies are AND-ed with the OR of the existing permissive read policies
-- (`anon_read_*` public browse + `tenant_isolation`), so the net visibility
-- becomes `(existing read rule) AND deleted_at IS NULL` for EVERY reader — anon
-- QR browsing, authenticated staff, and embedded joins (order_items ->
-- menu_items) alike. No existing policy is modified, and INSERT/UPDATE/DELETE
-- are untouched, so the soft-delete UPDATE itself and all writes keep working.
--
-- There are no unique constraints on these tables beyond the PK, so no partial
-- unique index is needed to allow re-creating a same-named row after deletion.

BEGIN;

ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DROP POLICY IF EXISTS exclude_soft_deleted ON public.menu_items;
CREATE POLICY exclude_soft_deleted ON public.menu_items
  AS RESTRICTIVE
  FOR SELECT
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS exclude_soft_deleted ON public.categories;
CREATE POLICY exclude_soft_deleted ON public.categories
  AS RESTRICTIVE
  FOR SELECT
  USING (deleted_at IS NULL);

-- Every read now carries `deleted_at IS NULL`; keep the hot per-tenant lookups
-- covered by a partial index over the live rows.
CREATE INDEX IF NOT EXISTS idx_menu_items_live
  ON public.menu_items (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_categories_live
  ON public.categories (tenant_id) WHERE deleted_at IS NULL;

-- Soft-delete writes go through SECURITY DEFINER RPCs (the codebase pattern for
-- privileged writes, e.g. cancel_order_item_qty). A plain client UPDATE can't
-- set deleted_at: the restrictive SELECT policy above is also enforced against
-- the UPDATE's NEW row, so the tombstoned row "violates" the policy. The definer
-- function runs as owner (RLS bypassed) but re-checks the caller's role and
-- scopes the write to their own tenant, so authorization is unchanged.

CREATE OR REPLACE FUNCTION public.soft_delete_menu_item(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text])) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;
  UPDATE public.menu_items
     SET deleted_at = now()
   WHERE id = p_id
     AND tenant_id = public.current_tenant_id()
     AND deleted_at IS NULL;
END;
$$;
ALTER FUNCTION public.soft_delete_menu_item(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.soft_delete_menu_item(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.soft_delete_category(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text])) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;
  UPDATE public.categories
     SET deleted_at = now()
   WHERE id = p_id
     AND tenant_id = public.current_tenant_id()
     AND deleted_at IS NULL;
END;
$$;
ALTER FUNCTION public.soft_delete_category(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.soft_delete_category(uuid) TO authenticated;

COMMIT;
