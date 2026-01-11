# Simplest Way to Login - 3 Steps

## Step 1: Create User (30 seconds)

1. Open Supabase Studio: http://127.0.0.1:54323
2. Click **SQL Editor** (left sidebar)
3. Copy and paste this SQL:

```sql
-- Create user in auth.users (if not exists)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) 
SELECT 
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
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'hacilov@gmail.com'
);

-- Link to staff table
INSERT INTO staff (email, full_name, role, auth_user_id, is_active)
SELECT 
  'hacilov@gmail.com',
  'Test Admin',
  'admin',
  u.id,
  true
FROM auth.users u
WHERE u.email = 'hacilov@gmail.com'
ON CONFLICT (email) DO UPDATE 
  SET auth_user_id = EXCLUDED.auth_user_id,
      is_active = true;
```

4. Click **Run** (or press Cmd/Ctrl + Enter)
5. You should see "Success. No rows returned"

## Step 2: Add Service Role Key (if not already done)

1. Open `staff-web/.env.local` (create it if it doesn't exist)
2. Add this line:

```env
SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
```

3. Get the actual key from:
   ```bash
   cd supabase
   supabase status | grep Secret
   ```

## Step 3: Click Dev Login Button

1. Go to: http://localhost:3001/login
2. You'll see a yellow box at the bottom with a **"🚀 Dev Login"** button
3. Click it!
4. You'll be logged in automatically ✅

## That's It!

No email auth needed. No magic links. Just click the button.

---

## Troubleshooting

**"User not found" error?**
- Make sure you ran the SQL script in Step 1
- Check Supabase Studio → Authentication → Users to see if user exists

**"Staff account not found" error?**
- Make sure the SQL script linked the user to the staff table
- Check: `SELECT * FROM staff WHERE email = 'hacilov@gmail.com';`

**Button not showing?**
- Make sure you're in development mode (`npm run dev`)
- Check browser console for errors

**Still not working?**
- Check that Supabase is running: `cd supabase && supabase status`
- Restart Next.js: Stop and run `npm run dev` again


