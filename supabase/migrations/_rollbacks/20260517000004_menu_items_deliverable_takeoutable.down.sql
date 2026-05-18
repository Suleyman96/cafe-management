-- Rollback for 20260517000004_menu_items_deliverable_takeoutable.sql
--
-- Drops the channel-availability flags added to menu_items. Safe to run
-- after the takeout/delivery pickers stop reading these columns (they
-- already fall back to showing all items if both filters are removed).
--
-- Note: any client code still passing { isTakeoutable: true } /
-- { isDeliverable: true } to the menu wrapper after this rollback will
-- 400 on PostgREST — coordinate the rollback with a client revert.

ALTER TABLE menu_items
  DROP COLUMN IF EXISTS is_takeoutable,
  DROP COLUMN IF EXISTS is_deliverable;
