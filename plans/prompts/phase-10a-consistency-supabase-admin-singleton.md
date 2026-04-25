# Phase 10A: Consistency — Singleton Supabase Admin Client

## Goal

`getSupabaseAdmin()` creates a new `createClient(...)` on every call. Routes that call `verifyAdmin()` + their own `getSupabaseAdmin()` create 2+ client instances per request. Fix by making it a module-level singleton.

## Important

- Read the file before editing
- Run `pnpm type-check && pnpm test` after changes
- This is a staff-web API-only change — no frontend code affected

---

## Step 1: Make `getSupabaseAdmin` Return a Singleton

**File:** `apps/staff-web/src/lib/api/verify-admin.ts`

Read the file. Find the `getSupabaseAdmin` function (~lines 1-16):

```typescript
import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
```

Replace with a module-level singleton:

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }
  return _supabaseAdmin;
}
```

This is safe because:
- The admin client is stateless (no session persistence, no auto-refresh)
- Environment variables don't change at runtime
- Module-level singletons are shared within a single Node.js process (Next.js API routes run in the same process)

---

## Step 2: Reduce Redundant Calls in `staff/route.ts`

**File:** `apps/staff-web/src/app/api/staff/route.ts`

Read the file. It calls `getSupabaseAdmin()` up to 5 times in a single POST handler. Store the result once at the top of each handler:

Find the POST handler. At the top (after `verifyAdmin` returns), add:
```typescript
const supabaseAdmin = getSupabaseAdmin();
```

Then replace all subsequent `getSupabaseAdmin()` calls in that handler with `supabaseAdmin`:
- `getSupabaseAdmin().auth.admin.createUser(...)` → `supabaseAdmin.auth.admin.createUser(...)`
- `getSupabaseAdmin().auth.admin.listUsers(...)` → `supabaseAdmin.auth.admin.listUsers(...)`
- `getSupabaseAdmin().from('staff').insert(...)` → `supabaseAdmin.from('staff').insert(...)`
- `getSupabaseAdmin().auth.admin.deleteUser(...)` → `supabaseAdmin.auth.admin.deleteUser(...)`

Do the same for the DELETE handler if it has multiple calls.

Note: With the singleton from Step 1, this step is technically redundant (all calls return the same instance). But it's still cleaner to store it once locally for readability.

---

## Step 3: Verify No Other `createClient` Patterns Exist

Search `apps/staff-web/src/app/api/` for any other `createClient` calls that bypass `getSupabaseAdmin()`. If found, replace with `getSupabaseAdmin()`.

---

## Final Verification

```bash
pnpm type-check
pnpm test
```

## Commit

Commit with message: `refactor(staff-web): make getSupabaseAdmin a singleton to avoid creating clients per call`
