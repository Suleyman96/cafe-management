# Manual Email Auth Enable - Local Supabase

## Problem
Email authentication provider shows as "Disabled" in Supabase Studio and can't be toggled.

## Solution: Enable via Supabase Management API

For local Supabase, email auth should work by default, but if it's disabled, you can enable it via the Management API.

### Option 1: Use Supabase CLI (Recommended)

```bash
# Check if Management API is available
supabase status

# Enable email provider via API
curl -X PUT 'http://127.0.0.1:54321/auth/v1/admin/settings' \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "EXTERNAL_EMAIL_ENABLED": true
  }'
```

### Option 2: Direct Database Update (Advanced)

If the above doesn't work, you can try updating the auth configuration directly:

```sql
-- Check auth configuration
SELECT * FROM auth.config;

-- Note: auth.config is managed by Supabase
-- Direct updates may not work, but you can check the structure
```

### Option 3: Restart with Fresh Config

Sometimes restarting Supabase with a clean config helps:

```bash
cd supabase
supabase stop
supabase db reset  # This will reset everything, use with caution
supabase start
```

### Option 4: Test if It Actually Works

Even if the UI shows "Disabled", email auth might still work. Test it:

1. Go to: http://localhost:3001/login
2. Use the test login component (I added it to the login page)
3. Try logging in with your credentials
4. If it works, the UI is just showing incorrect status

### Option 5: Use Magic Link Instead (Temporary Workaround)

If email/password doesn't work, we can implement magic link authentication as a workaround:

```typescript
// In login page, add magic link option
const { data, error } = await supabase.auth.signInWithOtp({
  email: email,
});
```

## Quick Test

I've added a test component to the login page. Try:

1. Go to: http://localhost:3001/login
2. Scroll down to see the "Test Email Auth" section
3. Enter your email and password
4. Click "Test Login"
5. See what error (if any) you get

This will help us understand if:
- Email auth is actually disabled
- There's a different error
- The credentials are wrong
- The user isn't linked to staff table

## Most Likely Solution

For **local Supabase**, email authentication is **enabled by default**. The "Disabled" button in the UI might be a display bug. 

**Try this:**
1. Just attempt to login at http://localhost:3001/login
2. Use: `hacilov@gmail.com` and your password
3. If you get "Email logins are disabled" error, then we need to enable it
4. If you get "Invalid credentials", then auth is working but credentials are wrong
5. If you get "Staff account not found", then you need to link the user to staff table

Let me know what error you get when trying to login!


