# Phase 12B: Security — JWT Claims Safety, listUsers Replacement, Rate Limit Fix

## Goal

Fix three structural security concerns:
1. `getStaffClaims` can be called without prior token verification — make the safe-only usage structurally enforced
2. `listUsers({ perPage: 1000 })` does a linear scan of all auth users — replace with a filtered lookup
3. Rate limiter falls back to shared `'unknown'` bucket when IP headers are missing

## Important

- Read each file fully before editing
- These are security-sensitive changes — verify behavior carefully
- Run `pnpm type-check && pnpm test` after each step

---

## Step 1: Make `getStaffClaims` Safe by Design

**File:** `apps/staff-web/src/lib/api/jwt-claims.ts`

Currently `getStaffClaims` decodes the JWT payload by base64-splitting without signature verification:
```typescript
const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
```

This is currently safe because ALL callers (`verifyStaff`, `verifyAdmin`) call `supabaseAdmin.auth.getUser(token)` first. But the function is exported and could be called unsafely in the future.

### Fix: Accept pre-verified user object instead of raw token

Read `apps/staff-web/src/lib/api/verify-staff.ts` and `verify-admin.ts` to see how `getStaffClaims` is called.

In `verify-staff.ts` (~lines 18-29):
```typescript
const supabaseAdmin = getSupabaseAdmin();
const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
if (error || !user) { ... }
const claims = getStaffClaims(token);
```

The `getUser()` call already returns the user object which contains `app_metadata` and `user_metadata`. Supabase stores custom JWT claims in `user.app_metadata`. Refactor to extract claims from the verified user object instead of re-decoding the raw token:

**File:** `apps/staff-web/src/lib/api/jwt-claims.ts`

Change the function signature:

```typescript
import type { User } from '@supabase/supabase-js';

export interface StaffClaims {
  staff_id: string;
  tenant_id: string;
  user_role: string;
  is_active_staff: boolean;
}

/**
 * Extract staff claims from a Supabase-verified user object.
 * MUST only be called with a user returned by supabaseAdmin.auth.getUser().
 */
export function getStaffClaims(user: User): StaffClaims | null {
  const metadata = user.app_metadata;
  if (!metadata?.is_active_staff) return null;
  return {
    staff_id: metadata.staff_id,
    tenant_id: metadata.tenant_id,
    user_role: metadata.user_role,
    is_active_staff: metadata.is_active_staff,
  };
}
```

Read the current function and the actual JWT payload structure to confirm claims are in `app_metadata`. If they're in `user_metadata` or in the raw JWT payload but NOT in the User object, then keep the base64 decode but make the function accept the token + the verified user:

```typescript
/**
 * Extract staff claims from a verified JWT token.
 * @param token - The access token, MUST have been verified by auth.getUser() first
 * @internal Only call from verifyStaff/verifyAdmin after token verification
 */
export function getStaffClaims(token: string): StaffClaims | null {
```

At minimum, add the JSDoc comment making the precondition explicit, and mark with `@internal`.

### Update callers

**File:** `apps/staff-web/src/lib/api/verify-staff.ts`

If you changed to accept `User`:
```typescript
const claims = getStaffClaims(user);  // instead of getStaffClaims(token)
```

**File:** `apps/staff-web/src/lib/api/verify-admin.ts`

Same change.

### Fix middleware JWT decode

**File:** `apps/staff-web/src/middleware.ts`

Find the manual JWT decode (~lines 100-108):
```typescript
const payload = JSON.parse(
  Buffer.from(session.access_token.split('.')[1], 'base64').toString(),
);
isActiveStaff = payload.is_active_staff === true;
```

This is in the middleware where `getUser()` is already called at line 58. Read how `user` is available at this point. If the verified `user` object is accessible, replace the manual decode:

```typescript
isActiveStaff = user?.app_metadata?.is_active_staff === true;
```

If `app_metadata` doesn't contain the claims (they might only be in the JWT payload, not in the user object), then keep the manual decode but add a comment:

```typescript
// Safe: token was verified by auth.getUser() at line 58 above.
// Claims are extracted from the verified token's payload (not in app_metadata).
```

---

## Step 2: Replace `listUsers` with Filtered Lookup

**File:** `apps/staff-web/src/app/api/staff/route.ts`

Find the error-recovery path (~lines 60-67):
```typescript
if (authError.message?.includes('already been registered') || authError.status === 422) {
  const { data: listData } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
  });
  const found = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
```

This loads up to 1000 users and does a linear search by email. It will silently break when there are >1000 users.

### Fix Option A: Use Supabase admin `listUsers` with email filter

Check the Supabase JS SDK docs / types for filtering support. The admin API may support:
```typescript
const { data } = await supabaseAdmin.auth.admin.listUsers({
  perPage: 1,
  filter: `email.eq.${email}`,
});
```

Read the Supabase SDK types for `auth.admin.listUsers` to check if a `filter` parameter exists.

### Fix Option B: Query the auth.users table directly

If the SDK doesn't support filtering, use a raw query on the `auth.users` table via the service role client:

```typescript
const { data: authUsers, error: lookupError } = await supabaseAdmin
  .from('auth.users')
  .select('id, email')
  .eq('email', email.toLowerCase())
  .limit(1)
  .single();
```

Note: Supabase may not expose `auth.users` through the PostgREST API. Check if this works.

### Fix Option C: Use getUserById after createUser returns the ID

Read the full error handling. When `createUser` returns a 422, the error response might contain the existing user's ID. If so:

```typescript
if (authError.message?.includes('already been registered')) {
  // Supabase returns the existing user ID in certain error cases
  // Extract it and use getUserById instead of listing all users
}
```

### Fix Option D (simplest, most reliable): Catch and parse the error

Check if the Supabase `createUser` error for "already registered" includes the existing user's `id` in the error body. Read the Supabase Auth source or test it. If not, the simplest reliable fix is:

```typescript
// Instead of listing all users, use the email directly
const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
  perPage: 1,
  page: 1,
});
// Filter server-side is not supported — use a different approach
```

If none of the above work cleanly, the pragmatic fix is to increase `perPage` is not an option (1000 is already the max). Instead, **paginate**:

```typescript
async function findUserByEmail(supabaseAdmin: SupabaseClient, email: string) {
  let page = 1;
  const perPage = 100;
  while (true) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (!data?.users?.length) return null;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < perPage) return null; // Last page
    page++;
  }
}
```

Choose the simplest option that works. Read the Supabase SDK types and test.

---

## Step 3: Fix Rate Limiter `'unknown'` Fallback

**File:** `apps/staff-web/src/lib/api/rate-limit.ts`

Find `getRateLimitIdentifier` (~lines 51-68):
```typescript
export function getRateLimitIdentifier(request: Request): string {
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map((s) => s.trim()).filter(Boolean);
    return ips[ips.length - 1] || 'unknown';
  }

  return 'unknown';
}
```

When no IP headers exist, ALL requests share one rate limit bucket. One user can exhaust the limit for everyone.

### Fix: Use a more unique fallback

Read the full file to see how the identifier is used (it's passed to Upstash's `.limit(identifier)`).

Replace the fallback with something request-specific:

```typescript
export function getRateLimitIdentifier(request: Request): string {
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map((s) => s.trim()).filter(Boolean);
    if (ips.length > 0) return ips[ips.length - 1];
  }

  // Fallback: use Authorization header hash to isolate per-session
  // This prevents one anonymous client from exhausting the limit for all
  const auth = request.headers.get('authorization');
  if (auth) {
    // Use a simple hash of the bearer token as identifier
    // This gives each authenticated session its own rate limit bucket
    let hash = 0;
    for (let i = 0; i < auth.length; i++) {
      hash = ((hash << 5) - hash + auth.charCodeAt(i)) | 0;
    }
    return `session:${hash}`;
  }

  // True unknown — unauthenticated request with no IP headers
  // Apply a stricter global limit for these
  return 'unknown';
}
```

Alternatively, a simpler approach — just use a stricter rate limit for the `'unknown'` bucket. Read how the rate limiter is configured (e.g., the `Ratelimit` instance) and check if per-identifier limits can be varied. If not, the hash approach above is better.

If the project runs exclusively on Vercel (which always sets `x-real-ip`), add a comment noting the fallback is only for non-Vercel environments and consider logging when it's hit:

```typescript
// Vercel always sets x-real-ip. This fallback is for local dev / non-Vercel hosting.
return 'unknown';
```

---

## Step 4: Fix Plan Gate Default State

**File:** `apps/customer-web/src/components/table/table-landing.tsx`

Find the plan state initialization (~line 43):
```typescript
const [tenantPlan, setTenantPlan] = useState<string | null>(null);
```

And the conditional (~line 355):
```typescript
{tenantPlan === 'free' ? (
  // QR ordering not available
) : (
  // Show Browse Menu button
)}
```

When `tenantPlan` is `null` (not yet loaded), the `else` branch renders — free-tier users briefly see the "Browse Menu" button until the RPC resolves.

Fix: treat `null` (unloaded) the same as loading — don't show the button until plan is confirmed:

```typescript
{tenantPlan && tenantPlan !== 'free' ? (
  // Show Browse Menu button
) : tenantPlan === 'free' ? (
  // QR ordering not available message
) : null  // null = still loading, show nothing or a skeleton
}
```

Or simpler — just block when plan is not yet confirmed:

```typescript
{tenantPlan === null ? (
  // Loading state — show skeleton or nothing
  <div className="h-12" /> 
) : tenantPlan === 'free' ? (
  // QR ordering not available
  <div>...</div>
) : (
  // Show Browse Menu button
  <button ...>...</button>
)}
```

This ensures the "Browse Menu" button only renders once the plan is confirmed as non-free.

---

## Step 5: Fix Mobile Empty Bearer Token

**File:** `apps/mobile/src/lib/api-routes.ts`

Find `getAuthHeaders` (~lines 10-19):
```typescript
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
  };
}
```

When session is null, sends `Authorization: Bearer ` (empty token). The server rejects it, but it's poor practice.

Fix: throw early when no session exists, since all API routes require authentication:

```typescript
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('No active session — please log in');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}
```

Read how `apiFetch` handles errors thrown by `getAuthHeaders`. If it catches and displays them, the user will see "No active session." If it doesn't catch, you may need to add a try/catch in `apiFetch` to handle the auth error gracefully (e.g., redirect to login).

---

## Step 6: Add `.env.example` for Mobile

**File:** Create `apps/mobile/.env.example`

```bash
# Required for all environments
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_API_BASE_URL=http://localhost:3001

# Required for production (EAS builds)
# Set via: eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value https://your-project.supabase.co
```

Then in `apps/mobile/app.config.ts`, add a comment near the fallback constants (~lines 4-7):

```typescript
// Local development fallback only — see .env.example for required env vars.
// Production builds enforce env vars via the isProduction guard below.
```

---

## Final Verification

```bash
pnpm type-check
pnpm test
pnpm check
```

## Commit

Commit with message: `security: harden JWT claims extraction, replace listUsers scan, fix rate limit fallback`
