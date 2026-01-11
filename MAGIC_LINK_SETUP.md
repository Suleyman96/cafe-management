# Magic Link Authentication Setup

## ✅ What's Been Implemented

1. **Login Page** - Automatically detects if email/password is disabled and offers magic link
2. **Auth Callback Page** - Handles the magic link redirect and completes authentication
3. **Supabase Config** - Added callback URL to allowed redirect URLs

## 🧪 How to Test

### Step 1: Click "Send Magic Link"

1. Go to: http://localhost:3001/login
2. You should see "Email logins are disabled" message
3. The form should show only email field and "Send Magic Link" button
4. Enter your email: `hacilov@gmail.com`
5. Click "Send Magic Link"

### Step 2: Check Mailpit

1. Open Mailpit: http://127.0.0.1:54324
2. You should see a new email from Supabase
3. The email will contain a "Confirm your signup" or "Sign in" link
4. Click the link (or copy it)

### Step 3: Complete Authentication

1. The link will redirect to: `http://localhost:3001/auth/callback#access_token=...`
2. The callback page will:
   - Extract the access token from the URL hash
   - Set the session in Supabase
   - Fetch your staff record from the database
   - Redirect you to the home page (`/`)

### Step 4: Link Your User to Staff Table

**Important:** Before the magic link will work, you need to link your auth user to the `staff` table:

1. Go to Supabase Studio: http://127.0.0.1:54323
2. Go to SQL Editor
3. Run this (replace with your actual user ID from auth.users):
```sql
INSERT INTO staff (email, full_name, role, auth_user_id, is_active)
VALUES ('hacilov@gmail.com', 'Your Name', 'admin', 'c13cdce4-2d58-4ef6-8b4c-77ab3e5610de', true)
ON CONFLICT (email) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id;
```

## 🔧 Troubleshooting

### No Email in Mailpit

- Check that Supabase is running: `supabase status`
- Check browser console for errors
- Verify email address is correct
- Try refreshing Mailpit

### "Staff account not found" Error

- Make sure you've linked your auth user to the `staff` table (see Step 4 above)
- Check that `is_active = true` in the staff record
- Verify the `auth_user_id` matches your auth user ID

### Callback Page Shows Error

- Check browser console for detailed error
- Verify Supabase is running
- Check that callback URL is in allowed redirect URLs in `supabase/config.toml`
- Restart Supabase: `supabase stop && supabase start`

### Magic Link Expired

- Magic links expire after a certain time (usually 1 hour)
- Request a new magic link from the login page

## 📝 Notes

- **Local Development**: Magic links work without SMTP configuration because Supabase uses Mailpit
- **Production**: You'll need to configure SMTP in Supabase Cloud dashboard
- **Security**: Magic links are single-use and expire after a set time
- **Session**: After successful authentication, the session is stored in browser localStorage

## 🚀 Next Steps

1. Test the magic link flow end-to-end
2. Link your user to the staff table
3. Verify you can access protected routes after login
4. Test logout functionality


