-- ============================================================
-- Post-audit Plan 4: "items unpaid" guard on close-order.
-- ============================================================
--
-- Goal: closing a dine-in order whose payments don't cover the total is one
-- tap away today, and the row writes off silently. After this migration:
--
--   - status: non-closed -> closed only succeeds when remaining balance
--     (total - paid + refunded) is ~0 OR force_close_reason is set.
--   - force_close_reason is a free-text column the staff-web modal fills
--     from a small enum (`comped`, `walk_out`, `staff_meal`, `other`).
--     Plan 14 (end-of-shift reconciliation) reads this column to surface
--     write-offs as an auditable category instead of a silent revenue gap.
--
-- The state-machine trigger (20260504000007/8) already polices status
-- transitions; this guard sits BEFORE UPDATE OF status alongside it, so
-- both checks must pass. Triggers fire alphabetically — guard_close_unpaid
-- runs before validate_order_status_transition. Either trigger raising
-- aborts the UPDATE.
--
-- Why reuse get_order_remaining_balance:
-- The baseline already has the canonical "what does this order still owe"
-- function — it's the single source of truth for `total - paid + refunded`
-- and is used by validate_payment_amount, validate_refund_amount, and the
-- order_payment_summary view. Inlining the math here would create a second
-- definition that drifts. The function is STABLE, so calling it from the
-- trigger is safe.
--
-- Epsilon: -0.01 in tenant currency. order.total is NUMERIC(12,2) and
-- payments are also currency-precise, so the subtraction is exact in
-- normal flows. The epsilon protects against any future precision drift
-- from discounts/tax recalculations without letting a real shortfall
-- through (a 1-cent slack is below any meaningful write-off).
--
-- Existing rows: untouched. The trigger only fires on UPDATE OF status,
-- so already-closed orders stay closed; partially-paid open orders are
-- unaffected until someone tries to close them.

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS force_close_reason TEXT;

COMMENT ON COLUMN public.orders.force_close_reason IS
  'Set by staff when closing an order whose payments do not cover the total. Written from a small enum in the close-unpaid modal (comped, walk_out, staff_meal, other). NULL on normally-paid closes. Surfaced in shift reconciliation (Plan 14).';

CREATE OR REPLACE FUNCTION public.guard_close_order_unpaid()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
DECLARE
  v_remaining NUMERIC;
BEGIN
  -- Only police the transition into closed. Other status moves are the
  -- state-machine trigger's responsibility.
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
    v_remaining := public.get_order_remaining_balance(NEW.id);

    -- Tolerate sub-cent precision drift (see migration header). A real
    -- shortfall — even one cent — is treated as unpaid; tighter tolerance
    -- is the safer default for a money-safety guard.
    IF v_remaining > 0.01 AND NEW.force_close_reason IS NULL THEN
      RAISE EXCEPTION 'order_close_requires_payment_or_reason'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_close_order_unpaid ON public.orders;
CREATE TRIGGER guard_close_order_unpaid
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.guard_close_order_unpaid();

COMMIT;
