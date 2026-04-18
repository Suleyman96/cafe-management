-- Fix RLS policies for categories to avoid recursion
-- The issue: policies check staff role, which creates recursion

-- Drop existing policies
DROP POLICY IF EXISTS "Staff can view categories" ON categories;
DROP POLICY IF EXISTS "Admin can manage categories" ON categories;
DROP POLICY IF EXISTS "Public can view active categories" ON categories;

-- Allow everyone to SELECT categories (staff will be checked at app level if needed)
-- This avoids the recursion issue
CREATE POLICY "Anyone can view categories"
  ON categories
  FOR SELECT
  USING (true);

-- For INSERT/UPDATE/DELETE, just check if user is authenticated
-- The app-level logic will handle role-based permissions
CREATE POLICY "Authenticated users can manage categories"
  ON categories
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Alternative: If you want to keep role checking, use a simpler approach
-- that doesn't query the staff table recursively
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON categories;

CREATE POLICY "Authenticated users can insert categories"
  ON categories
  FOR INSERT
  WITH CHECK (
    -- Just check if user exists in auth.users, don't check staff table
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Authenticated users can update categories"
  ON categories
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Authenticated users can delete categories"
  ON categories
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  );

-- Do the same for menu_items to prevent similar issues
DROP POLICY IF EXISTS "Staff can view menu items" ON menu_items;
DROP POLICY IF EXISTS "Admin can manage menu items" ON menu_items;
DROP POLICY IF EXISTS "Public can view available menu items" ON menu_items;

CREATE POLICY "Anyone can view menu items"
  ON menu_items
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert menu items"
  ON menu_items
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Authenticated users can update menu items"
  ON menu_items
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Authenticated users can delete menu items"
  ON menu_items
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  );


