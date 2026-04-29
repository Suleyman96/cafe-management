# M14 — Push permission with timeout

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. [notifications.ts](../../../apps/mobile/src/lib/notifications.ts) lines 16–46 awaits `requestPermissionsAsync()` without a timeout. On rare custom Android ROMs this hangs and blocks app startup. Read [plans/mobile-audit-2026-04/03-MEDIUM.md](../03-MEDIUM.md) section M14.

## Implementation steps

1. **`Promise.race` with 5s timeout**
   - Wrap `requestPermissionsAsync()` so that if it doesn't resolve in 5s, treat as `'undetermined'` and continue. Schedule a retry via `usePushTokenSync`'s next AppState `active` event.

2. **Tests**
   - Vitest with fake timers: stub `requestPermissionsAsync` to never resolve → after 5s the wrapper resolves with `'undetermined'`.

## Acceptance criteria

- [ ] App boot is never blocked > 5s by the permission dialog.
- [ ] Tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.
