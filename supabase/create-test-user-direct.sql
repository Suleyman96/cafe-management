-- Create a test user directly in auth.users table
-- This bypasses the need for email authentication during local development

-- First, check if user already exists
DO $$
DECLARE
  user_id UUID;
  user_email TEXT := 'hacilov@gmail.com';
  user_password TEXT := 'test123456';
BEGIN
  -- Check if user exists
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email;

  IF user_id IS NULL THEN
    -- Create new user
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      user_email,
      crypt(user_password, gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    ) RETURNING id INTO user_id;

    RAISE NOTICE 'Created new user with ID: %', user_id;
  ELSE
    RAISE NOTICE 'User already exists with ID: %', user_id;
  END IF;

  -- Link to staff table
  INSERT INTO staff (email, full_name, role, auth_user_id, is_active)
  VALUES (user_email, 'Test Admin', 'admin', user_id, true)
  ON CONFLICT (email) DO UPDATE 
    SET auth_user_id = EXCLUDED.auth_user_id,
        is_active = true;

  RAISE NOTICE 'User linked to staff table';
END $$;

-- Verify the user was created
SELECT 
  u.id as user_id,
  u.email,
  u.email_confirmed_at,
  s.id as staff_id,
  s.full_name,
  s.role
FROM auth.users u
LEFT JOIN staff s ON s.auth_user_id = u.id
WHERE u.email = 'hacilov@gmail.com';


