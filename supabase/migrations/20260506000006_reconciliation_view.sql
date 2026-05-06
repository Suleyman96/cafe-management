-- ============================================================
-- Post-audit Plan 14: end-of-shift reconciliation RPC.
-- ============================================================
--
-- Goal: surface a single "did the shift balance?" report. Closing managers
-- need to see, for an arbitrary date range:
--   * Expected revenue (sum of total on closed orders)
--   * Recorded payments by method (cash, card, digital, plus tips)
--   * Refunds issued
--   * Comp / write-off totals (orders.force_close_reason — added by Plan 4)
--   * Per-staff breakdown (orders handled, payments collected)
--   * The discrepancy: expected vs. (payments + comps), highlighted when
--     non-zero. A zero gap is the "books balanced" signal; a non-zero gap
--     is an auditable amount that needs explanation.
--
-- Choice — single JSONB return vs. multiple RETURNS TABLE RPCs:
--   One JSONB roundtrip beats four. The page renders one cohesive screen,
--   and TanStack caches the whole payload as a unit. The shape is wrapped
--   on the client into a typed `ShiftReconciliation` interface; downstream
--   columns can move within the JSON without changing the wrapper sig.
--
-- Tenant scoping: derives v_tenant_id from current_tenant_id() — same
-- pattern as the rest of get_*_summary RPCs (post H5 hardening). Caller
-- cannot inject a tenant_id, and SECURITY DEFINER avoids the per-table
-- RLS double-tax inside the aggregate.
--
-- Authorization: GRANT EXECUTE TO authenticated. The row-shape is
-- aggregated and contains no PII beyond staff_name (already on
-- get_staff_performance, which has the same authz model). The reports
-- page itself gates by `staff.role === 'owner'` — see
-- apps/staff-web/src/app/(staff)/reports/shift-reconciliation/page.tsx.
--
-- Time semantics: ranges over orders.closed_at (or paid_at as a fallback
-- for older rows). Refunds aggregate over refunds.created_at because a
-- refund is its own event timeline; tying it to closed_at would miss
-- post-close refunds entirely.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_shift_reconciliation(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
  v_summary JSONB;
  v_by_method JSONB;
  v_per_staff JSONB;
  v_comps JSONB;
BEGIN
  v_tenant_id := public.current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant context';
  END IF;

  -- Anchor: closed orders in the window. closed_at is the canonical close
  -- timestamp (set by update_order_payment_status); falls back to paid_at
  -- for older rows that pre-date the column. updated_at would also work
  -- but is too noisy.
  WITH closed_orders AS (
    SELECT
      o.id,
      o.tenant_id,
      o.total,
      o.assigned_waiter_id,
      o.force_close_reason,
      COALESCE(o.closed_at, o.paid_at, o.updated_at) AS event_at
    FROM public.orders o
    WHERE o.tenant_id = v_tenant_id
      AND o.status = 'closed'
      AND COALESCE(o.closed_at, o.paid_at, o.updated_at) >= p_from
      AND COALESCE(o.closed_at, o.paid_at, o.updated_at) < p_to
  ),
  payments_in_range AS (
    SELECT
      op.order_id,
      op.payment_method,
      op.amount,
      COALESCE(op.tip_amount, 0) AS tip_amount,
      op.received_by
    FROM public.order_payments op
    JOIN closed_orders co ON co.id = op.order_id
    WHERE op.tenant_id = v_tenant_id
  ),
  refunds_in_range AS (
    SELECT
      r.amount,
      r.refund_method,
      r.processed_by
    FROM public.refunds r
    WHERE r.tenant_id = v_tenant_id
      AND r.created_at >= p_from
      AND r.created_at < p_to
  )
  SELECT
    -- Headline numbers
    jsonb_build_object(
      'order_count', COALESCE((SELECT COUNT(*) FROM closed_orders), 0),
      'expected_revenue', COALESCE((SELECT SUM(total) FROM closed_orders), 0),
      'payments_received', COALESCE((SELECT SUM(amount) FROM payments_in_range), 0),
      'tips_collected', COALESCE((SELECT SUM(tip_amount) FROM payments_in_range), 0),
      'refunds_total', COALESCE((SELECT SUM(amount) FROM refunds_in_range), 0),
      'refund_count', COALESCE((SELECT COUNT(*) FROM refunds_in_range), 0),
      -- Comps: closed orders with a force_close_reason carry an unpaid
      -- balance (total - sum of payments on that order). That balance is
      -- the "written off" amount the owner is consenting to.
      'comps_total', COALESCE((
        SELECT SUM(co.total - COALESCE((
          SELECT SUM(op.amount) FROM public.order_payments op WHERE op.order_id = co.id AND op.tenant_id = v_tenant_id
        ), 0))
        FROM closed_orders co
        WHERE co.force_close_reason IS NOT NULL
      ), 0),
      'comp_count', COALESCE((SELECT COUNT(*) FROM closed_orders WHERE force_close_reason IS NOT NULL), 0)
    )
  INTO v_summary;

  -- By-method breakdown (received side)
  SELECT COALESCE(jsonb_agg(row_to_jsonb(t) ORDER BY t.payment_method), '[]'::jsonb)
  INTO v_by_method
  FROM (
    SELECT
      p.payment_method,
      SUM(p.amount)::NUMERIC AS amount,
      SUM(p.tip_amount)::NUMERIC AS tips,
      COUNT(*)::INT AS payment_count
    FROM payments_in_range p
    GROUP BY p.payment_method
  ) t;

  -- Per-staff breakdown — orders assigned and payments collected
  SELECT COALESCE(jsonb_agg(row_to_jsonb(t) ORDER BY t.revenue DESC), '[]'::jsonb)
  INTO v_per_staff
  FROM (
    SELECT
      s.id AS staff_id,
      s.full_name::text AS staff_name,
      COALESCE(s.role, 'staff')::text AS staff_role,
      (SELECT COUNT(*) FROM closed_orders co WHERE co.assigned_waiter_id = s.id)::INT AS orders_handled,
      COALESCE((SELECT SUM(co.total) FROM closed_orders co WHERE co.assigned_waiter_id = s.id), 0)::NUMERIC AS revenue,
      (SELECT COUNT(*) FROM payments_in_range p WHERE p.received_by = s.id)::INT AS payment_count,
      COALESCE((SELECT SUM(p.amount) FROM payments_in_range p WHERE p.received_by = s.id), 0)::NUMERIC AS payments_collected,
      COALESCE((SELECT SUM(r.amount) FROM refunds_in_range r WHERE r.processed_by = s.id), 0)::NUMERIC AS refunds_processed
    FROM public.staff s
    WHERE s.tenant_id = v_tenant_id
      AND (
        EXISTS (SELECT 1 FROM closed_orders co WHERE co.assigned_waiter_id = s.id)
        OR EXISTS (SELECT 1 FROM payments_in_range p WHERE p.received_by = s.id)
        OR EXISTS (SELECT 1 FROM refunds_in_range r WHERE r.processed_by = s.id)
      )
  ) t;

  -- Comps grouped by reason (NULL reasons are anomalies — not expected
  -- here because we filtered force_close_reason IS NOT NULL).
  SELECT COALESCE(jsonb_agg(row_to_jsonb(t) ORDER BY t.amount DESC), '[]'::jsonb)
  INTO v_comps
  FROM (
    SELECT
      co.force_close_reason::text AS reason,
      COUNT(*)::INT AS comp_count,
      SUM(co.total - COALESCE((
        SELECT SUM(op.amount) FROM public.order_payments op WHERE op.order_id = co.id AND op.tenant_id = v_tenant_id
      ), 0))::NUMERIC AS amount
    FROM closed_orders co
    WHERE co.force_close_reason IS NOT NULL
    GROUP BY co.force_close_reason
  ) t;

  RETURN jsonb_build_object(
    'summary', v_summary,
    'by_method', v_by_method,
    'per_staff', v_per_staff,
    'comps', v_comps,
    'range', jsonb_build_object('from', p_from, 'to', p_to)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shift_reconciliation(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMIT;
