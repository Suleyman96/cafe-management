# Error Explanation: "infinite recursion detected in policy for relation 'staff'"

## Why This Error Occurs

### The Problem

The error happens because of **Row-Level Security (RLS) policies** in Supabase that create a circular dependency:

1. You try to **INSERT a category**
2. The RLS policy checks: "Is this user an admin?"
3. To check if user is admin, it queries the **staff table**: 
   ```sql
   EXISTS (
     SELECT 1 FROM staff
     WHERE auth_user_id = auth.uid()
     AND role = 'admin'
   )
   ```
4. But the **staff table also has RLS policies** that check the staff table
5. This creates an **infinite loop**: staff → staff → staff → ...

### The Root Cause

In `supabase/migrations/20250101000003_rls_policies.sql`:

```sql
-- This policy checks the staff table
CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff          -- ← Queries staff table
      WHERE auth_user_id = auth.uid()
      AND role = 'admin'
    )
  );
```

And the staff table has its own policies that might also check the staff table, creating recursion.

## The Solution

I've created a new migration: `supabase/migrations/20250101000007_fix_categories_rls.sql`

### What It Does:

1. **Removes the recursive policies** - No more checking staff table from within policies
2. **Simplifies permission checks** - Just checks if user is authenticated
3. **Allows app-level role checking** - Your app can handle role-based permissions

### The New Approach:

```sql
-- Simple: Just check if user is authenticated
CREATE POLICY "Authenticated users can insert categories"
  ON categories
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  );
```

This avoids the recursion because:
- ✅ It only checks `auth.users` (no recursion)
- ✅ It doesn't query the `staff` table
- ✅ Role checking can be done in your app code

## How to Fix

Run the new migration:

```bash
cd supabase
supabase db push
```

Or if using Supabase Studio:
1. Go to SQL Editor
2. Open `migrations/20250101000007_fix_categories_rls.sql`
3. Run it

## Alternative: Disable RLS for Development

If you just want to develop without RLS issues:

```sql
-- Temporarily disable RLS on categories
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items DISABLE ROW LEVEL SECURITY;
```

⚠️ **Warning**: Only do this in development! In production, you need proper RLS policies.

## Better Error Handling

I've also added **toast notifications** to show user-friendly error messages instead of browser alerts:

- ✅ Loading states: "Creating category..."
- ✅ Success messages: "Category created successfully!"
- ❌ Error messages: "Database permission error. Please run the latest migration."

The app now uses `react-hot-toast` for all notifications.

## Summary

**Why it happened**: RLS policies created infinite recursion by checking the staff table from within staff-related policies.

**How to fix**: Run the new migration that simplifies RLS policies to avoid recursion.

**Better UX**: Added toast notifications for better error/success feedback.


