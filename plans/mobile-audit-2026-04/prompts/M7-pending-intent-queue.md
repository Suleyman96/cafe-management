# M7 — `pending-intent-store` queues, not overwrites

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. [pending-intent-store.ts](../../../apps/mobile/src/store/pending-intent-store.ts) lines 15–23 `setPending` overwrites — two notifications received while logged out → only one replays after login. Read [plans/mobile-audit-2026-04/03-MEDIUM.md](../03-MEDIUM.md) section M7.

## Implementation steps

1. **Convert to a queue**
   - State becomes `pending: PendingIntent[]`. Methods: `addPending(intent)`, `consumeAll(): PendingIntent[]` (returns and clears).
   - Cap at 10 entries (drop oldest) to prevent unbounded growth.

2. **Update consumers**
   - In `App.tsx` and `RootNavigator` post-login replay code, call `consumeAll()` instead of reading + clearing the singleton.
   - Iterate intents in arrival order; call the appropriate handler for each.

3. **Tests**
   - Vitest: enqueue 3 intents → `consumeAll()` returns 3 in FIFO order, store empty after.
   - Vitest: 11th enqueue evicts the oldest.

## Acceptance criteria

- [ ] Multiple pending intents replay after login.
- [ ] Cap honored.
- [ ] Tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.
