-- Enable Email Authentication Provider
-- Run this in Supabase SQL Editor

-- Check current auth configuration
SELECT * FROM auth.config;

-- Note: For local Supabase, email auth should be enabled by default
-- If it's not working, try these steps:

-- 1. Check if auth.users table exists and is accessible
SELECT COUNT(*) FROM auth.users;

-- 2. Verify the user exists
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'hacilov@gmail.com';

-- 3. If email auth is truly disabled, you may need to:
--    - Restart Supabase: supabase stop && supabase start
--    - Or use the Management API to enable it
--    - Or check Supabase Studio > Authentication > Providers

-- Alternative: Use Supabase Management API
-- You can enable providers via the Management API if you have access


