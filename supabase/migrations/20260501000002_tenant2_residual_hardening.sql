-- ============================================================================
-- Tenant-#2 residual hardening (M4 / M8 / M11)
-- ============================================================================
-- Closes the remaining medium-priority items from
-- plans/09-DB-SECURITY-DEFERRED.md before the first multi-tenant onboarding.
--
-- M4 (tenant_self_view): the `tenants` table currently leaks `plan` and
--   `is_active` to every staff member via the `tenant_read_own` RLS policy.
--   Replace direct table access with a minimal view exposing only the
--   columns the client needs (id, name, slug); plan stays reachable via a
--   JWT-aware RPC.
--
-- M8 (JWT-first RLS helpers): the helper functions `current_tenant_id`,
--   `get_my_staff_role`, and `is_active_staff` query `public.staff` on every
--   RLS evaluation. Migration 20260423000006 added a `custom_access_token_hook`
--   that injects `tenant_id`, `user_role`, and `is_active_staff` into the JWT.
--   Read those claims first; fall back to the staff table only for sessions
--   issued before the hook was enabled (and to the `app.current_tenant_id`
--   GUC for anon QR sessions).
--
-- M11 (active_orders_view LIMIT 200): the view currently has no row cap and
--   doesn't include `tenant_id` in its predicates. Add an explicit
--   tenant filter and a LIMIT to keep one bad query from streaming the
--   entire active-order set across tenants.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- M4 — tenant_self_view (tenants column-narrowing)
-- ────────────────────────────────────────────────────────────────────────────

-- Minimal projection: name + slug for branding/UI display. plan and is_active
-- are intentionally excluded — staff-side reads of those go through the
-- `get_my_tenant_plan` RPC below (or service-role routes for admin tooling).
CREATE OR REPLACE VIEW public.tenant_self_view
WITH (security_invoker = on) AS
SELECT id, name, slug
FROM public.tenants
WHERE id = public.current_tenant_id();

GRANT SELECT ON public.tenant_self_view TO authenticated;
GRANT SELECT ON public.tenant_self_view TO anon;

-- Authenticated callers can no longer read directly from `tenants`. The
-- `tenant_isolation`/`tenant_read_own` RLS policies stay in place — they
-- still apply to service-role queries and to the few SECURITY DEFINER
-- functions below — but the table grant is what authorizes any non-admin
-- SELECT, and dropping it is what closes the column leak.
REVOKE SELECT ON public.tenants FROM authenticated;
REVOKE SELECT ON public.tenants FROM anon;

-- Plan is still needed by staff-web (post-login plan-gate UI) and
-- customer-web (QR-ordering plan check). Expose it via SECURITY DEFINER
-- RPCs that resolve the tenant from the JWT (staff) or from the QR
-- session GUC (anon) — same pattern as the existing helpers.
CREATE OR REPLACE FUNCTION public.get_my_tenant_plan()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT t.plan FROM public.tenants t
  WHERE t.id = public.current_tenant_id();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_tenant_plan() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_plan() TO anon;

-- ────────────────────────────────────────────────────────────────────────────
-- M8 — JWT-first RLS helpers
-- ────────────────────────────────────────────────────────────────────────────
-- Claim names mirror what `custom_access_token_hook` (migration
-- 20260423000006) writes into the JWT: tenant_id, user_role, is_active_staff.

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claim text;
  v_uid   uuid;
BEGIN
  -- 1. Authenticated session — read the claim emitted by the JWT hook.
  v_claim := auth.jwt() ->> 'tenant_id';
  IF v_claim IS NOT NULL AND v_claim <> '' THEN
    RETURN v_claim::uuid;
  END IF;

  -- 2. Authenticated session predating the hook — fall back to the staff
  --    table lookup. Once all sessions cycle through the hook this branch
  --    is unreachable.
  v_uid := auth.uid();
  IF v_uid IS NOT NULL THEN
    RETURN (
      SELECT tenant_id FROM public.staff
      WHERE auth_user_id = v_uid AND is_active = true
      LIMIT 1
    );
  END IF;

  -- 3. Anon QR session — `set_table_context()` writes the GUC.
  RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_staff_role()
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claim text;
BEGIN
  v_claim := auth.jwt() ->> 'user_role';
  IF v_claim IS NOT NULL AND v_claim <> '' THEN
    RETURN v_claim;
  END IF;

  RETURN (
    SELECT role FROM public.staff
    WHERE auth_user_id = auth.uid() AND is_active = true
    LIMIT 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claim jsonb;
BEGIN
  v_claim := auth.jwt() -> 'is_active_staff';
  IF v_claim IS NOT NULL AND jsonb_typeof(v_claim) = 'boolean' THEN
    RETURN (v_claim)::text::boolean;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.staff
    WHERE auth_user_id = auth.uid() AND is_active = true
  );
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- M11 — active_orders_view LIMIT 200 + explicit tenant predicate
-- ────────────────────────────────────────────────────────────────────────────
-- Columns/joins copied verbatim from the baseline view (line 2114). Two
-- changes: an explicit `o.tenant_id = current_tenant_id()` predicate (RLS
-- redundant but defense-in-depth) and a `LIMIT 200` cap so a runaway query
-- can't stream the whole active-order set.

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
  AND o.tenant_id = public.current_tenant_id()
GROUP BY o.id, t.id, s.id
ORDER BY o.created_at
LIMIT 200;

GRANT SELECT ON public.active_orders_view TO authenticated;
