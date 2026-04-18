-- Fix missing INSERT/UPDATE/DELETE RLS policies for menu_items.
-- These were dropped in 20260228000006 but never recreated.

DROP POLICY IF EXISTS "Admins can insert menu items" ON menu_items;
CREATE POLICY "Admins can insert menu items"
  ON menu_items FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_staff_role() IN ('admin', 'owner'));

DROP POLICY IF EXISTS "Admins can update menu items" ON menu_items;
CREATE POLICY "Admins can update menu items"
  ON menu_items FOR UPDATE
  TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

DROP POLICY IF EXISTS "Admins can delete menu items" ON menu_items;
CREATE POLICY "Admins can delete menu items"
  ON menu_items FOR DELETE
  TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));
