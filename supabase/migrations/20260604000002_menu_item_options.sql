-- Menu item modifiers — Phase 1 (schema).
--
-- Two catalog tables:
--   * menu_item_options        — option GROUPS attached to a menu item
--                                 ("Size", "Spice level", "Add-ons")
--   * menu_item_option_values  — selectable VALUES within a group
--                                 ("Small", "Hot", "Extra cheese +₺5")
--
-- Both are tenant-scoped and admin/owner-managed, but publicly readable like
-- menu_items (customers browse modifiers while ordering). A snapshot of the
-- customer's chosen options is stored on order_items.selected_options (jsonb),
-- written at order time in Phase 3 — kept immutable so a later menu edit never
-- rewrites historical orders.

BEGIN;

CREATE TABLE IF NOT EXISTS public.menu_item_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  -- 'single' = pick exactly one (radio); 'multi' = pick within [min,max] (checkbox)
  selection_type text NOT NULL DEFAULT 'single'
    CHECK (selection_type IN ('single', 'multi')),
  is_required boolean NOT NULL DEFAULT false,
  min_select integer NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  max_select integer CHECK (max_select IS NULL OR max_select >= 1),
  display_order integer NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menu_item_options_select_range
    CHECK (max_select IS NULL OR max_select >= min_select)
);

CREATE INDEX IF NOT EXISTS menu_item_options_tenant_item_idx
  ON public.menu_item_options (tenant_id, menu_item_id, display_order);

CREATE TABLE IF NOT EXISTS public.menu_item_option_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.menu_item_options(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  -- Added to the item price. Non-negative on purpose: a corrupt/negative delta
  -- must not let an order undercut the menu price (mirrors the tax_percentage
  -- guard in 20260604000001).
  price_delta numeric(10, 2) NOT NULL DEFAULT 0 CHECK (price_delta >= 0),
  is_default boolean NOT NULL DEFAULT false,
  is_available boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS menu_item_option_values_tenant_option_idx
  ON public.menu_item_option_values (tenant_id, option_id, display_order);

-- Snapshot of the customer's chosen modifiers, written at order time (Phase 3).
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS selected_options jsonb;

-- ─── RLS ───────────────────────────────────────────────────────────
-- Public catalog read; admin/owner writes self-fence with BOTH the role check
-- and the tenant predicate (M18 pattern — see 20260503000001_qr_tokens.sql).

ALTER TABLE public.menu_item_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_option_values ENABLE ROW LEVEL SECURITY;

-- menu_item_options
CREATE POLICY "menu_item_options public read"
  ON public.menu_item_options FOR SELECT USING (true);

CREATE POLICY "menu_item_options admin insert"
  ON public.menu_item_options FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text])
    AND tenant_id = public.current_tenant_id()
  );

CREATE POLICY "menu_item_options admin update"
  ON public.menu_item_options FOR UPDATE TO authenticated
  USING (
    public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text])
    AND tenant_id = public.current_tenant_id()
  )
  WITH CHECK (
    public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text])
    AND tenant_id = public.current_tenant_id()
  );

CREATE POLICY "menu_item_options admin delete"
  ON public.menu_item_options FOR DELETE TO authenticated
  USING (
    public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text])
    AND tenant_id = public.current_tenant_id()
  );

-- menu_item_option_values
CREATE POLICY "menu_item_option_values public read"
  ON public.menu_item_option_values FOR SELECT USING (true);

CREATE POLICY "menu_item_option_values admin insert"
  ON public.menu_item_option_values FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text])
    AND tenant_id = public.current_tenant_id()
  );

CREATE POLICY "menu_item_option_values admin update"
  ON public.menu_item_option_values FOR UPDATE TO authenticated
  USING (
    public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text])
    AND tenant_id = public.current_tenant_id()
  )
  WITH CHECK (
    public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text])
    AND tenant_id = public.current_tenant_id()
  );

CREATE POLICY "menu_item_option_values admin delete"
  ON public.menu_item_option_values FOR DELETE TO authenticated
  USING (
    public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text])
    AND tenant_id = public.current_tenant_id()
  );

COMMIT;
