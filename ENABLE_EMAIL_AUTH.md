# Enable Email Authentication in Supabase

## Issue
Email logins are disabled by default in Supabase. You need to enable it via the Supabase Studio UI.

## Solution: Enable via Supabase Studio

1. **Open Supabase Studio:**
   - Go to: http://localhost:54323
   - Or run: `supabase status` and use the Studio URL

2. **Navigate to Authentication Settings:**
   - Click on **Authentication** in the left sidebar
   - Click on **Providers** (or **Settings**)

3. **Enable Email Provider:**
   - Find **Email** in the list of providers
   - Toggle it **ON** (enable it)
   - Make sure it's enabled for your project

4. **Configure Email Settings (Optional):**
   - **Enable sign up**: Keep this OFF (we only want admins to create accounts)
   - **Confirm email**: Keep this OFF for local testing (or ON for production)
   - **Secure email change**: Optional

5. **Save Changes**

## Alternative: Enable via SQL (if UI doesn't work)

If the UI doesn't work, you can try enabling it via SQL:

```sql
-- Check current auth settings
SELECT * FROM auth.config;

-- Note: Supabase manages auth providers differently
-- The email provider should be enabled by default
-- If not, you may need to use the Management API
```

## Verify It's Working

1. Try to login at: http://localhost:3001/login
2. If you see "Email logins are disabled" error, the provider isn't enabled yet
3. Check Supabase Studio > Authentication > Providers to confirm Email is ON

## For Production (Supabase Cloud)

When deploying to production:
1. Go to your Supabase project dashboard
2. Navigate to Authentication > Providers
3. Enable Email provider
4. Configure email templates if needed

## Troubleshooting

If email auth still doesn't work after enabling:

1. **Check Supabase logs:**
   ```bash
   supabase logs
   ```

2. **Verify auth is enabled:**
   ```bash
   supabase status
   ```
   Should show auth service as running

3. **Restart Supabase:**
   ```bash
   supabase stop
   supabase start
   ```

4. **Check if users can be created:**
   - Try creating a user via Supabase Studio > Authentication > Users
   - If that works, email auth is enabled


