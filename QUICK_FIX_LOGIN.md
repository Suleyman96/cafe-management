# Quick Fix: Enable Login in Local Development

## The Problem

Email authentication is disabled in local Supabase (`GOTRUE_EXTERNAL_EMAIL_ENABLED=false`), and there's no easy way to enable it.

## Solution: Dev Login API Route

I've created a development-only API route that bypasses email authentication by using the Supabase Admin API.

### Setup

1. **Create `.env.local` file in `staff-web/` directory:**
   ```bash
   cd staff-web
   cp .env.local.example .env.local
   ```

2. **Get your service role key:**
   ```bash
   cd ../supabase
   supabase status | grep Secret
   ```

3. **Update `.env.local` with the service role key:**
   ```env
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_YOUR_KEY_HERE
   ```

4. **Restart the Next.js dev server:**
   ```bash
   cd ../staff-web
   npm run dev
   ```

### How It Works

1. When you try to login and get "Email logins are disabled" error
2. The login page automatically calls `/api/auth/dev-login`
3. This endpoint uses the Admin API to create/get the user
4. Then tries to sign in again with the regular method

### Test It

1. Go to: http://localhost:3001/login
2. Enter email: `hacilov@gmail.com`
3. Enter password: `test123456` (or any password)
4. Click "Login"
5. The dev login API will create the user if needed
6. Then you'll be signed in!

### Important Notes

- ⚠️ **This only works in development** (`NODE_ENV !== 'production'`)
- ⚠️ **Never commit `.env.local` to git** (it contains service role key)
- ⚠️ **For production**, use Supabase Cloud where email auth is enabled by default

### Alternative: Create User via SQL

If the dev login doesn't work, create the user directly:

1. Go to Supabase Studio: http://127.0.0.1:54323
2. SQL Editor → Run:
   ```sql
   -- This will be in create-test-user-direct.sql
   ```
3. Then try logging in

### Still Not Working?

1. Check browser console for errors
2. Check Next.js terminal for API errors
3. Verify `.env.local` has the service role key
4. Make sure Supabase is running: `supabase status`


