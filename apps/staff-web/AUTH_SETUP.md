# Authentication Setup Guide

## Overview

The staff web app now has full authentication implemented:
- Login page at `/login`
- Protected routes (require authentication)
- Role-based access control
- Session management with Supabase Auth

## How It Works

1. **Login Flow:**
   - Staff enter email/password on `/login`
   - Supabase Auth validates credentials
   - System fetches staff record from database
   - Session is stored and staff data is cached

2. **Protected Routes:**
   - All routes under `(staff)` are protected
   - Unauthenticated users are redirected to `/login`
   - Role-based access can be enforced per route

3. **Session Management:**
   - Sessions persist across page refreshes
   - Auto-refresh tokens
   - Logout clears session and redirects to login

## Creating Test Staff Accounts

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to Supabase Studio: http://localhost:54323
2. Navigate to **Authentication** > **Users**
3. Click **Add User** or **Invite User**
4. Enter:
   - Email: `waiter@test.com`
   - Password: `test123456`
   - Auto Confirm: ✅ (for local testing)
5. Copy the **User ID** (UUID)

6. Go to **SQL Editor** and run:
```sql
INSERT INTO staff (email, full_name, role, auth_user_id, is_active)
VALUES 
  ('waiter@test.com', 'Test Waiter', 'waiter', 'PASTE_USER_ID_HERE', true);
```

7. Repeat for admin:
   - Email: `admin@test.com`
   - Password: `test123456`
   - Role: `admin`

### Option 2: Via SQL (Manual Auth User Creation)

If you need to create users programmatically, use the Supabase Management API or create them via the dashboard first, then link staff records.

## Test Credentials

After setup, you can use:

**Waiter:**
- Email: `waiter@test.com`
- Password: `test123456`

**Admin:**
- Email: `admin@test.com`
- Password: `test123456`

## Routes

- `/login` - Login page (public)
- `/` - Home/Dashboard (protected)
- `/feedback` - Customer feedback (protected)
- All other routes under `(staff)` are protected

## Components Created

1. **`/app/login/page.tsx`** - Login form
2. **`/hooks/use-auth.ts`** - Auth hook with session management
3. **`/components/auth/protected-route.tsx`** - Route protection wrapper
4. **`/components/providers.tsx`** - Auth provider for app initialization

## Next Steps

1. Create test staff accounts (see above)
2. Test login flow
3. Verify protected routes redirect to login when not authenticated
4. Test logout functionality

## For Mobile App

The same authentication system can be used in the React Native mobile app:
- Use the same `use-auth.ts` hook (may need minor adjustments)
- Use Supabase Auth SDK for React Native
- Same protected route pattern


