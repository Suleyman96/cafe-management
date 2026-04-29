# C2 — Tenant-stamped paused mutations

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. The mobile app persists paused mutations across app launches via `PersistQueryClientProvider`. Today, on app start `resumePausedMutations()` runs unconditionally — if user A queued a mutation offline and user B logs in on the same device, A's mutation can replay under B's auth context. This is a cross-tenant write. Read [plans/mobile-audit-2026-04/01-CRITICAL.md](../01-CRITICAL.md) section C2 first.

This depends on **C1** (idempotency keys) for an extra safety net — implement C1 first if not yet done.

## Implementation steps

1. **Stamp every persisted mutation with the resolving tenant/staff identity**
   - Update [apps/mobile/src/lib/register-mutation-defaults.ts](../../../apps/mobile/src/lib/register-mutation-defaults.ts): every registered default's `onMutate` reads `useAuthStore.getState()` and sets `meta = { tenantId, staffId, clientRequestId }`. Persister already serializes `meta`.
   - Update `shouldDehydrateMutation` in [apps/mobile/App.tsx:289–292](../../../apps/mobile/App.tsx#L289-L292) to require `meta.tenantId && meta.staffId` in addition to the existing checks.

2. **Drain mismatched mutations on hydration**
   - In `App.tsx`'s `onSuccess` callback for `PersistQueryClientProvider`, before `resumePausedMutations()`:
     - Resolve current session via `getCurrentUser()`.
     - Iterate `queryClient.getMutationCache().getAll()`. For each, if `meta.tenantId` or `meta.staffId` doesn't match, call `cache.remove(m)` and Sentry-breadcrumb the discard.
     - Then call `queryClient.resumePausedMutations()`.

3. **Persist `currentTenantId` next to the cache**
   - New file `apps/mobile/src/lib/session-stamp.ts`:
     - `writeSessionStamp({tenantId, staffId})`, `readSessionStamp()`, `clearSessionStamp()` — backed by MMKV under a single key `gustri.session-stamp`.
   - Call `writeSessionStamp` on every successful `setStaff(staff)` in [auth-store.ts](../../../apps/mobile/src/store/auth-store.ts).
   - In `App.tsx`, *before* `PersistQueryClientProvider` mounts (right after `migrateAsyncStorageToMMKV`): read `readSessionStamp()`, await `getCurrentUser()`. If they don't match, call `asyncStoragePersister.removeClient()` *before* hydration and `clearSessionStamp()`.

4. **Make `cleanupClientState` blocking on auth flip**
   - Update [auth.ts:150–157](../../../apps/mobile/src/lib/auth.ts) so `cleanupClientState()` is `async` and awaits:
     - `queryClient.cancelQueries()`
     - `queryClient.clear()`
     - `asyncStoragePersister.removeClient()`
     - `clearPushTokenSyncCache()`
     - `clearSessionStamp()`
     - `useAuthStore.getState().reset()` (add a `reset()` method to the store)
   - Update `RootNavigator` (or the auth gate) to await `cleanupClientState()` before flipping `staff = null`. Show a small loader during the drain.

5. **Tests**
   - Vitest unit: simulate hydration where the cache contains a mutation with `meta.tenantId = 'T_A'` but the resolved current session is `T_B`. Assert the mutation is removed and `resumePausedMutations` runs against an empty queue.
   - Vitest unit: the new `session-stamp` helper round-trips correctly and is idempotent on `clear`.
   - Manual checklist in PR description: log in A → queue offline mutation → log out → log in B → assert no write happened under B's tenant.

## Acceptance criteria

- [ ] Every paused mutation in MMKV has `meta.tenantId` and `meta.staffId`.
- [ ] Hydration on a tenant-mismatched device drops the cache before any screen reads it.
- [ ] `cleanupClientState` is awaited by the auth gate.
- [ ] Tests pass; `pnpm check` and `pnpm type-check` pass.

## Out of scope

- Re-hosting paused mutations from device A to device B (not a feature).
- Backfilling already-persisted mutations (the cache buster bumps and they're discarded).

Bump `CACHE_BUSTER` in [query-persister.ts](../../../apps/mobile/src/lib/query-persister.ts) so existing user caches are invalidated cleanly on first launch.
