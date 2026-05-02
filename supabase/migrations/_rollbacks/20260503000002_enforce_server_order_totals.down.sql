-- Rollback for 20260503000002_enforce_server_order_totals.sql

BEGIN;

DROP TRIGGER IF EXISTS trg_snapshot_item_price ON public.order_items;
DROP FUNCTION IF EXISTS public.snapshot_item_price_from_menu();

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_totals_nonnegative_check;

COMMIT;
