-- Free plan: lower the monthly order cap 500 → 300.
--
-- Rationale (product + business):
--   * 500/mo proved too generous for a "real trial" tier — a micro-cafe running
--     at that volume is a viable paying customer, so the free cap was leaving
--     money on the table. 300/mo (≈10 orders/day) still lets a genuine
--     micro-cafe/food-truck evaluate the full product, but nudges steady
--     operators onto a paid tier sooner.
--   * ONLY the free tier's order cap changes. Standard/Pro/Business stay -1
--     (unlimited) — a hard mid-month cap on a paying cafe's POS is an outage.
--   * plan_allows_feature / plan_allows_new_table / check_order_limit all consult
--     plan_limits(), so they pick up the new value automatically (all treat -1 as
--     unlimited). @gustri/core PLAN_LIMITS is updated in the same PR; the CI
--     parity test asserts row-by-row equality.
--
-- This only re-declares plan_limits() with the single free value changed; no
-- table shape changes, so generated types are unaffected.
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
      result := (5,  300, true, true, false, false, false, false, false, 'basic');
    WHEN 'standard' THEN
      result := (15, -1,  true, true, false, false, false, false, true,  'full');
    WHEN 'pro' THEN
      result := (40, -1,  true, true, true,  true,  true,  true,  true,  'full');
    WHEN 'business' THEN
      result := (-1, -1,  true, true, true,  true,  true,  true,  true,  'full');
    ELSE
      result := (5,  300, true, true, false, false, false, false, false, 'basic');
  END CASE;
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.plan_limits(text) IS
  'Single source of truth for plan caps + feature flags (v2). Mirrors @gustri/core PLAN_LIMITS — a CI integration test asserts row-by-row equality. Update both together.';
