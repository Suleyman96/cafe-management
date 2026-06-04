-- Rollback for 20260604000002_menu_item_options.sql
ALTER TABLE public.order_items DROP COLUMN IF EXISTS selected_options;
DROP TABLE IF EXISTS public.menu_item_option_values;
DROP TABLE IF EXISTS public.menu_item_options;
