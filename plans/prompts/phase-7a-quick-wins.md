# Phase 7a Prompt: Quick Wins & Hardening (SCALE-18 + SCALE-19 + SCALE-21 + SCALE-30 + SCALE-31)

Copy everything below the line and paste it as the prompt for a new Claude Code session.

---

## Task

Implement the first batch of Phase 7 from `plans/07-SCALING-AND-ARCHITECTURE-fixes.md`. Phase 7 has 18 items — this prompt covers the 5 quickest, most impactful ones. Phases 1-6 have already been implemented.

These are small, independent fixes. Each can be done in isolation. Total effort: ~2.5 days.

---

## SCALE-18: Error boundaries for 4 staff-web pages

### Problem
Four staff-web sections have no section-level error boundary. When a query fails on these pages, the global `(staff)/error.tsx` replaces the ENTIRE page layout including sidebar and navigation. A query failure in feedback shouldn't blow away the navigation.

### Current state (verified)

**Missing `error.tsx` in:**
- `apps/staff-web/src/app/(staff)/feedback/`
- `apps/staff-web/src/app/(staff)/schedules/`
- `apps/staff-web/src/app/(staff)/cafe-settings/`
- `apps/staff-web/src/app/(staff)/staff/`

**Existing global error boundary** at `apps/staff-web/src/app/(staff)/error.tsx` (lines 1-57):
- Uses Sentry `captureException` in `useEffect`
- Renders error message with "Try again" button and "Go to Dashboard" link
- Has an SVG alert icon in a red circle
- No reusable error component exists in `components/ui/`

### Implementation

**Step 1** — Create a lightweight reusable component at `apps/staff-web/src/components/ui/page-error.tsx`:

```typescript
'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
        <svg
          className="h-6 w-6 text-red-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <h2 className="mb-2 text-lg font-semibold text-gray-900">Something went wrong</h2>
      <p className="mb-4 text-sm text-gray-500">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
```

This is intentionally simpler than the global error boundary — no "Go to Dashboard" link (sidebar is still visible), and it shows the error message for debugging.

**Step 2** — Create `error.tsx` in each of the 4 directories. Each file is identical:

```typescript
'use client';

export { default } from '@/components/ui/page-error';
```

Create these files:
- `apps/staff-web/src/app/(staff)/feedback/error.tsx`
- `apps/staff-web/src/app/(staff)/schedules/error.tsx`
- `apps/staff-web/src/app/(staff)/cafe-settings/error.tsx`
- `apps/staff-web/src/app/(staff)/staff/error.tsx`

### Verification
- Temporarily throw an error in the feedback page hook → error renders within the page layout (sidebar stays visible)
- Click "Try again" → page re-renders
- Revert the temporary error
- Run `pnpm type-check && pnpm check`

---

## SCALE-19: Fix discount trigger race condition

### Problem
`applyDiscount()` in `packages/api-client/src/wrapper/orders.ts` lines 371-394 deliberately avoids `.select().single()` because the `recalculate_on_discount_change` trigger updates the same row, causing PostgREST "Cannot coerce" errors. This means the method returns nothing — the caller must refetch manually, creating a window where stale data is displayed.

### Current state (verified)

**The method** (lines 371-394):
```typescript
applyDiscount: async (orderId, discount) => {
  // Comment at lines 380-382 explains the trigger conflict
  const { error } = await ctx.anyClient
    .from('orders')
    .update({ discount_type, discount_value, discount_reason, discount_applied_by })
    .eq('id', orderId);
  if (error) throw handleSupabaseError(error);
  // Returns nothing — caller must invalidateQueries
},
```

**The trigger** (current version at `supabase/migrations/20260419000002_add_financial_audit_log.sql` lines 237-254):
- Fires AFTER UPDATE OF `discount_type`, `discount_value` on orders
- Logs financial audit entry, then calls `calculate_order_total(NEW.id)` which updates `subtotal`, `tax`, `total`

**The core issue**: The UPDATE starts a transaction, trigger fires synchronously within it, trigger updates the same row, PostgREST can't coerce the response because the row changed mid-flight.

### Implementation

**Step 1** — Modify `applyDiscount` to refetch the order after the update succeeds. The update (without `.select()`) completes fine — it's only the `.select().single()` chain that causes the "Cannot coerce" error. So update first, then fetch separately:

Replace lines 371-394 in `packages/api-client/src/wrapper/orders.ts`:

```typescript
applyDiscount: async (
  orderId: string,
  discount: {
    discount_type: 'none' | 'percentage' | 'fixed';
    discount_value: number;
    discount_reason?: string | null;
    discount_applied_by: string;
  },
) => {
  // Update discount fields — don't chain .select() because the
  // recalculate_on_discount_change trigger modifies the same row,
  // causing PostgREST "Cannot coerce" errors.
  const { error } = await ctx.anyClient
    .from('orders')
    .update({
      discount_type: discount.discount_type,
      discount_value: discount.discount_value,
      discount_reason: discount.discount_reason || null,
      discount_applied_by: discount.discount_applied_by,
    })
    .eq('id', orderId);

  if (error) throw handleSupabaseError(error);

  // Fetch the updated order after the trigger has finished
  const { data, error: fetchError } = await ctx.anyClient
    .from('orders_decrypted')
    .select('*')
    .eq('id', orderId)
    .single();

  if (fetchError) throw handleSupabaseError(fetchError);
  return data;
},
```

**Step 2** — Update the return type. The method currently returns `void`. After this change it returns an `OrderRow`. Check callers — find where `applyDiscount` is called and verify they handle the return value or at least don't break:

Search for `applyDiscount` usage in the codebase:
```bash
grep -r "applyDiscount" --include="*.ts" --include="*.tsx" apps/ packages/
```

If a mutation hook calls `applyDiscount`, the `onSuccess` callback can now use the returned data to optimistically update the cache instead of requiring a full refetch:

```typescript
// If there's a useApplyDiscount mutation hook, its onSuccess could be:
onSuccess: (updatedOrder) => {
  queryClient.setQueryData(['order', orderId], updatedOrder);
  invalidateOrders(queryClient);
},
```

But only change the mutation hook if it already exists. Don't create new hooks.

### Verification
- Apply a discount to an order → UI updates immediately with the correct recalculated total
- No "Cannot coerce" errors in browser console or Supabase logs
- Apply discount with `discount_type: 'percentage'`, `discount_value: 10` → total should be 10% less
- Apply discount with `discount_type: 'none'` → discount removed, total restored
- Run `pnpm test && pnpm type-check && pnpm check`

---

## SCALE-21: Server-side upload validation

### Problem
Image uploads are validated only client-side (`apps/staff-web/src/components/settings/image-upload.tsx` lines 43-54). A malicious user can bypass the browser and upload arbitrary files directly to Supabase Storage using the anon key. The `branding` bucket is not even configured in `supabase/config.toml`.

### Current state (verified)

**Client-side validation** (image-upload.tsx lines 43-54):
- Checks `file.type.startsWith('image/')` — bypassable
- Checks `file.size > maxSize` — bypassable
- Uploads directly to Supabase Storage via `supabase.storage.from(bucket).upload()`

**Supabase storage config** (`supabase/config.toml` lines 40-52):
- `menu-images` bucket: 5MB limit, JPEG/PNG/WebP only
- `qr-codes` bucket: 1MB limit, PNG only
- **`branding` bucket: NOT CONFIGURED** — the default bucket used by the image upload component

**No server-side upload API route** exists.

### Implementation

**Step 1** — Add the `branding` bucket to `supabase/config.toml`:

```toml
[storage.buckets.branding]
public = true
file_size_limit = "2MB"
allowed_mime_types = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"]
```

**Step 2** — Add Supabase Storage RLS policies via a migration. Create `supabase/migrations/YYYYMMDD_storage_policies.sql`:

```sql
-- Storage policies for the branding bucket.
-- Only authenticated staff can upload. Anyone can read (public bucket).

-- Allow authenticated users to upload to branding bucket
CREATE POLICY "Authenticated users can upload branding assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'branding'
  AND (storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp', 'svg'))
);

-- Allow authenticated users to update/replace branding assets
CREATE POLICY "Authenticated users can update branding assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'branding');

-- Allow authenticated users to delete branding assets
CREATE POLICY "Authenticated users can delete branding assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'branding');

-- Allow anyone to read branding assets (public bucket)
CREATE POLICY "Public read access to branding assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'branding');

-- Also add policies for menu-images if missing
-- (menu-images bucket is used for menu item photos)
CREATE POLICY "Authenticated users can upload menu images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'menu-images'
  AND (storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp'))
);

CREATE POLICY "Authenticated users can update menu images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'menu-images');

CREATE POLICY "Authenticated users can delete menu images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'menu-images');

CREATE POLICY "Public read access to menu images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'menu-images');
```

**Important**: Check if storage policies already exist before creating them. Wrap each in `DROP POLICY IF EXISTS ... ON storage.objects;` before the `CREATE POLICY` to make the migration idempotent. Or check existing policies first:

```sql
SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
```

**Step 3** — The combination of bucket config (`file_size_limit`, `allowed_mime_types`) and storage policies provides server-side validation. No separate upload API route is needed — Supabase Storage enforces these at the server level even when the client uploads directly.

**Step 4** — Verify the client component uses the `authenticated` supabase client (not anon). Check `apps/staff-web/src/components/settings/image-upload.tsx` line 8:
```typescript
import { supabase } from '@/lib/supabase/client';
```
This is the browser client which carries the user's session token — uploads go through as `authenticated` role. The storage policies will apply correctly.

### Verification
- Upload a valid JPEG via the UI → succeeds
- Try uploading a `.html` file renamed to `.jpg` via curl with the anon key → rejected by `allowed_mime_types`
- Try uploading a 5MB file → rejected by `file_size_limit` (2MB for branding)
- Upload from staff-web UI works normally (authenticated role)
- Run `pnpm test && pnpm type-check && pnpm check`

---

## SCALE-30: Mobile sound cleanup memory leak

### Problem
`apps/mobile/src/lib/sound.ts` exports `cleanupSounds()` at lines 46-53, but it's never called. `setupSounds()` is called at `App.tsx` line 74 in a `useEffect` with no cleanup return. Audio objects persist in memory for the entire app lifecycle.

### Current state (verified)

**sound.ts** (full file, 54 lines):
- Line 3-4: Global refs `newOrderSound` and `waiterCallSound`
- Line 7-24: `setupSounds()` — creates Audio.Sound, sets `playsInSilentModeIOS: true`
- Line 18: `waiterCallSound = orderSound` — both refs point to the same Sound object
- Line 46-53: `cleanupSounds()` — calls `unloadAsync()` on both (but since they're the same object, it unloads twice — harmless but redundant)

**App.tsx** lines 69-75:
```typescript
useEffect(() => {
  registerForPushNotifications();
  setupSounds();
}, []);
// No cleanup return — sounds are never unloaded
```

### Implementation

**Step 1** — Add cleanup to the `useEffect` in `apps/mobile/App.tsx`. Replace lines 69-75:

```typescript
useEffect(() => {
  registerForPushNotifications();
  setupSounds();

  return () => {
    cleanupSounds();
  };
}, []);
```

Add the import at the top of the file:
```typescript
import { cleanupSounds, setupSounds } from '@/lib/sound';
```

Check if `setupSounds` is already imported — it should be. Add `cleanupSounds` to the existing import.

**Step 2** — That's it. The `cleanupSounds` function already handles unloading correctly. The `useEffect` cleanup runs when the app unmounts (which happens when the process is killed, but more importantly, React's strict mode in development will call it during remounts).

**Note about the duplicate unload**: `waiterCallSound` and `newOrderSound` both point to the same `Audio.Sound` object (line 18). Calling `unloadAsync()` on the same object twice is harmless — the second call is a no-op. No fix needed for this.

### Verification
- App starts → sounds load (check with a new order notification)
- In development mode with strict mode, verify no "Sound already unloaded" errors in logs
- Long-running session → no memory growth from audio objects (use React Native performance monitor)
- Run `pnpm type-check`

---

## SCALE-31: Realtime channel cleanup on logout

### Problem
When a user logs out in the mobile app, Realtime channels (orders, waiter calls) are NOT removed. They're only cleaned up when individual hook components unmount. If the logout doesn't trigger unmount (e.g., navigation stack stays mounted briefly), ghost channels persist with stale tenant context.

### Current state (verified)

**Logout function** (`apps/mobile/src/lib/auth.ts` lines 26-29):
```typescript
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  // NO channel cleanup
}
```

**Channels are created in hooks** (properly cleaned on unmount):
- `apps/mobile/src/hooks/use-orders.ts` — creates `orders:all` channel, cleans up on unmount
- `apps/mobile/src/hooks/use-waiter-calls.ts` — creates `waiter_calls` channel, cleans up on unmount

**Auth state listener** (`apps/mobile/App.tsx` lines 59-67):
```typescript
const { data } = onAuthStateChange((staff) => {
  setStaff(staff);
  // NO channel cleanup when staff becomes null (logged out)
});
```

**`supabase` import** is already available in `auth.ts` at line 2: `import { db, supabase } from './supabase'`

### Implementation

**Step 1** — Update the `logout` function in `apps/mobile/src/lib/auth.ts`:

```typescript
export async function logout() {
  // Remove all Realtime channels before signing out to prevent
  // ghost subscriptions with stale tenant context
  const channels = supabase.getChannels();
  for (const channel of channels) {
    supabase.removeChannel(channel);
  }

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
```

**Step 2** — Also clean up channels on involuntary sign-out (token expiry, session revocation). Update the `onAuthStateChange` function in `apps/mobile/src/lib/auth.ts`:

```typescript
export function onAuthStateChange(callback: (staff: Staff | null) => void) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      try {
        const staff = (await db.staff.findByAuthId(session.user.id)) as Staff;
        callback(staff);
      } catch {
        callback(null);
      }
    } else {
      // User signed out or session expired — clean up channels
      const channels = supabase.getChannels();
      for (const channel of channels) {
        supabase.removeChannel(channel);
      }
      callback(null);
    }
  });
}
```

**Step 3** — Verify `supabase.getChannels()` is available. The Supabase JS client v2.45+ exposes this method. Since the project uses `@supabase/supabase-js: ^2.45.0`, it should be available. If the type checker complains, check the exact method name — it might be `getChannels()` or `channels` depending on the version.

### Verification
- Login → open the orders page (creates channel) → check `supabase.getChannels().length` in console → should be > 0
- Logout → check channels → should be 0
- Login as a different user → verify channels filter by new tenant_id (check channel params)
- Force token expiry → verify channels cleaned up
- Run `pnpm type-check`

---

## Execution order

These items are independent — work on them in any order. Suggested sequence by risk:

1. **SCALE-18** (error boundaries) — zero risk, copy-paste files
2. **SCALE-30** (sound cleanup) — one-line change in App.tsx
3. **SCALE-31** (channel cleanup) — small change in auth.ts
4. **SCALE-21** (storage policies) — config + migration, no app code
5. **SCALE-19** (discount fix) — modifies a wrapper method, test carefully

## General rules

- Follow existing code patterns exactly
- Use Biome formatting: 2-space indent, single quotes, trailing commas. Run `pnpm check:fix` before considering done
- Migration filenames: use format `YYYYMMDD000001_description.sql`. Check existing migrations for latest date prefix
- For storage policies: check for existing policies before creating new ones to make migration idempotent
- Do NOT add comments, docstrings, or type annotations beyond what's needed
- Do NOT refactor surrounding code
- Run `pnpm test && pnpm type-check && pnpm check` at the end
