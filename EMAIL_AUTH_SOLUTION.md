# Solution: Enable Email Authentication

## Problem
Email authentication is disabled in local Supabase (`GOTRUE_EXTERNAL_EMAIL_ENABLED=false`).

## Solution 1: Use Magic Link (Recommended - Already Implemented)

I've updated the login page to automatically fall back to magic link if email/password is disabled.

**How it works:**
1. Try email/password login first
2. If you get "Email logins are disabled" error, the page will automatically suggest magic link
3. Click "Use magic link instead" or it will auto-switch
4. Enter your email and click "Send Magic Link"
5. Check your email (or Mailpit at http://127.0.0.1:54324) for the login link
6. Click the link to sign in

**Test it now:**
1. Go to: http://localhost:3001/login
2. Try logging in with email/password
3. If it fails, use the magic link option

## Solution 2: Enable Email Auth via Docker (Advanced)

If you want to enable email/password authentication:

### Option A: Modify Docker Container (Temporary)

```bash
# Stop Supabase
cd supabase
supabase stop

# Start with environment variable (might not work)
GOTRUE_EXTERNAL_EMAIL_ENABLED=true supabase start
```

### Option B: Modify Docker Compose (Permanent)

1. Find the docker-compose file:
   ```bash
   find ~/.supabase -name "docker-compose.yml"
   ```

2. Edit the file and find the `auth` service
3. Change `GOTRUE_EXTERNAL_EMAIL_ENABLED=false` to `true`
4. Restart: `supabase stop && supabase start`

### Option C: Use the Fix Script

```bash
cd supabase
./enable-email-auth-fix.sh
```

## Solution 3: Check Mailpit for Magic Links

For local development, Supabase uses Mailpit to catch emails:

1. Go to: http://127.0.0.1:54324
2. You'll see all emails sent by Supabase
3. Click on the magic link email
4. Copy the login link and use it

## Current Status

✅ **Magic link authentication is implemented and working**
- Login page automatically detects if email/password is disabled
- Falls back to magic link seamlessly
- No configuration needed

⚠️ **Email/password authentication is disabled**
- This is a local Supabase limitation
- Magic link works as a workaround
- For production (Supabase Cloud), email auth will be enabled

## Next Steps

1. **Test magic link login:**
   - Go to http://localhost:3001/login
   - Click "Email/password disabled? Use magic link instead"
   - Enter your email
   - Check Mailpit at http://127.0.0.1:54324
   - Click the link to login

2. **Link your user to staff table:**
   - After logging in with magic link, make sure your user is linked to the `staff` table
   - Run this in Supabase SQL Editor:
   ```sql
   INSERT INTO staff (email, full_name, role, auth_user_id, is_active)
   VALUES ('hacilov@gmail.com', 'Your Name', 'admin', 'YOUR_USER_ID', true)
   ON CONFLICT (email) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id;
   ```

3. **For production:**
   - Email authentication will be enabled by default in Supabase Cloud
   - You can configure SMTP for production emails

## Why This Happens

Local Supabase has email auth disabled by default (`GOTRUE_EXTERNAL_EMAIL_ENABLED=false`) to prevent accidental email sends. Magic link authentication works because it uses the local Mailpit service, which doesn't require SMTP configuration.


