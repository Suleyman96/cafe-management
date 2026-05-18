-- Rollback for 20260517000005_enforce_menu_item_channel_policy.sql
--
-- Removes the trigger first (otherwise dropping the function fails
-- with "still in use"), then the function. Safe regardless of whether
-- the channel-policy migration was applied — IF EXISTS makes both
-- DROPs idempotent.

BEGIN;

DROP TRIGGER IF EXISTS enforce_menu_item_channel_policy_trigger ON public.order_items;
DROP FUNCTION IF EXISTS public.enforce_menu_item_channel_policy();

COMMIT;
