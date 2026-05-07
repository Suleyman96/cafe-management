-- Rollback for 20260507000005_validate_customer_text_length_caps.sql.
--
-- Postgres has no INVALIDATE CONSTRAINT — the only way to flip a
-- validated CHECK back to NOT VALID is DROP + re-ADD WITH NOT VALID.
-- This rollback exists for symmetry with the rest of the migration
-- tree; in practice you almost never want to run it (going from
-- "fully enforced" to "enforced on writes only" is not a useful
-- back-out).
--
-- Locking. The DROP/ADD cycle takes ACCESS EXCLUSIVE briefly per
-- statement — same lock profile as the original 20260507000001 add.

BEGIN;

-- orders ------------------------------------------------------------

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_customer_notes_length_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_customer_notes_length_check
  CHECK (customer_notes IS NULL OR length(customer_notes) <= 2000)
  NOT VALID;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_delivery_address_length_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_address_length_check
  CHECK (delivery_address IS NULL OR length(delivery_address) <= 500)
  NOT VALID;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_delivery_notes_length_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_notes_length_check
  CHECK (delivery_notes IS NULL OR length(delivery_notes) <= 2000)
  NOT VALID;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_internal_notes_length_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_internal_notes_length_check
  CHECK (internal_notes IS NULL OR length(internal_notes) <= 2000)
  NOT VALID;

-- order_items -------------------------------------------------------

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_notes_length_check;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_notes_length_check
  CHECK (notes IS NULL OR length(notes) <= 500)
  NOT VALID;

-- customer_feedback -------------------------------------------------

ALTER TABLE public.customer_feedback
  DROP CONSTRAINT IF EXISTS customer_feedback_message_length_check;
ALTER TABLE public.customer_feedback
  ADD CONSTRAINT customer_feedback_message_length_check
  CHECK (length(message) <= 1000)
  NOT VALID;

ALTER TABLE public.customer_feedback
  DROP CONSTRAINT IF EXISTS customer_feedback_response_length_check;
ALTER TABLE public.customer_feedback
  ADD CONSTRAINT customer_feedback_response_length_check
  CHECK (response IS NULL OR length(response) <= 2000)
  NOT VALID;

-- waiter_calls ------------------------------------------------------

ALTER TABLE public.waiter_calls
  DROP CONSTRAINT IF EXISTS waiter_calls_notes_length_check;
ALTER TABLE public.waiter_calls
  ADD CONSTRAINT waiter_calls_notes_length_check
  CHECK (notes IS NULL OR length(notes) <= 500)
  NOT VALID;

COMMIT;
