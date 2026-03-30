-- Migration: Add refunds table and update balance function
-- Date: 2026-03-29

-- ========================================
-- 1. Create refunds table
-- ========================================

CREATE TABLE public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  processed_by UUID NOT NULL REFERENCES public.staff(id),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  refund_method VARCHAR(10) NOT NULL CHECK (refund_method IN ('cash', 'card', 'digital')),
  order_item_ids UUID[] DEFAULT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refunds_order_id ON public.refunds(order_id);
CREATE INDEX idx_refunds_created_at ON public.refunds(created_at);

COMMENT ON TABLE public.refunds IS 'Refund records for order payments';

-- ========================================
-- 2. Validate refund amount trigger
-- ========================================

CREATE OR REPLACE FUNCTION public.validate_refund_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  total_paid DECIMAL(10, 2);
  total_refunded DECIMAL(10, 2);
  available DECIMAL(10, 2);
BEGIN
  -- Get total paid for this order
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.order_payments
  WHERE order_id = NEW.order_id;

  -- Get total already refunded
  SELECT COALESCE(SUM(amount), 0) INTO total_refunded
  FROM public.refunds
  WHERE order_id = NEW.order_id;

  available := total_paid - total_refunded;

  IF NEW.amount > available THEN
    RAISE EXCEPTION 'Refund amount (%) exceeds available amount (%)',
      NEW.amount, available;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_refund_amount_trigger
  BEFORE INSERT ON public.refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_refund_amount();

-- ========================================
-- 3. Update get_order_remaining_balance to include refunds
-- ========================================

CREATE OR REPLACE FUNCTION public.get_order_remaining_balance(order_uuid UUID)
RETURNS DECIMAL(10, 2)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  order_total DECIMAL(10, 2);
  paid_amount DECIMAL(10, 2);
  refunded_amount DECIMAL(10, 2);
BEGIN
  SELECT total INTO order_total
  FROM public.orders
  WHERE id = order_uuid;

  IF order_total IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', order_uuid;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO paid_amount
  FROM public.order_payments
  WHERE order_id = order_uuid;

  SELECT COALESCE(SUM(amount), 0) INTO refunded_amount
  FROM public.refunds
  WHERE order_id = order_uuid;

  -- remaining = total - paid + refunded
  RETURN order_total - paid_amount + refunded_amount;
END;
$$;
