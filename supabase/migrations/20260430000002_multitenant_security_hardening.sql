-- Multi-tenant security hardening — closes the deferred findings from
-- plans/09-DB-SECURITY-DEFERRED.md (audit 2026-04-28).
--
-- This migration is the hard gate before tenant #2 onboards. It covers:
--
--   C1  Report aggregation RPCs accept any p_tenant_id
--   C2  "Anyone can view ..." policies bypass tenant_isolation
--   C3  set_table_context lets staff pivot to another tenant (current_tenant_id)
--   C4  cafe_settings_single_row_check blocks tenant #2 signup
--   C5  calculate_order_total reads cafe_settings with no tenant filter
--   H5  set_table_context granted to authenticated
--   H7  update_order_payment_status updates with no tenant guard
--   M1  Global uniqueness on tables.table_number / orders.order_number
--   M2  generate_order_number() falls open when no tenant context is set
--   M3  check_order_limit / check_table_limit open-default to unlimited
--   M10 cleanup_empty_orders has no role guard
--   L1  Index column order on staff email (tenant first for prefix scans)
--   L2  idx_staff_auth_user should be UNIQUE
--   L5  Staff email backfill missing LOWER()
--
-- Deferred to follow-up PRs: H4 (storage tenant scoping), M4 (tenant.plan view),
-- M8 (JWT claim reads in RLS), M9 (Realtime audit — closes by C2/C3),
-- M11 (active_orders_view LIMIT), L4 (CHECK → ENUM).

BEGIN;

-- ============================================================
-- C3 (+ H5). current_tenant_id(): authenticated users always derive
-- tenant from their staff row. The GUC fallback is anon-only,
-- which is what the QR-code customer flow needs.
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL THEN
      (SELECT tenant_id FROM public.staff
        WHERE auth_user_id = auth.uid() AND is_active = true
        LIMIT 1)
    ELSE
      NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  END;
$$;

-- The QR flow is the only legitimate caller. Authenticated staff must
-- not be able to swap their session into another tenant.
REVOKE EXECUTE ON FUNCTION public.set_table_context(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_table_context(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_table_context(text) TO anon;

-- ============================================================
-- C2. Drop permissive "Anyone can view ..." policies.
--     Scoped anon_read_* / tenant_isolation policies already cover
--     legitimate access.
-- ============================================================

DROP POLICY IF EXISTS "Anyone can view active tables"  ON public.tables;
DROP POLICY IF EXISTS "Anyone can view tables"         ON public.tables;
DROP POLICY IF EXISTS "Anyone can view cafe settings"  ON public.cafe_settings;
DROP POLICY IF EXISTS "Anyone can read cafe settings"  ON public.cafe_settings;
DROP POLICY IF EXISTS "Anyone can view feedback"       ON public.customer_feedback;

-- ============================================================
-- C4. Drop the single-row constraint that blocks tenant #2 signup.
--     The unique index on (tenant_id) keeps the "one settings row
--     per tenant" invariant.
-- ============================================================

ALTER TABLE public.cafe_settings
  DROP CONSTRAINT IF EXISTS cafe_settings_single_row_check;

-- ============================================================
-- C5. calculate_order_total: scope cafe_settings lookup by the
--     order's tenant. Replaces the "LIMIT 1" version from
--     20260419000002 (financial audit). Behavior otherwise unchanged.
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_order_total(order_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  calculated_subtotal NUMERIC(14, 4);
  calculated_tax NUMERIC(14, 4);
  calculated_total NUMERIC(14, 4);
  order_discount_type VARCHAR(10);
  order_discount_value NUMERIC(14, 4);
  calculated_discount NUMERIC(14, 4);
  order_delivery_fee NUMERIC(14, 4);
  settings_tax_enabled BOOLEAN;
  settings_tax_percentage NUMERIC(7, 4);
  taxable_amount NUMERIC(14, 4);
  v_order_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_order_tenant_id
  FROM public.orders WHERE id = order_uuid;

  IF v_order_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Order % has no tenant_id', order_uuid;
  END IF;

  SELECT tax_enabled, tax_percentage
  INTO settings_tax_enabled, settings_tax_percentage
  FROM public.cafe_settings
  WHERE tenant_id = v_order_tenant_id
  LIMIT 1;

  -- Default to no tax when settings haven't been configured.
  settings_tax_enabled := COALESCE(settings_tax_enabled, false);
  settings_tax_percentage := COALESCE(settings_tax_percentage, 0);

  SELECT COALESCE(SUM(item_price * quantity), 0)
  INTO calculated_subtotal
  FROM public.order_items
  WHERE order_id = order_uuid
    AND status != 'cancelled';

  SELECT
    COALESCE(discount_type, 'none'),
    COALESCE(discount_value, 0),
    COALESCE(delivery_fee, 0)
  INTO order_discount_type, order_discount_value, order_delivery_fee
  FROM public.orders
  WHERE id = order_uuid;

  IF order_discount_type = 'percentage' THEN
    calculated_discount := LEAST(calculated_subtotal, calculated_subtotal * order_discount_value / 100);
  ELSIF order_discount_type = 'fixed' THEN
    calculated_discount := LEAST(calculated_subtotal, order_discount_value);
  ELSE
    calculated_discount := 0;
  END IF;

  taxable_amount := calculated_subtotal - calculated_discount;

  IF settings_tax_enabled = true AND settings_tax_percentage > 0 THEN
    calculated_tax := taxable_amount * (settings_tax_percentage / 100);
    calculated_total := taxable_amount + calculated_tax + order_delivery_fee;
  ELSE
    calculated_tax := 0;
    calculated_total := taxable_amount + order_delivery_fee;
  END IF;

  UPDATE public.orders
  SET
    subtotal = calculated_subtotal,
    tax = calculated_tax,
    discount_amount = calculated_discount,
    total = calculated_total,
    updated_at = NOW()
  WHERE id = order_uuid;

  -- Finalize the audit entry with the new values.
  PERFORM public.finalize_audit_entry(order_uuid);
END;
$$;

-- ============================================================
-- C1. Report aggregation RPCs: drop p_tenant_id, derive tenant from
--     current_tenant_id(). Keeps SECURITY DEFINER (needed to read
--     across tables that have RLS) but the tenant boundary is now
--     baked in instead of trusting the caller's parameter.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_revenue_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_top_sold_items(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT);
DROP FUNCTION IF EXISTS public.get_expense_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_waste_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_staff_performance(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE FUNCTION public.get_revenue_summary(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS TABLE (
  report_date DATE,
  total_revenue NUMERIC,
  order_count INT,
  avg_ticket NUMERIC,
  completed_count INT,
  cancelled_count INT,
  dine_in_count INT,
  takeout_count INT,
  delivery_count INT,
  total_items INT,
  total_discounts NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := public.current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant context';
  END IF;

  RETURN QUERY
  WITH order_item_agg AS (
    SELECT
      oi.order_id,
      SUM(oi.quantity * oi.item_price) AS item_revenue,
      SUM(oi.quantity)::int AS item_count
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.tenant_id = v_tenant_id
      AND o.created_at >= p_from
      AND o.created_at < p_to
      AND o.status != 'cancelled'
    GROUP BY oi.order_id
  )
  SELECT
    (o.created_at AT TIME ZONE 'UTC')::date AS report_date,
    COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN oia.item_revenue ELSE 0 END), 0) AS total_revenue,
    COUNT(o.id)::int AS order_count,
    CASE
      WHEN COUNT(o.id) FILTER (WHERE o.status != 'cancelled') > 0
      THEN COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN oia.item_revenue ELSE 0 END), 0)
           / COUNT(o.id) FILTER (WHERE o.status != 'cancelled')
      ELSE 0
    END AS avg_ticket,
    COUNT(o.id) FILTER (WHERE o.status = 'closed')::int AS completed_count,
    COUNT(o.id) FILTER (WHERE o.status = 'cancelled')::int AS cancelled_count,
    COUNT(o.id) FILTER (WHERE o.order_type = 'dine_in')::int AS dine_in_count,
    COUNT(o.id) FILTER (WHERE o.order_type = 'takeout')::int AS takeout_count,
    COUNT(o.id) FILTER (WHERE o.order_type = 'delivery')::int AS delivery_count,
    COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN oia.item_count ELSE 0 END), 0)::int AS total_items,
    COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.discount_amount ELSE 0 END), 0) AS total_discounts
  FROM public.orders o
  LEFT JOIN order_item_agg oia ON oia.order_id = o.id
  WHERE o.tenant_id = v_tenant_id
    AND o.created_at >= p_from
    AND o.created_at < p_to
  GROUP BY (o.created_at AT TIME ZONE 'UTC')::date
  ORDER BY report_date;
END;
$$;

CREATE FUNCTION public.get_top_sold_items(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  menu_item_id UUID,
  item_name TEXT,
  total_quantity INT,
  total_revenue NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := public.current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant context';
  END IF;

  RETURN QUERY
  SELECT
    oi.menu_item_id,
    mi.name::text AS item_name,
    SUM(oi.quantity)::int AS total_quantity,
    SUM(oi.quantity * oi.item_price) AS total_revenue
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  JOIN public.menu_items mi ON mi.id = oi.menu_item_id
  WHERE o.tenant_id = v_tenant_id
    AND o.created_at >= p_from
    AND o.created_at < p_to
    AND o.status != 'cancelled'
  GROUP BY oi.menu_item_id, mi.name
  ORDER BY total_quantity DESC
  LIMIT p_limit;
END;
$$;

CREATE FUNCTION public.get_expense_summary(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS TABLE (
  category_name TEXT,
  total_amount NUMERIC,
  entry_count INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := public.current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant context';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(ec.name, 'Uncategorized')::text AS category_name,
    SUM(e.amount) AS total_amount,
    COUNT(e.id)::int AS entry_count
  FROM public.expenses e
  LEFT JOIN public.expense_categories ec ON ec.id = e.category_id
  WHERE e.tenant_id = v_tenant_id
    AND e.expense_date >= p_from::date
    AND e.expense_date < p_to::date
  GROUP BY ec.name
  ORDER BY SUM(e.amount) DESC;
END;
$$;

CREATE FUNCTION public.get_waste_summary(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS TABLE (
  waste_reason TEXT,
  item_name TEXT,
  total_quantity NUMERIC,
  total_cost NUMERIC,
  entry_count INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := public.current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant context';
  END IF;

  RETURN QUERY
  SELECT
    wl.reason::text AS waste_reason,
    wl.item_name::text AS item_name,
    SUM(wl.quantity) AS total_quantity,
    SUM(wl.total_cost) AS total_cost,
    COUNT(wl.id)::int AS entry_count
  FROM public.waste_logs wl
  WHERE wl.tenant_id = v_tenant_id
    AND wl.waste_date >= p_from::date
    AND wl.waste_date < p_to::date
  GROUP BY wl.reason, wl.item_name
  ORDER BY SUM(wl.total_cost) DESC;
END;
$$;

CREATE FUNCTION public.get_staff_performance(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS TABLE (
  staff_id UUID,
  staff_name TEXT,
  staff_role TEXT,
  orders_handled INT,
  revenue NUMERIC,
  items_sold INT,
  completed_orders INT,
  cancelled_orders INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := public.current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant context';
  END IF;

  RETURN QUERY
  WITH order_item_agg AS (
    SELECT
      oi.order_id,
      SUM(oi.quantity * oi.item_price) AS item_revenue,
      SUM(oi.quantity)::int AS item_count
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.tenant_id = v_tenant_id
      AND o.created_at >= p_from
      AND o.created_at < p_to
      AND o.assigned_waiter_id IS NOT NULL
      AND o.status != 'cancelled'
    GROUP BY oi.order_id
  )
  SELECT
    s.id AS staff_id,
    s.full_name::text AS staff_name,
    COALESCE(s.role, 'staff')::text AS staff_role,
    COUNT(o.id)::int AS orders_handled,
    COALESCE(SUM(oia.item_revenue), 0) AS revenue,
    COALESCE(SUM(oia.item_count), 0)::int AS items_sold,
    COUNT(o.id) FILTER (WHERE o.status = 'closed')::int AS completed_orders,
    COUNT(o.id) FILTER (WHERE o.status = 'cancelled')::int AS cancelled_orders
  FROM public.orders o
  JOIN public.staff s ON s.id = o.assigned_waiter_id
  LEFT JOIN order_item_agg oia ON oia.order_id = o.id
  WHERE o.tenant_id = v_tenant_id
    AND o.created_at >= p_from
    AND o.created_at < p_to
    AND o.assigned_waiter_id IS NOT NULL
  GROUP BY s.id, s.full_name, s.role
  HAVING COUNT(o.id) > 0
  ORDER BY COALESCE(SUM(oia.item_revenue), 0) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_revenue_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_sold_items(TIMESTAMPTZ, TIMESTAMPTZ, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_expense_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_waste_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_performance(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================
-- H7. update_order_payment_status: assert payment.tenant_id matches
--     orders.tenant_id before flipping status / freeing the table.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_order_payment_status() RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
DECLARE
  remaining DECIMAL(10, 2);
  total_paid DECIMAL(10, 2);
  order_table_id UUID;
  v_order_tenant_id UUID;
BEGIN
  SELECT tenant_id, table_id
    INTO v_order_tenant_id, order_table_id
  FROM public.orders WHERE id = NEW.order_id;

  IF v_order_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Order % not found', NEW.order_id;
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM v_order_tenant_id THEN
    RAISE EXCEPTION 'Tenant mismatch on payment for order %', NEW.order_id;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.order_payments
  WHERE order_id = NEW.order_id;

  remaining := public.get_order_remaining_balance(NEW.order_id);

  IF remaining <= 0 THEN
    UPDATE public.orders
    SET
      status = 'closed',
      paid_at = NOW(),
      closed_at = NOW(),
      payment_method = 'split',
      updated_at = NOW()
    WHERE id = NEW.order_id;

    IF order_table_id IS NOT NULL THEN
      UPDATE public.tables
      SET
        status = 'free',
        current_session_id = NULL,
        updated_at = NOW()
      WHERE id = order_table_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- M1. Per-tenant uniqueness on tables.table_number and
--     orders.order_number. The global UNIQUEs would collide on
--     day 2 of multi-tenant operation.
-- ============================================================

ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS tables_table_number_key;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS tables_tenant_number_uniq
  ON public.tables (tenant_id, table_number);

CREATE UNIQUE INDEX IF NOT EXISTS orders_tenant_number_uniq
  ON public.orders (tenant_id, order_number);

-- ============================================================
-- M2. generate_order_number: raise if no tenant context. Also
--     adds the SET search_path that the original was missing.
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_order_number() RETURNS character varying
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
DECLARE
  new_number VARCHAR(15);
  counter INTEGER;
  v_tenant_id UUID;
BEGIN
  v_tenant_id := public.current_tenant_id();

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant context — cannot generate order number';
  END IF;

  SELECT COUNT(*) INTO counter
  FROM public.orders
  WHERE tenant_id = v_tenant_id
    AND DATE(created_at) = CURRENT_DATE;

  new_number := 'ORD' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || LPAD((counter + 1)::TEXT, 3, '0');
  RETURN new_number;
END;
$$;

-- ============================================================
-- M3. check_order_limit / check_table_limit: default to free-plan
--     caps when the tenant's plan is unknown, instead of letting
--     them through with -1 (unlimited).
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
    WHEN 'business' THEN 999999
    ELSE 100
  END;

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
    WHEN 'business' THEN 999
    ELSE 5
  END;

  SELECT COUNT(*) INTO v_count FROM public.tables WHERE tenant_id = NEW.tenant_id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Table limit reached for % plan (max %)',
      COALESCE(v_plan, 'free'), v_max;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- M10. cleanup_empty_orders: admin/owner only.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_empty_orders(
  p_older_than_minutes INT DEFAULT 2
)
RETURNS TABLE(cancelled_order_id UUID, freed_table_id UUID)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r RECORD;
  v_other_active INT;
  v_tenant_id UUID;
  v_role TEXT;
BEGIN
  SELECT s.tenant_id, s.role INTO v_tenant_id, v_role
  FROM public.staff s
  WHERE s.auth_user_id = auth.uid() AND s.is_active = true;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF v_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Only admin or owner can clean up empty orders';
  END IF;

  FOR r IN
    SELECT o.id AS order_id, o.table_id
    FROM public.orders o
    LEFT JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.tenant_id = v_tenant_id
      AND o.status IN ('new', 'pending_approval')
      AND o.created_at < NOW() - (p_older_than_minutes || ' minutes')::INTERVAL
    GROUP BY o.id, o.table_id
    HAVING COUNT(oi.id) = 0
  LOOP
    UPDATE public.orders
    SET status = 'cancelled',
        internal_notes = 'Auto-cancelled: empty order',
        updated_at = NOW()
    WHERE id = r.order_id;

    cancelled_order_id := r.order_id;
    freed_table_id := NULL;

    IF r.table_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_other_active
      FROM public.orders
      WHERE table_id = r.table_id
        AND id != r.order_id
        AND status IN ('pending_approval', 'new', 'preparing', 'ready', 'served');

      IF v_other_active = 0 THEN
        UPDATE public.tables
        SET status = 'free', occupied_at = NULL
        WHERE id = r.table_id;

        freed_table_id := r.table_id;
      END IF;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$;

-- ============================================================
-- L5. Backfill staff.email to LOWER() before swapping the index.
--     The unique index from 20260423000005 keys on LOWER(email) but
--     never normalized existing rows. Do this before L1 so the
--     index rebuild can't fail on case-collisions.
-- ============================================================

UPDATE public.staff
SET email = LOWER(email)
WHERE email IS NOT NULL AND email <> LOWER(email);

-- ============================================================
-- L1. Re-create staff email index with tenant_id leading so
--     "find staff in this tenant by email" prefix-scans cleanly.
-- ============================================================

DROP INDEX IF EXISTS public.idx_staff_email_tenant;
CREATE UNIQUE INDEX idx_staff_email_tenant
  ON public.staff (tenant_id, LOWER(email));

-- ============================================================
-- L2. Make idx_staff_auth_user UNIQUE — the codebase assumes one
--     staff row per auth user; encode that invariant.
-- ============================================================

DROP INDEX IF EXISTS public.idx_staff_auth_user;
CREATE UNIQUE INDEX idx_staff_auth_user
  ON public.staff (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMIT;
