-- Fix: Restore public SELECT policies for menu_items and categories
-- These were dropped in 20260228000006 but never recreated,
-- breaking customer-web (anonymous access) menu display.

CREATE POLICY "Anyone can view categories"
  ON public.categories FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view menu_items"
  ON public.menu_items FOR SELECT
  USING (true);
