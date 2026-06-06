-- Audit should-fix: stop a table deletion from destroying order history.
--
-- orders.table_id was ON DELETE CASCADE, so deleting a table cascade-deleted
-- its orders (and their order_items). Orders carrying money rows are already
-- protected — the financial children → orders FKs are ON DELETE RESTRICT
-- (20260505000001), so the table delete fails before reaching them — but
-- unpaid/cancelled dine-in orders and their items were still silently lost on a
-- routine admin "delete table" action.
--
-- Switch to ON DELETE SET NULL (matching customer_feedback.table_id): deleting
-- a table preserves its orders and just unlinks them from the now-gone table.
-- orders.table_id is already nullable (delivery/takeout orders have none), so
-- this is valid for every order type.

BEGIN;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_table_id_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_table_id_fkey
  FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE SET NULL;

COMMIT;
