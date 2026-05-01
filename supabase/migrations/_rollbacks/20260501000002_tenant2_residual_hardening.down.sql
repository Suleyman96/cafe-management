-- ============================================================================
-- Rollback for 20260501000002_tenant2_residual_hardening.sql
-- ============================================================================
-- Restores the pre-migration state:
--   M4: drop tenant_self_view, restore SELECT on tenants for authenticated/anon,
--       drop get_my_tenant_plan RPC.
--   M8: revert helpers to their baseline SQL bodies (staff-table lookup first,
--       no JWT claim short-circuit).
--   M11: recreate active_orders_view without the LIMIT and without the
--        explicit tenant predicate (matches the post-baseline definition at
--        supabase/migrations/00000000000000_baseline.sql:2114).
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- M11 — restore active_orders_view (no LIMIT, no explicit tenant predicate)
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.active_orders_view
WITH (security_invoker = on) AS
SELECT
    o.id,
    o.order_number,
    o.status,
    o.created_at,
    o.updated_at,
    t.table_number,
    t.location,
    s.full_name AS waiter_name,
    count(oi.id) AS item_count,
    sum(oi.quantity) AS total_quantity,
    o.total,
    (EXTRACT(epoch FROM (now() - o.created_at)) / 60::numeric) AS minutes_elapsed,
    json_agg(
      json_build_object(
        'item_name', oi.item_name,
        'quantity', oi.quantity,
        'notes', oi.notes,
        'status', oi.status
      ) ORDER BY oi.created_at
    ) AS items
FROM public.orders o
JOIN public.tables t ON o.table_id = t.id
LEFT JOIN public.staff s ON o.assigned_waiter_id = s.id
LEFT JOIN public.order_items oi ON o.id = oi.order_id
WHERE o.status IN ('new', 'preparing', 'ready')
GROUP BY o.id, t.id, s.id
ORDER BY o.created_at;

GRANT SELECT ON public.active_orders_view TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- M8 — restore baseline helpers (no JWT short-circuit)
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_tenant_id', true), '')::uuid,
    (SELECT tenant_id FROM public.staff WHERE auth_user_id = auth.uid() LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_staff_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.staff
  WHERE auth_user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE auth_user_id = auth.uid() AND is_active = true
  );
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- M4 — restore direct SELECT on tenants, drop the view + plan RPC
-- ────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_my_tenant_plan();

GRANT SELECT ON public.tenants TO authenticated;
GRANT SELECT ON public.tenants TO anon;

DROP VIEW IF EXISTS public.tenant_self_view;
