-- Script to create test staff accounts
-- Run this in Supabase SQL Editor after setting up auth

-- First, create auth users (you'll need to do this via Supabase Auth UI or API)
-- Then link them to staff records

-- Example: Create a test waiter
-- 1. Create auth user via Supabase Dashboard > Authentication > Users > Add User
--    Email: waiter@test.com
--    Password: test123456
--    Copy the user ID

-- 2. Then run this SQL (replace USER_ID with the actual auth user ID):
/*
INSERT INTO staff (email, full_name, role, auth_user_id, is_active)
VALUES 
  ('waiter@test.com', 'Test Waiter', 'waiter', 'USER_ID_HERE', true);
*/

-- Example: Create a test admin
-- 1. Create auth user: admin@test.com / test123456
-- 2. Run:
/*
INSERT INTO staff (email, full_name, role, auth_user_id, is_active)
VALUES 
  ('admin@test.com', 'Test Admin', 'admin', 'ADMIN_USER_ID_HERE', true);
*/

-- Quick helper function to create staff with auth
-- Note: This requires the auth.users table, which Supabase manages
-- You can't directly insert into auth.users via SQL for security reasons

-- Alternative: Use Supabase Management API or Dashboard to create users
-- Then link them using the SQL above


