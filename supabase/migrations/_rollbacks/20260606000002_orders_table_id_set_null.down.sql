-- Rollback for 20260606000002_orders_table_id_set_null.sql
-- Restores the original ON DELETE CASCADE (reinstates the history-loss hazard).
BEGIN;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_table_id_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_table_id_fkey
  FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE CASCADE;

COMMIT;
