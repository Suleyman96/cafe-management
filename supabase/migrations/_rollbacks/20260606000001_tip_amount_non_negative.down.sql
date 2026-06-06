-- Rollback for 20260606000001_tip_amount_non_negative.sql
BEGIN;

ALTER TABLE public.order_payments
  DROP CONSTRAINT IF EXISTS order_payments_tip_amount_non_negative;
ALTER TABLE public.order_payments ALTER COLUMN tip_amount DROP NOT NULL;
-- The original column already had DEFAULT 0; leave it.

COMMIT;
