# Simple Solution: Create User via SQL

Since email authentication is disabled in local Supabase and there's no easy way to enable it, the simplest solution is to create users directly in the database.

## Step 1: Create User via SQL

1. Go to Supabase Studio: http://127.0.0.1:54323
2. Click **SQL Editor**
3. Run this SQL:

```sql
-- Create user in auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'hacilov@gmail.com',
  crypt('test123456', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING
RETURNING id;
```

4. **Copy the returned user ID**

5. **Link to staff table:**
```sql
-- Replace USER_ID_HERE with the ID from above
INSERT INTO staff (email, full_name, role, auth_user_id, is_active)
VALUES (
  'hacilov@gmail.com',
  'Test Admin',
  'admin',
  'USER_ID_HERE',  -- Paste the user ID here
  true
)
ON CONFLICT (email) DO UPDATE 
  SET auth_user_id = EXCLUDED.auth_user_id;
```

## Step 2: Use Admin API to Create Session

Since email/password login is disabled, we need to use the Admin API to create a session.

I've created a dev login API route that does this. But there's an even simpler way:

### Option A: Use Supabase Studio to Generate Token

1. Go to Supabase Studio
2. Authentication → Users
3. Find your user
4. Click "..." → "Generate token" (if available)

### Option B: Use the Dev Login API

The dev login API I created will try to work around this, but it may still fail because GoTrue rejects password logins when email is disabled.

## Step 3: The Real Solution

**For local development, the best approach is:**

1. **Use Supabase Cloud** (free tier) instead of local
   - Email auth is enabled by default
   - No configuration needed
   - Just update your `.env.local` with cloud credentials

2. **Or wait for Supabase CLI update** that allows enabling email auth via config

3. **Or manually edit docker-compose** (complex, but works)

## Quick Test

Try this in your browser console on the login page:

```javascript
// This uses the service role key (only in dev!)
fetch('/api/auth/dev-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'hacilov@gmail.com',
    password: 'test123456'
  })
}).then(r => r.json()).then(console.log);
```

If this works, the dev login API is functioning. If not, we need to use a different approach.


