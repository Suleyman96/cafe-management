-- Relax orders_takeout_customer_check so takeout orders no longer require
-- customer_phone. Pairs with the earlier delivery relaxation
-- (20260515000005_delivery_customer_phone_optional.sql) — the original
-- migration kept takeout strict on the assumption that staff need a phone
-- to call when the order is ready, but in practice staff often take a
-- takeout order over the counter where only the name is available up
-- front. Phone can be added later via order edits if needed.
--
-- After this migration: dine_in needs nothing, delivery needs name,
-- takeout needs name. customer_phone is optional in every branch.
--
-- Constraint relaxation only (no destructive change), so no rollback file
-- is needed. The reverse migration would re-add `AND customer_phone IS NOT
-- NULL` to the takeout clause, which is also safe.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_takeout_customer_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_takeout_customer_check CHECK (
  (
    (order_type)::text = 'takeout'::text
    AND customer_name IS NOT NULL
  )
  OR (
    (order_type)::text = 'delivery'::text
    AND customer_name IS NOT NULL
  )
  OR (order_type)::text = 'dine_in'::text
);
