-- Allow staff to view all menu items and categories for management
-- (Not just available/active ones)

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view available menu items" ON menu_items;
DROP POLICY IF EXISTS "Admins can manage menu items" ON menu_items;
DROP POLICY IF EXISTS "Anyone can view active categories" ON categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;

-- Allow anyone to view all menu items (for staff management)
CREATE POLICY "Anyone can view all menu items"
  ON menu_items FOR SELECT
  USING (true);

-- Allow anyone to manage menu items (for development - no auth required)
CREATE POLICY "Anyone can manage menu items"
  ON menu_items FOR ALL
  USING (true);

-- Allow anyone to view all categories (for staff management)
CREATE POLICY "Anyone can view all categories"
  ON categories FOR SELECT
  USING (true);

-- Allow anyone to manage categories (for development - no auth required)
CREATE POLICY "Anyone can manage categories"
  ON categories FOR ALL
  USING (true);


