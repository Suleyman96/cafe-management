# H3 — Inactivity lock survives OS-lock and force-quit

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. The inactivity lock at [apps/mobile/src/hooks/use-inactivity-lock.ts](../../../apps/mobile/src/hooks/use-inactivity-lock.ts) only triggers on AppState transitions. A device that auto-locks the screen but stays in RAM remains authenticated. Force-quit + relaunch also doesn't re-auth. Read [plans/mobile-audit-2026-04/02-HIGH.md](../02-HIGH.md) section H3.

This depends on **C3** for encrypted storage of the `lastActiveAt` timestamp.

## Implementation steps

1. **Persist `lastActiveAt` on every backgrounding**
   - In `use-inactivity-lock.ts`, on every AppState `background` transition, call `setLastActiveAt(Date.now())` against the encrypted MMKV store (use the same instance from C3 with a key like `gustri.last-active-at`).

2. **Check on resume and on cold start**
   - On every AppState `active` transition: read `lastActiveAt`, compute `Date.now() - lastActiveAt`. If `> INACTIVITY_TIMEOUT_MS`, call `forceLogout()`.
   - On cold start *after* `getCurrentUser()` resolves (in [App.tsx](../../../apps/mobile/App.tsx) auth-init `useEffect`): same check. Log the user out if expired before any screen mounts.

3. **Per-role timeout**
   - Add `INACTIVITY_TIMEOUTS_BY_ROLE` to [packages/core/src/constants.ts](../../../packages/core/src/constants.ts):
     - `kitchen: 15 min`, `waiter: 30 min`, `admin: 60 min`, `owner: 60 min`.
   - `use-inactivity-lock.ts` reads the current role from `useAuthStore` and picks the matching timeout. Default to the most restrictive value (15 min) if role is missing.

4. **OS-lock detection (best effort)**
   - On iOS, AppState already transitions to `inactive` on screen lock.
   - On Android, screen lock does *not* always trigger a transition — subscribe to a native broadcast via a small Expo config plugin or use `expo-keep-awake` indirectly.
   - Pragmatic interim: rely solely on AppState `background` (steps 1–3 already cover force-quit). Document the Android limitation in a code comment with a TODO. Hard-cap timeout to 30 min while hardening lands.

5. **Tests**
   - Vitest: simulate `lastActiveAt = now - 16min`, role = `kitchen` → resume calls `forceLogout`.
   - Vitest: same `lastActiveAt`, role = `admin` → no logout (60 min cap not exceeded).
   - Manual checklist in PR description: lock device, wait > timeout, unlock → app at login screen. Force-quit while locked, relaunch → at login screen.

## Acceptance criteria

- [ ] `lastActiveAt` is written on every `background`.
- [ ] Cold start and resume both check the timestamp.
- [ ] Per-role timeouts honored.
- [ ] Tests pass; `pnpm check` and `pnpm type-check` pass.

## Out of scope

- Biometric unlock instead of password re-auth (separate ticket).
- Server-side session-length policy enforcement.
