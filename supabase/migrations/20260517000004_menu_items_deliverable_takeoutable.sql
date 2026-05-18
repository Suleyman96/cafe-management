-- Adds two channel-availability flags on menu_items, separate from the
-- transient `is_available` (kitchen "we're out right now" state).
--
--   is_takeoutable — item can be sold via the takeout flow
--   is_deliverable — item can be sold via the delivery flow
--
-- Both default to TRUE so every existing item continues to appear in both
-- channels until an admin opts it out. These are policy flags ("ice cream
-- doesn't survive a delivery bike ride"), not stock flags — the takeout
-- and delivery menu pickers HIDE non-flagged items entirely rather than
-- showing them grayed out the way `is_available=false` does.

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS is_takeoutable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_deliverable boolean NOT NULL DEFAULT true;
