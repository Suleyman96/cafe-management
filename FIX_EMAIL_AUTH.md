# Fix: Email Authentication Disabled

## Problem
Email authentication provider is disabled in local Supabase and can't be enabled via UI.

## Solution: Enable via Supabase Studio (Alternative Method)

Since the UI button doesn't work, try this:

### Step 1: Access GoTrue Service Directly

1. **Check if GoTrue service is running:**
   ```bash
   docker ps | grep gotrue
   ```

2. **Access GoTrue container:**
   ```bash
   docker exec -it supabase_auth_cafe-idare sh
   ```

3. **Check environment variables:**
   ```bash
   env | grep EMAIL
   ```

### Step 2: Enable via Environment Variable

If you can access the container, you might be able to set:
```bash
export GOTRUE_EXTERNAL_EMAIL_ENABLED=true
```

But this won't persist after restart.

### Step 3: Modify Docker Compose (Permanent Fix)

1. **Find Supabase docker-compose file:**
   ```bash
   supabase status
   # Note the docker container names
   ```

2. **Or check if there's a way to pass env vars:**
   - Supabase CLI might have a way to set auth env vars
   - Check: `supabase --help`

### Step 4: Workaround - Use Magic Link Instead

If email/password doesn't work, we can temporarily use magic link:

```typescript
// In login page
const { data, error } = await supabase.auth.signInWithOtp({
  email: email,
  options: {
    emailRedirectTo: 'http://localhost:3001',
  }
});
```

### Step 5: Check Supabase Version

Some versions of local Supabase have email auth disabled by default. Check:

```bash
supabase --version
```

If it's an older version, update:
```bash
npm install -g supabase@latest
supabase stop
supabase start
```

## Quick Test

I've added a test component to the login page. Try:

1. Go to: http://localhost:3001/login
2. Scroll to "Test Email Auth" section
3. Enter credentials and test
4. This will show the exact error

## Most Likely Solution

For **local Supabase**, email authentication **should be enabled by default**. If it's not:

1. **Try restarting Supabase:**
   ```bash
   supabase stop
   supabase start
   ```

2. **Check Supabase Studio again** - the provider might enable after restart

3. **If still disabled**, it might be a bug in your Supabase CLI version. Try:
   ```bash
   npm install -g supabase@latest
   supabase stop
   supabase start
   ```

4. **Last resort**: Use magic link authentication as a workaround until email auth can be enabled.

Let me know what the test component shows when you try to login!


