# M5 — Persist `useAuthStore` for crash-resilient identity

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. [auth-store.ts](../../../apps/mobile/src/store/auth-store.ts) is in-memory. A crash mid-session shows a brief logged-out flash on relaunch before `getCurrentUser()` resolves. Read [plans/mobile-audit-2026-04/03-MEDIUM.md](../03-MEDIUM.md) section M5.

This depends on **C3** (encrypted MMKV / SecureStore boot).

## Implementation steps

1. **Add `zustand/middleware` `persist`**
   - Wrap `useAuthStore` with `persist`, backed by an `expo-secure-store`-flavored storage adapter.
   - Persist only `staff` (and derived `staff.tenant_id`, `role`). **Do not persist `tenantPlan`** — that's authoritative server-side.
   - Provide a `reset()` method that clears the persisted snapshot via `useAuthStore.persist.clearStorage()`.

2. **Hook into logout**
   - In `cleanupClientState()` (auth.ts), call `useAuthStore.getState().reset()` so persisted state is wiped on logout.

3. **Boot sequence**
   - On boot, the persisted `staff` hydrates immediately so the navigator picks the authed stack without a flicker. `getCurrentUser()` runs after and reconciles — if the server says the session expired, force logout (this triggers `reset()`).

4. **Tests**
   - Vitest: round-trip persist → hydrate → assert state matches.
   - Vitest: `reset()` clears storage.
   - Manual: log in → kill app → relaunch → no logged-out flash.

## Acceptance criteria

- [ ] `useAuthStore` is persisted; only `staff` persists.
- [ ] `reset()` clears storage and is called on logout.
- [ ] Tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.

## Out of scope

- Persisting query cache (already handled by C3 + the persister).
