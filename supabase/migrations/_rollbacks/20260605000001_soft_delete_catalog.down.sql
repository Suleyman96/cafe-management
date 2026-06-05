-- Rollback for 20260605000001_soft_delete_catalog.sql
--
-- Drops the restrictive read policies, partial indexes, and deleted_at columns.
-- NOTE: dropping deleted_at discards any soft-deleted rows' tombstone flag —
-- previously soft-deleted rows become visible again as live catalog entries.
-- Reconcile (hard-delete the intended rows) before rolling back in an
-- environment with real soft-deletes.

BEGIN;

DROP FUNCTION IF EXISTS public.soft_delete_menu_item(uuid);
DROP FUNCTION IF EXISTS public.soft_delete_category(uuid);

DROP POLICY IF EXISTS exclude_soft_deleted ON public.menu_items;
DROP POLICY IF EXISTS exclude_soft_deleted ON public.categories;

DROP INDEX IF EXISTS public.idx_menu_items_live;
DROP INDEX IF EXISTS public.idx_categories_live;

ALTER TABLE public.menu_items DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.categories DROP COLUMN IF EXISTS deleted_at;

COMMIT;
