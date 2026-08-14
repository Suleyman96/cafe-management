-- Plan tiers v2 — recalibrate the plan matrix (single source: plan_limits()).
--
-- Rationale (product + business):
--   * Free was a thin demo (100 orders/mo ≈ 3/day, QR ordering OFF) — too tight
--     to actually try the product. Make it a real, usable trial: turn QR
--     ordering ON (custom_branding stays false, so free tenants' QR menu shows
--     "Powered by gustri" — every scan is free marketing), and raise the order
--     cap to 500/mo so a micro-cafe/food-truck can genuinely run on it.
--   * Order-count caps on PAID tiers are dangerous for a POS: a paying cafe that
--     hits the cap mid-month can't take orders during service → outage + churn.
--     Square/Loyverse don't cap transaction volume. Drop the cap on Standard/Pro
--     (set -1 = unlimited); differentiate on tables + features instead.
--   * Reconcile table caps with the pricing doc (Standard 10→15) and keep clear
--     tier separation: Standard 15 (small), Pro 40 (one large restaurant),
--     Business unlimited (multi-location).
--
-- Only plan_limits() changes; plan_allows_feature / plan_allows_new_table /
-- check_order_limit all consult it, so they pick up the new values automatically
-- (both already treat -1 as unlimited). @gustri/core PLAN_LIMITS is updated in
-- the same PR; the CI parity test asserts row-by-row equality.
--
-- Field order MUST match plan_limits_t:
--   (max_tables, max_orders_per_month, qr_ordering, kitchen_display,
--    inventory, waste, scheduling, tasks, custom_branding, analytics)

CREATE OR REPLACE FUNCTION public.plan_limits(plan text)
RETURNS public.plan_limits_t
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  result public.plan_limits_t;
BEGIN
  -- ELSE + free share the same row: an unknown/NULL plan fails closed to the
  -- free tier (lowest paid features off), never silently granting paid features.
  CASE COALESCE(plan, 'free')
    WHEN 'free' THEN
      result := (5,  500, true, true, false, false, false, false, false, 'basic');
    WHEN 'standard' THEN
      result := (15, -1,  true, true, false, false, false, false, true,  'full');
    WHEN 'pro' THEN
      result := (40, -1,  true, true, true,  true,  true,  true,  true,  'full');
    WHEN 'business' THEN
      result := (-1, -1,  true, true, true,  true,  true,  true,  true,  'full');
    ELSE
      result := (5,  500, true, true, false, false, false, false, false, 'basic');
  END CASE;
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.plan_limits(text) IS
  'Single source of truth for plan caps + feature flags (v2). Mirrors @gustri/core PLAN_LIMITS — a CI integration test asserts row-by-row equality. Update both together.';
