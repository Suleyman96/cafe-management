# Development Login Workaround

## Problem
Email authentication is disabled in local Supabase (`GOTRUE_EXTERNAL_EMAIL_ENABLED=false`), and there's no easy way to enable it via config.

## Solution: Direct Database User Creation

Since email auth is disabled, we've created a test user directly in the database. You can now login using:

- **Email**: `hacilov@gmail.com`
- **Password**: `test123456`

## How It Works

1. User is created directly in `auth.users` table
2. User is linked to `staff` table with `admin` role
3. Password is hashed using bcrypt (same as Supabase uses)
4. Email is marked as confirmed

## Login Steps

1. Go to: http://localhost:3001/login
2. Enter email: `hacilov@gmail.com`
3. Enter password: `test123456`
4. Click "Login"

**Note**: You might still see "Email logins are disabled" error. If so, we need to enable email auth in the GoTrue container.

## Alternative: Enable Email Auth Manually

If you want to enable email auth properly:

1. **Find Supabase's docker-compose file:**
   ```bash
   find ~/.supabase -name "docker-compose.yml"
   ```

2. **Edit the auth service** and add:
   ```yaml
   environment:
     GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
   ```

3. **Restart Supabase:**
   ```bash
   supabase stop
   supabase start
   ```

## For Production

In production (Supabase Cloud), email authentication is enabled by default. You won't need this workaround.


