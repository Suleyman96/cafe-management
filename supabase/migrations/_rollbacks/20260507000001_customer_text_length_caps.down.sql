-- Rollback for 20260507000001_customer_text_length_caps.sql.
--
-- Pure constraint drops. No data is touched and no rows can have been
-- written that violate the constraints (since they were enforced at
-- write time), so this is a clean back-out — running the down then the
-- up again leaves the database in the same state as a single up.

BEGIN;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_customer_notes_length_check;
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_delivery_address_length_check;
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_delivery_notes_length_check;
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_internal_notes_length_check;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_notes_length_check;

ALTER TABLE public.customer_feedback
  DROP CONSTRAINT IF EXISTS customer_feedback_message_length_check;
ALTER TABLE public.customer_feedback
  DROP CONSTRAINT IF EXISTS customer_feedback_response_length_check;

ALTER TABLE public.waiter_calls
  DROP CONSTRAINT IF EXISTS waiter_calls_notes_length_check;

COMMIT;
