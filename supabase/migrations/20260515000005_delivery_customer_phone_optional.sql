-- Relax orders_takeout_customer_check so delivery orders no longer require
-- customer_phone. Staff often take a delivery order over the counter where
-- only the customer's name is available up front; the phone (and address)
-- can be added later via order edits. Takeout is unchanged — name + phone
-- still required there.
--
-- Constraint relaxation only (no destructive change), so no rollback file
-- is needed. The reverse migration would simply re-add `AND customer_phone
-- IS NOT NULL` to the delivery clause, which is also safe.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_takeout_customer_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_takeout_customer_check CHECK (
  (
    (order_type)::text = 'takeout'::text
    AND customer_name IS NOT NULL
    AND customer_phone IS NOT NULL
  )
  OR (
    (order_type)::text = 'delivery'::text
    AND customer_name IS NOT NULL
  )
  OR (order_type)::text = 'dine_in'::text
);
