-- Fix infinite recursion in staff RLS policies
-- The issue: policies that check staff table while querying staff table

-- Drop the problematic policies
DROP POLICY IF EXISTS "Staff can view all staff" ON staff;
DROP POLICY IF EXISTS "Admins can manage staff" ON staff;

-- New approach: Allow users to read their own staff record first
-- This breaks the recursion because they can check their own role
CREATE POLICY "Users can view their own staff record"
  ON staff FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Then allow staff to view all staff (this works because they can already see their own)
CREATE POLICY "Staff can view all staff"
  ON staff FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.auth_user_id = auth.uid()
      AND s.is_active = true
    )
  );

-- Admins can manage staff (now this works because they can read their own record first)
CREATE POLICY "Admins can manage staff"
  ON staff FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.auth_user_id = auth.uid()
      AND s.role = 'admin'
      AND s.is_active = true
    )
  );


