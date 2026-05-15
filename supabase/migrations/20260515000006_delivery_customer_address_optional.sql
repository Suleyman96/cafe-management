-- Make delivery_customers.address nullable. Staff sometimes save a
-- customer profile from a phone-only call before the address is captured
-- (the order itself was already allowed to have no address in the
-- previous migration). Keep `name` NOT NULL — a profile without any
-- identifier is meaningless.
--
-- Relaxation only; no destructive change. Rollback would be
-- `ALTER COLUMN address SET NOT NULL` and is only safe if all existing
-- rows have a non-null address.

ALTER TABLE public.delivery_customers
  ALTER COLUMN address DROP NOT NULL;
