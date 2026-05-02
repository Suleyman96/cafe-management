-- Migration: Make payment & refund validation atomic under concurrent inserts.
--
-- Root cause being fixed:
--   The previous validate_refund_amount / validate_payment_amount BEFORE-INSERT
--   triggers computed available/remaining via plain SELECTs. Under READ
--   COMMITTED, two concurrent inserts each see the same pre-insert snapshot,
--   both pass the check, and both commit — producing
--   total_refunded > total_paid (or total_paid > order_total).
--
-- Fix:
--   Take an exclusive row lock on the parent orders row inside the trigger
--   (PERFORM ... FOR UPDATE) before reading the running totals. Concurrent
--   inserts for the same order serialize on that lock, so the second one
--   sees the first one's commit and rejects correctly.
--
-- Also folds in H2: tenant guard. The trigger refuses to insert a refund or
-- payment whose tenant_id disagrees with the parent order's tenant_id, so a
-- compromised/buggy caller cannot attribute money movement to the wrong tenant.
--
-- The existing validate_payment_amount_trigger and validate_refund_amount_trigger
-- (created in baseline) already invoke these functions — we replace the function
-- bodies in place rather than adding duplicate triggers.

BEGIN;

-- ========================================
-- 1. validate_refund_amount — lock + tenant guard
-- ========================================

CREATE OR REPLACE FUNCTION public.validate_refund_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  order_tenant_id UUID;
  total_paid NUMERIC(14, 4);
  total_refunded NUMERIC(14, 4);
  available NUMERIC(14, 4);
BEGIN
  -- Serialize concurrent refund/payment inserts for this order. The lock is
  -- released at the end of the surrounding transaction.
  SELECT tenant_id INTO order_tenant_id
  FROM public.orders
  WHERE id = NEW.order_id
  FOR UPDATE;

  IF order_tenant_id IS NULL THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM order_tenant_id THEN
    RAISE EXCEPTION 'refund_tenant_mismatch' USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.order_payments
  WHERE order_id = NEW.order_id;

  SELECT COALESCE(SUM(amount), 0) INTO total_refunded
  FROM public.refunds
  WHERE order_id = NEW.order_id;

  available := total_paid - total_refunded;

  IF NEW.amount > available THEN
    RAISE EXCEPTION 'refund_exceeds_available' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- ========================================
-- 2. validate_payment_amount — lock + tenant guard
-- ========================================

CREATE OR REPLACE FUNCTION public.validate_payment_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  order_tenant_id UUID;
  order_total NUMERIC(14, 4);
  total_paid NUMERIC(14, 4);
  remaining NUMERIC(14, 4);
BEGIN
  -- Lock the parent order row to serialize concurrent payment inserts.
  SELECT tenant_id, total INTO order_tenant_id, order_total
  FROM public.orders
  WHERE id = NEW.order_id
  FOR UPDATE;

  IF order_tenant_id IS NULL THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM order_tenant_id THEN
    RAISE EXCEPTION 'payment_tenant_mismatch' USING ERRCODE = 'check_violation';
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
  'Prevent overpayment on orders. Locks the parent order row to serialize concurrent inserts; enforces tenant_id parity with the parent order.';

COMMENT ON FUNCTION public.validate_refund_amount() IS
  'Prevent over-refund on orders. Locks the parent order row to serialize concurrent inserts; enforces tenant_id parity with the parent order.';

COMMIT;
