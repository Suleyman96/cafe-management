-- Disable RLS for development (no auth required)
-- This allows the app to work without authentication

-- Drop all existing policies
DROP POLICY IF EXISTS "Staff can view categories" ON categories;
DROP POLICY IF EXISTS "Admin can manage categories" ON categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
DROP POLICY IF EXISTS "Public can view active categories" ON categories;
DROP POLICY IF EXISTS "Anyone can view active categories" ON categories;
DROP POLICY IF EXISTS "Anyone can view categories" ON categories;
DROP POLICY IF EXISTS "Anyone can view all categories" ON categories;
DROP POLICY IF EXISTS "Anyone can manage categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can insert categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON categories;

DROP POLICY IF EXISTS "Staff can view menu items" ON menu_items;
DROP POLICY IF EXISTS "Admin can manage menu items" ON menu_items;
DROP POLICY IF EXISTS "Admins can manage menu items" ON menu_items;
DROP POLICY IF EXISTS "Public can view available menu items" ON menu_items;
DROP POLICY IF EXISTS "Anyone can view available menu items" ON menu_items;
DROP POLICY IF EXISTS "Anyone can view menu items" ON menu_items;
DROP POLICY IF EXISTS "Anyone can view all menu items" ON menu_items;
DROP POLICY IF EXISTS "Anyone can manage menu items" ON menu_items;
DROP POLICY IF EXISTS "Authenticated users can insert menu items" ON menu_items;
DROP POLICY IF EXISTS "Authenticated users can update menu items" ON menu_items;
DROP POLICY IF EXISTS "Authenticated users can delete menu items" ON menu_items;

-- Disable RLS entirely for development
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items DISABLE ROW LEVEL SECURITY;

-- Also disable for customer_feedback if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'customer_feedback') THEN
        ALTER TABLE customer_feedback DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

COMMENT ON TABLE categories IS 'RLS disabled for development - enable in production';
COMMENT ON TABLE menu_items IS 'RLS disabled for development - enable in production';


