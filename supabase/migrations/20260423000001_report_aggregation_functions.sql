-- Report aggregation functions for server-side data crunching
-- Replaces client-side useMemo calculations in the reports page

-- 1. Revenue summary with daily breakdown
CREATE OR REPLACE FUNCTION get_revenue_summary(
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
    GROUP BY oi.order_id
  )
  SELECT
    (o.created_at AT TIME ZONE 'UTC')::date AS report_date,
    COALESCE(SUM(oia.item_revenue), 0) AS total_revenue,
    COUNT(o.id)::int AS order_count,
    CASE
      WHEN COUNT(o.id) > 0
      THEN COALESCE(SUM(oia.item_revenue), 0) / COUNT(o.id)
      ELSE 0
    END AS avg_ticket,
    COUNT(o.id) FILTER (WHERE o.status = 'closed')::int AS completed_count,
    COUNT(o.id) FILTER (WHERE o.status = 'cancelled')::int AS cancelled_count,
    COUNT(o.id) FILTER (WHERE o.order_type = 'dine_in')::int AS dine_in_count,
    COUNT(o.id) FILTER (WHERE o.order_type = 'takeout')::int AS takeout_count,
    COUNT(o.id) FILTER (WHERE o.order_type = 'delivery')::int AS delivery_count,
    COALESCE(SUM(oia.item_count), 0)::int AS total_items,
    COALESCE(SUM(o.discount_amount), 0) AS total_discounts
  FROM orders o
  LEFT JOIN order_item_agg oia ON oia.order_id = o.id
  WHERE o.tenant_id = p_tenant_id
    AND o.created_at >= p_from
    AND o.created_at < p_to
  GROUP BY report_date
  ORDER BY report_date;
$$;

-- 2. Top sold items
CREATE OR REPLACE FUNCTION get_top_sold_items(
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
  GROUP BY oi.menu_item_id, mi.name
  ORDER BY total_quantity DESC
  LIMIT p_limit;
$$;

-- 3. Expense summary by category
CREATE OR REPLACE FUNCTION get_expense_summary(
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
    AND e.expense_date >= (p_from AT TIME ZONE 'UTC')::date
    AND e.expense_date < (p_to AT TIME ZONE 'UTC')::date
  GROUP BY ec.name
  ORDER BY total_amount DESC;
$$;

-- 4. Waste summary by reason and item
CREATE OR REPLACE FUNCTION get_waste_summary(
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
    AND wl.waste_date >= (p_from AT TIME ZONE 'UTC')::date
    AND wl.waste_date < (p_to AT TIME ZONE 'UTC')::date
  GROUP BY wl.reason, wl.item_name
  ORDER BY total_cost DESC;
$$;

-- 5. Staff performance summary
CREATE OR REPLACE FUNCTION get_staff_performance(
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
