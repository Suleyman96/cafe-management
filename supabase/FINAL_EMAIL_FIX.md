# Final Fix: Enable Email Authentication

## The Real Problem

Supabase CLI hardcodes `GOTRUE_EXTERNAL_EMAIL_ENABLED=false` in local development. There's no config.toml option to change this.

## Solution: Modify Docker Container Directly

### Option 1: Use Supabase Management API (Recommended)

Run this script to enable email auth via the Management API:

```bash
# Get service role key
SERVICE_KEY=$(cd supabase && supabase status | grep "Secret" | awk '{print $3}')

# Enable email provider
curl -X PUT 'http://127.0.0.1:54321/auth/v1/admin/settings' \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"EXTERNAL_EMAIL_ENABLED": true}'
```

### Option 2: Modify GoTrue Container Environment

1. **Stop Supabase:**
   ```bash
   cd supabase
   supabase stop
   ```

2. **Find and edit docker-compose file:**
   ```bash
   # Find the compose file (usually in ~/.supabase or project directory)
   find ~/.supabase -name "docker-compose.yml" -o -name "*.yml" | grep supabase
   ```

3. **Edit the auth service** to add:
   ```yaml
   services:
     auth:
       environment:
         GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
   ```

4. **Start Supabase:**
   ```bash
   supabase start
   ```

### Option 3: Use Supabase Cloud (Easiest)

For development, you could use Supabase Cloud instead of local:
- Email auth is enabled by default
- Free tier is generous
- No configuration needed

### Option 4: Workaround - Use Admin API to Create Sessions

Instead of login, we can create sessions directly via Admin API:

```typescript
// In your login page, add an admin login option
const adminLogin = async () => {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'hacilov@gmail.com',
    password: 'test123456',
    email_confirm: true,
  });
  
  // Then sign in
  await supabase.auth.signInWithPassword({
    email: 'hacilov@gmail.com',
    password: 'test123456',
  });
};
```

But this requires service role key, which shouldn't be in frontend code.

## Recommended: Update Supabase CLI

The latest Supabase CLI might have better support. Try:

```bash
npm install -g supabase@latest
supabase stop
supabase start
```

## Temporary Workaround

For now, you can test the app by:
1. Creating users via Supabase Studio SQL Editor
2. Using the Admin API from a backend service
3. Switching to Supabase Cloud for development


