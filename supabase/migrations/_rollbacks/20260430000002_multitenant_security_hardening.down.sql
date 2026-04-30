-- Rollback for 20260430000002_multitenant_security_hardening.sql.
--
-- Restores the pre-migration state for items that are individually
-- reversible. Items that drop functions/policies which were part of
-- baseline are recreated here in their pre-migration form.
--
-- Note: rolling this back re-opens the cross-tenant findings the
-- migration closes. Only use if a deploy must be reverted before
-- tenant #2 is onboarded.

BEGIN;

-- L2. Drop UNIQUE auth_user_id index, restore non-unique.
DROP INDEX IF EXISTS public.idx_staff_auth_user;
CREATE INDEX idx_staff_auth_user ON public.staff (auth_user_id);

-- L1. Restore (LOWER(email), tenant_id) ordering.
DROP INDEX IF EXISTS public.idx_staff_email_tenant;
CREATE UNIQUE INDEX idx_staff_email_tenant
  ON public.staff (LOWER(email), tenant_id);

-- L5. No backfill rollback — lowercase normalization is one-way.

-- M10. cleanup_empty_orders without role guard.
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
BEGIN
  SELECT s.tenant_id INTO v_tenant_id
  FROM public.staff s
  WHERE s.auth_user_id = auth.uid();

  IF v_tenant_id IS NULL THEN
    RETURN;
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

-- M3. Restore -1-default plan caps.
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

  v_max := CASE v_plan
    WHEN 'free' THEN 100
    WHEN 'standard' THEN 700
    WHEN 'pro' THEN 2200
    ELSE -1
  END;

  IF v_max = -1 THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_count FROM public.orders
  WHERE tenant_id = NEW.tenant_id
    AND created_at >= date_trunc('month', NOW());

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Monthly order limit reached for % plan (max %)', v_plan, v_max;
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

  v_max := CASE v_plan
    WHEN 'free' THEN 5
    WHEN 'standard' THEN 10
    WHEN 'pro' THEN 20
    ELSE -1
  END;

  IF v_max = -1 THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_count FROM public.tables WHERE tenant_id = NEW.tenant_id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Table limit reached for % plan (max %)', v_plan, v_max;
  END IF;

  RETURN NEW;
END;
$$;

-- M2. Restore generate_order_number that falls open on NULL tenant.
CREATE OR REPLACE FUNCTION public.generate_order_number() RETURNS character varying
  LANGUAGE plpgsql
AS $$
DECLARE
  new_number VARCHAR(15);
  counter INTEGER;
  v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE(
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID,
    public.current_tenant_id()
  );

  SELECT COUNT(*) INTO counter
  FROM public.orders
  WHERE DATE(created_at) = CURRENT_DATE
    AND (v_tenant_id IS NULL OR tenant_id = v_tenant_id);

  new_number := 'ORD' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || LPAD((counter + 1)::TEXT, 3, '0');
  RETURN new_number;
END;
$$;

-- M1. Restore global UNIQUE constraints (best-effort; will fail if
-- multi-tenant data already collides — operator must clean up first).
DROP INDEX IF EXISTS public.tables_tenant_number_uniq;
DROP INDEX IF EXISTS public.orders_tenant_number_uniq;
ALTER TABLE public.tables ADD CONSTRAINT tables_table_number_key UNIQUE (table_number);
ALTER TABLE public.orders ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);

-- H7. Restore update_order_payment_status without tenant guard.
CREATE OR REPLACE FUNCTION public.update_order_payment_status() RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
DECLARE
  remaining DECIMAL(10, 2);
  total_paid DECIMAL(10, 2);
  order_table_id UUID;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.order_payments
  WHERE order_id = NEW.order_id;

  remaining := public.get_order_remaining_balance(NEW.order_id);

  IF remaining <= 0 THEN
    SELECT table_id INTO order_table_id
    FROM public.orders
    WHERE id = NEW.order_id;

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

-- C1. Restore p_tenant_id RPCs.
DROP FUNCTION IF EXISTS public.get_revenue_summary(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_top_sold_items(TIMESTAMPTZ, TIMESTAMPTZ, INT);
DROP FUNCTION IF EXISTS public.get_expense_summary(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_waste_summary(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_staff_performance(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE FUNCTION public.get_revenue_summary(
  p_tenant_id UUID,
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
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH order_item_agg AS (
    SELECT
      oi.order_id,
      SUM(oi.quantity * oi.item_price) AS item_revenue,
      SUM(oi.quantity)::int AS item_count
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.tenant_id = p_tenant_id
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
  FROM orders o
  LEFT JOIN order_item_agg oia ON oia.order_id = o.id
  WHERE o.tenant_id = p_tenant_id
    AND o.created_at >= p_from
    AND o.created_at < p_to
  GROUP BY (o.created_at AT TIME ZONE 'UTC')::date
  ORDER BY report_date;
$$;

CREATE FUNCTION public.get_top_sold_items(
  p_tenant_id UUID,
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
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    oi.menu_item_id,
    mi.name::text AS item_name,
    SUM(oi.quantity)::int AS total_quantity,
    SUM(oi.quantity * oi.item_price) AS total_revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE o.tenant_id = p_tenant_id
    AND o.created_at >= p_from
    AND o.created_at < p_to
    AND o.status != 'cancelled'
  GROUP BY oi.menu_item_id, mi.name
  ORDER BY total_quantity DESC
  LIMIT p_limit;
$$;

CREATE FUNCTION public.get_expense_summary(
  p_tenant_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS TABLE (
  category_name TEXT,
  total_amount NUMERIC,
  entry_count INT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(ec.name, 'Uncategorized')::text AS category_name,
    SUM(e.amount) AS total_amount,
    COUNT(e.id)::int AS entry_count
  FROM expenses e
  LEFT JOIN expense_categories ec ON ec.id = e.category_id
  WHERE e.tenant_id = p_tenant_id
    AND e.expense_date >= p_from::date
    AND e.expense_date < p_to::date
  GROUP BY ec.name
  ORDER BY total_amount DESC;
$$;

CREATE FUNCTION public.get_waste_summary(
  p_tenant_id UUID,
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
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wl.reason::text AS waste_reason,
    wl.item_name::text AS item_name,
    SUM(wl.quantity) AS total_quantity,
    SUM(wl.total_cost) AS total_cost,
    COUNT(wl.id)::int AS entry_count
  FROM waste_logs wl
  WHERE wl.tenant_id = p_tenant_id
    AND wl.waste_date >= p_from::date
    AND wl.waste_date < p_to::date
  GROUP BY wl.reason, wl.item_name
  ORDER BY total_cost DESC;
$$;

CREATE FUNCTION public.get_staff_performance(
  p_tenant_id UUID,
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
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH order_item_agg AS (
    SELECT
      oi.order_id,
      SUM(oi.quantity * oi.item_price) AS item_revenue,
      SUM(oi.quantity)::int AS item_count
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.tenant_id = p_tenant_id
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
  FROM orders o
  JOIN staff s ON s.id = o.assigned_waiter_id
  LEFT JOIN order_item_agg oia ON oia.order_id = o.id
  WHERE o.tenant_id = p_tenant_id
    AND o.created_at >= p_from
    AND o.created_at < p_to
    AND o.assigned_waiter_id IS NOT NULL
  GROUP BY s.id, s.full_name, s.role
  HAVING COUNT(o.id) > 0
  ORDER BY revenue DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_revenue_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_sold_items(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_expense_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_waste_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_performance(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- C5. Restore calculate_order_total without tenant join (uses LIMIT 1).
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
BEGIN
  SELECT tax_enabled, tax_percentage
  INTO settings_tax_enabled, settings_tax_percentage
  FROM public.cafe_settings
  LIMIT 1;

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

  PERFORM public.finalize_audit_entry(order_uuid);
END;
$$;

-- C4. Restore single-row constraint (only safe to do this if cafe_settings has ≤1 row).
ALTER TABLE public.cafe_settings
  ADD CONSTRAINT cafe_settings_single_row_check
  CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid);

-- C2. Restore permissive policies.
CREATE POLICY "Anyone can view active tables" ON public.tables
  FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can view tables" ON public.tables
  FOR SELECT USING (true);
CREATE POLICY "Anyone can view cafe settings" ON public.cafe_settings
  FOR SELECT USING (true);
CREATE POLICY "Anyone can read cafe settings" ON public.cafe_settings
  FOR SELECT USING (true);
CREATE POLICY "Anyone can view feedback" ON public.customer_feedback
  FOR SELECT USING (true);

-- C3. Restore current_tenant_id with GUC-first lookup.
CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID,
    (SELECT tenant_id FROM public.staff WHERE auth_user_id = auth.uid() LIMIT 1)
  );
$$;

-- H5. Restore set_table_context grant to authenticated.
GRANT EXECUTE ON FUNCTION public.set_table_context(text) TO authenticated;

COMMIT;
