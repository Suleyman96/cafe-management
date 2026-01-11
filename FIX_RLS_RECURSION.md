# Fix: Infinite Recursion in Staff RLS Policy

## Problem
The error `"infinite recursion detected in policy for relation \"staff\""` occurs because the RLS policy tries to query the `staff` table to check if a user is an admin, but querying `staff` requires checking the policy, which queries `staff` again... infinite loop!

## Solution
Run this SQL in Supabase Studio to fix the recursion:

```sql
-- Fix infinite recursion in staff RLS policies
DROP POLICY IF EXISTS "Staff can view all staff" ON staff;
DROP POLICY IF EXISTS "Admins can manage staff" ON staff;

-- Allow users to read their own staff record first (breaks recursion)
CREATE POLICY "Users can view their own staff record"
  ON staff FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Then allow staff to view all staff
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

-- Admins can manage staff (now works because they can read their own record)
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
```

## How to Apply

1. Go to Supabase Studio: http://127.0.0.1:54323
2. Click **SQL Editor**
3. Copy and paste the SQL above
4. Click **Run**
5. Try logging in again

## Why This Works

The key is the first policy: `"Users can view their own staff record"`. This allows authenticated users to read their own record without needing to check other policies. Once they can read their own record, they can check their role, and then the other policies can work.

The recursion happened because:
- Old policy: "Check if user is admin by querying staff table"
- But querying staff table requires checking the policy
- Which queries staff table again... infinite loop!

New approach:
- First: "Users can always read their own record" (no recursion)
- Then: "If you can read your own record and you're staff, you can read all staff"
- Finally: "If you can read your own record and you're admin, you can manage staff"

This breaks the recursion because the first policy doesn't depend on other policies.


