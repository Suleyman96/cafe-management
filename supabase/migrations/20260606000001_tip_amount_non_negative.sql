-- Audit should-fix: guard order_payments.tip_amount.
--
-- order_payments.amount is protected by CHECK (amount > 0), but tip_amount had
-- no constraint and was nullable. Payments are inserted directly via the
-- wrapper (not through a validating RPC like refunds/discounts), so a negative
-- tip would silently understate recorded cash with nothing to stop it.
--
-- Backfill any NULLs to 0, make the column NOT NULL with a 0 default, and add a
-- non-negative CHECK.

BEGIN;

UPDATE public.order_payments SET tip_amount = 0 WHERE tip_amount IS NULL;

ALTER TABLE public.order_payments ALTER COLUMN tip_amount SET DEFAULT 0;
ALTER TABLE public.order_payments ALTER COLUMN tip_amount SET NOT NULL;

ALTER TABLE public.order_payments
  ADD CONSTRAINT order_payments_tip_amount_non_negative CHECK (tip_amount >= 0);

COMMIT;
