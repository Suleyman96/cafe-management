-- Migration: Reject payments on closed/cancelled orders.
--
-- Root cause being fixed:
--   `validate_payment_amount` (last touched in 20260503000003) only
--   guarded against overpayment and tenant mismatch. It silently allowed
--   payment inserts on orders whose status was already `closed` or
--   `cancelled`. That left two failure modes open:
--     - A bug or stale UI could record cash against an order that has
--       been settled and closed, producing a phantom credit balance.
--     - A late insert against a cancelled order would re-mark the order
--       paid via the `update_order_payment_status` AFTER trigger, even
--       though the order should not be billable.
--
-- Fix:
--   After acquiring the FOR UPDATE lock on the parent order (so the
--   status read reflects any concurrent close/cancel that already
--   committed), reject the insert if the order is in a terminal state.
--   Trigger binding is unchanged — `CREATE OR REPLACE` swap.
--
-- Locking + tenant guard preserved exactly from 20260503000003.

BEGIN;

CREATE OR REPLACE FUNCTION public.validate_payment_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  order_tenant_id UUID;
  order_total NUMERIC(14, 4);
  order_status TEXT;
  total_paid NUMERIC(14, 4);
  remaining NUMERIC(14, 4);
BEGIN
  -- Lock the parent order row to serialize concurrent payment inserts.
  SELECT tenant_id, total, status
    INTO order_tenant_id, order_total, order_status
  FROM public.orders
  WHERE id = NEW.order_id
  FOR UPDATE;

  IF order_tenant_id IS NULL THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM order_tenant_id THEN
    RAISE EXCEPTION 'payment_tenant_mismatch' USING ERRCODE = 'check_violation';
  END IF;

  -- Reject inserts on terminal-state orders. Lock is already held, so the
  -- status read can't race a parallel close/cancel — either we see the
  -- prior committed state, or we wait on their lock and then see it.
  IF order_status IN ('closed', 'cancelled') THEN
    RAISE EXCEPTION 'payment_on_terminal_order'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.order_payments
  WHERE order_id = NEW.order_id;

  remaining := order_total - total_paid;

  -- 0.0001 tolerance accommodates client-side rounding at NUMERIC(14,4) precision.
  IF NEW.amount > remaining + 0.0001 THEN
    RAISE EXCEPTION 'payment_exceeds_remaining' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_payment_amount() IS
  'Prevent overpayment, tenant mismatch, and payments against closed/cancelled orders. Locks the parent order row to serialize concurrent inserts.';

COMMIT;
