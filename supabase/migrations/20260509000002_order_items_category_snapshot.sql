-- ============================================================
-- Snapshot menu_items.category_id onto order_items at insert.
--
-- Without this snapshot, an admin re-categorising a menu item
-- mid-service would make in-flight order items teleport between
-- kitchen stations (Pizza station loses an in-progress pizza
-- because it's now under "Grill"). Mirrors the existing pattern
-- of snapshotting item_name and item_price at order time.
--
-- ON DELETE SET NULL: if a category is hard-deleted, historical
-- order rows survive without category attribution. Categories
-- are usually soft-deleted (is_active=false), so this path is
-- rare. The kitchen view layer treats null-category items as
-- always visible (never trapped behind a station filter).
--
-- A BEFORE INSERT trigger populates the snapshot from
-- menu_items.category_id when the caller doesn't supply one.
-- Putting this in the database (rather than the wrapper) means
-- every code path snapshots: wrapper, RPC, server-side routes,
-- migrations, ad-hoc admin inserts. SECURITY DEFINER so the
-- trigger can read menu_items even from contexts where the
-- caller's RLS would not (e.g. anon QR ordering inserts whose
-- effective tenant_id is set via the GUC).
--
-- NOTE: Plain CREATE INDEX (no CONCURRENTLY) because Supabase
-- CLI's pipelined `db reset` rejects CONCURRENTLY.
-- ============================================================

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;

-- Backfill existing rows from the current menu_item.category_id.
-- Idempotent: only fills rows that don't yet have a snapshot.
UPDATE public.order_items oi
SET category_id = mi.category_id
FROM public.menu_items mi
WHERE oi.menu_item_id = mi.id
  AND oi.category_id IS NULL
  AND mi.category_id IS NOT NULL;

-- Active-kitchen partial index: tight, hot-path index that
-- supports the common "active items in these categories for
-- this tenant" lookup without bloating order_items overall.
CREATE INDEX IF NOT EXISTS idx_order_items_active_category
  ON public.order_items (tenant_id, category_id, status)
  WHERE status IN ('pending', 'preparing', 'ready');

-- ============================================================
-- BEFORE INSERT trigger: auto-snapshot category_id from
-- menu_items when the caller doesn't supply one. Caller-
-- supplied values are preserved so a server route can override
-- (e.g. for items with no menu_item_id link, if such a path
-- ever exists).
-- ============================================================

CREATE OR REPLACE FUNCTION public.order_items_snapshot_category()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  IF NEW.category_id IS NULL AND NEW.menu_item_id IS NOT NULL THEN
    SELECT category_id INTO NEW.category_id
    FROM public.menu_items
    WHERE id = NEW.menu_item_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_items_snapshot_category_trg
  ON public.order_items;

CREATE TRIGGER order_items_snapshot_category_trg
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.order_items_snapshot_category();

COMMENT ON COLUMN public.order_items.category_id IS
  'Snapshot of menu_items.category_id at the time the order item was created. Frozen so admin re-categorisation does not move in-flight items between kitchen stations. Auto-populated by order_items_snapshot_category_trg when the caller does not supply one.';
