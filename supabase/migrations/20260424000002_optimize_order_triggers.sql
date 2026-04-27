-- Narrow recalculate_on_item_update to only fire when price/quantity changes.
-- Status changes (the most frequent update) no longer trigger recalculation.
DROP TRIGGER IF EXISTS recalculate_on_item_update ON public.order_items;

CREATE TRIGGER recalculate_on_item_update
  AFTER UPDATE OF quantity, item_price ON public.order_items
  FOR EACH ROW
  WHEN (
    OLD.quantity IS DISTINCT FROM NEW.quantity
    OR OLD.item_price IS DISTINCT FROM NEW.item_price
  )
  EXECUTE FUNCTION public.recalculate_order_total();

-- Narrow update_table_on_order to only fire when order status or table assignment changes.
DROP TRIGGER IF EXISTS update_table_on_order ON public.orders;

CREATE TRIGGER update_table_on_order
  AFTER INSERT OR UPDATE OF status, table_id ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_table_status_on_order();
