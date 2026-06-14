-- Reports correctness pass: make "revenue" mean money actually collected, and
-- stop cancelled rows inflating every aggregate.
--
-- Problems in the prior definitions (20260430000002, which moved these RPCs to
-- the 2-arg / current_tenant_id() form):
--   * total_revenue = SUM(order_items.quantity * item_price) over every
--     non-cancelled order — gross item subtotal of orders that may be unpaid or
--     even pending_approval, pre-discount and pre-tax. It matched neither
--     order.total nor the Z-Report's collected payments, so the headline never
--     reconciled.
--   * order_item aggregations never filtered oi.status, so cancelled LINE items
--     (a partially-voided order) still counted in revenue, item totals,
--     top-sold and staff numbers.
--   * order_count / type breakdown included cancelled and open orders, which
--     diluted avg_ticket and the completion %.
--
-- New definition (product decision): a "completed sale" is a CLOSED order, and
-- its value is order.total (subtotal - discount + tax — what the customer
-- actually paid). Every metric below now describes closed orders only, counting
-- only non-cancelled line items. cancelled_count is retained for the
-- order-status panel.
--
-- Signature & return columns are unchanged (2-arg, tenant via
-- current_tenant_id()), so generated types and the wrapper/hook stay put — only
-- the computation changes. We defensively drop the long-obsolete 3-arg overload
-- in case any environment still carries it (it must not coexist, or the
-- generated types gain a spurious union).
--
-- Known limitation (separate, low severity): report_date still buckets by UTC
-- because there is no per-tenant timezone setting. The summed period totals the
-- UI shows are unaffected (the created_at range filter is exact); only a future
-- per-day breakdown would need a tenant tz to attribute correctly.

DROP FUNCTION IF EXISTS public.get_revenue_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_top_sold_items(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT);
DROP FUNCTION IF EXISTS public.get_staff_performance(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

-- 1. Revenue summary — collected revenue from closed orders.
CREATE OR REPLACE FUNCTION public.get_revenue_summary(
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
  WITH closed_item_agg AS (
    -- Item counts for CLOSED orders only, excluding voided line items.
    SELECT oi.order_id, SUM(oi.quantity)::int AS item_count
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.tenant_id = v_tenant_id
      AND o.created_at >= p_from
      AND o.created_at < p_to
      AND o.status = 'closed'
      AND oi.status <> 'cancelled'
    GROUP BY oi.order_id
  )
  SELECT
    (o.created_at AT TIME ZONE 'UTC')::date AS report_date,
    COALESCE(SUM(o.total) FILTER (WHERE o.status = 'closed'), 0) AS total_revenue,
    COUNT(o.id) FILTER (WHERE o.status = 'closed')::int AS order_count,
    CASE
      WHEN COUNT(o.id) FILTER (WHERE o.status = 'closed') > 0
      THEN COALESCE(SUM(o.total) FILTER (WHERE o.status = 'closed'), 0)
           / COUNT(o.id) FILTER (WHERE o.status = 'closed')
      ELSE 0
    END AS avg_ticket,
    COUNT(o.id) FILTER (WHERE o.status = 'closed')::int AS completed_count,
    COUNT(o.id) FILTER (WHERE o.status = 'cancelled')::int AS cancelled_count,
    COUNT(o.id) FILTER (WHERE o.status = 'closed' AND o.order_type = 'dine_in')::int AS dine_in_count,
    COUNT(o.id) FILTER (WHERE o.status = 'closed' AND o.order_type = 'takeout')::int AS takeout_count,
    COUNT(o.id) FILTER (WHERE o.status = 'closed' AND o.order_type = 'delivery')::int AS delivery_count,
    COALESCE(SUM(cia.item_count), 0)::int AS total_items,
    COALESCE(SUM(o.discount_amount) FILTER (WHERE o.status = 'closed'), 0) AS total_discounts
  FROM public.orders o
  LEFT JOIN closed_item_agg cia ON cia.order_id = o.id
  WHERE o.tenant_id = v_tenant_id
    AND o.created_at >= p_from
    AND o.created_at < p_to
  GROUP BY (o.created_at AT TIME ZONE 'UTC')::date
  ORDER BY report_date;
END;
$$;

-- 2. Top sold items — closed orders, non-cancelled line items.
CREATE OR REPLACE FUNCTION public.get_top_sold_items(
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
    AND o.status = 'closed'
    AND oi.status <> 'cancelled'
  GROUP BY oi.menu_item_id, mi.name
  ORDER BY total_quantity DESC
  LIMIT p_limit;
END;
$$;

-- 3. Staff performance — each waiter's CLOSED-order revenue (order.total),
--    non-cancelled line items, only staff with at least one completed sale.
CREATE OR REPLACE FUNCTION public.get_staff_performance(
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
  WITH closed_item_agg AS (
    SELECT oi.order_id, SUM(oi.quantity)::int AS item_count
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.tenant_id = v_tenant_id
      AND o.created_at >= p_from
      AND o.created_at < p_to
      AND o.assigned_waiter_id IS NOT NULL
      AND o.status = 'closed'
      AND oi.status <> 'cancelled'
    GROUP BY oi.order_id
  )
  SELECT
    s.id AS staff_id,
    s.full_name::text AS staff_name,
    COALESCE(s.role, 'staff')::text AS staff_role,
    COUNT(o.id) FILTER (WHERE o.status = 'closed')::int AS orders_handled,
    COALESCE(SUM(o.total) FILTER (WHERE o.status = 'closed'), 0) AS revenue,
    COALESCE(SUM(cia.item_count), 0)::int AS items_sold,
    COUNT(o.id) FILTER (WHERE o.status = 'closed')::int AS completed_orders,
    COUNT(o.id) FILTER (WHERE o.status = 'cancelled')::int AS cancelled_orders
  FROM public.orders o
  JOIN public.staff s ON s.id = o.assigned_waiter_id
  LEFT JOIN closed_item_agg cia ON cia.order_id = o.id
  WHERE o.tenant_id = v_tenant_id
    AND o.created_at >= p_from
    AND o.created_at < p_to
    AND o.assigned_waiter_id IS NOT NULL
  GROUP BY s.id, s.full_name, s.role
  HAVING COUNT(o.id) FILTER (WHERE o.status = 'closed') > 0
  ORDER BY revenue DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_revenue_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_sold_items(TIMESTAMPTZ, TIMESTAMPTZ, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_performance(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
