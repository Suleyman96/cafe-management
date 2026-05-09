-- Rollback for 20260509000002_order_items_category_snapshot.sql.
--
-- Drops the snapshot trigger, the partial index, and the
-- order_items.category_id column. Snapshot data is destroyed,
-- but menu_items.category_id can rebuild it via JOIN if needed.

DROP TRIGGER IF EXISTS order_items_snapshot_category_trg
  ON public.order_items;

DROP FUNCTION IF EXISTS public.order_items_snapshot_category();

DROP INDEX IF EXISTS public.idx_order_items_active_category;

ALTER TABLE public.order_items
  DROP COLUMN IF EXISTS category_id;
