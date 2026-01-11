# Quick Fix: Enable Email Authentication

## Problem
Email provider shows as "Disabled" in Supabase Studio, preventing email/password logins.

## Solution

### Option 1: Enable via Supabase Studio UI

1. **In the User Details Panel (Right Sidebar):**
   - Click the **"Disabled"** button next to Email provider
   - It should change to "Enabled"

2. **OR Go to Authentication > Providers:**
   - Click **Authentication** in left sidebar
   - Click **Providers** (under CONFIGURATION)
   - Find **Email** provider
   - Toggle it **ON**

### Option 2: Enable via SQL (if UI doesn't work)

Run this in Supabase SQL Editor:

```sql
-- Enable email provider (if supported by your Supabase version)
-- Note: This might not work in all versions, use UI method if possible

-- Check auth configuration
SELECT * FROM auth.config;
```

### Option 3: Use Supabase Management API

If you have access to the Management API, you can enable it programmatically, but for local development, the UI method is easiest.

## After Enabling

1. **Test Login:**
   - Go to: http://localhost:3001/login
   - Use: `hacilov@gmail.com` and your password
   - Should work now!

2. **Link User to Staff Table:**
   - Copy the User UID: `c13cdce4-2d58-4ef6-8b4c-77ab3e5610de`
   - Go to SQL Editor
   - Run:
   ```sql
   INSERT INTO staff (email, full_name, role, auth_user_id, is_active)
   VALUES ('hacilov@gmail.com', 'Your Name', 'admin', 'c13cdce4-2d58-4ef6-8b4c-77ab3e5610de', true)
   ON CONFLICT (email) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id;
   ```

## Note

For local Supabase, email authentication should work once the provider is enabled. The "Disabled" button in the user details panel should toggle it on/off for that specific provider.


