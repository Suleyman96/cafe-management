-- SIMPLEST SOLUTION: Create user and get ready to login
-- Run this in Supabase Studio SQL Editor

-- Step 1: Create user in auth.users (if not exists)
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
) 
SELECT 
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@test.com',
  crypt('test1234', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'admin@test.com'
)
RETURNING id;

-- Step 2: Link to staff table
INSERT INTO staff (email, full_name, role, auth_user_id, is_active)
SELECT 
  'admin@test.com',
  'Test Admin',
  'admin',
  u.id,
  true
FROM auth.users u
WHERE u.email = 'admin@test.com'
ON CONFLICT (email) DO UPDATE 
  SET auth_user_id = EXCLUDED.auth_user_id,
      is_active = true;

-- Step 3: Verify it worked
SELECT 
  u.id as user_id,
  u.email,
  s.id as staff_id,
  s.full_name,
  s.role
FROM auth.users u
LEFT JOIN staff s ON s.auth_user_id = u.id
WHERE u.email = 'admin@test.com';

