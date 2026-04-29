# H2 — Post-resume realtime health check

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. After AppState transitions from `background` to `active`, [use-realtime-sync.ts](../../../apps/mobile/src/hooks/use-realtime-sync.ts) calls `teardownChannel()` and recreates the subscription. If `teardownChannel()` throws (rare but observed), or the new subscribe stalls in `JOINING`, the hook believes itself healthy but receives no events. The 2-minute fallback poll is the only catch-up. Read [plans/mobile-audit-2026-04/02-HIGH.md](../02-HIGH.md) section H2.

## Implementation steps

1. **Wrap `teardownChannel` with try/catch**
   - In `use-realtime-sync.ts`, wrap the `teardownChannel()` invocation inside the AppState handler (lines ~147–165) so a thrown unsubscribe never blocks recreation. Sentry-breadcrumb the swallowed error.

2. **Schedule a 3s post-resume health check**
   - After AppState `active` and the new subscribe call, `setTimeout(3000)`:
     - If `channel.state !== 'joined'` (or the equivalent SUBSCRIBED check the codebase uses), force `queryClient.invalidateQueries(...)` for the channel's keys and reattempt subscribe.
     - Clear the timeout in the cleanup if the component unmounts before it fires.

3. **Always invalidate once on resume**
   - Even when the channel is healthy, calling `queryClient.invalidateQueries(...)` on resume costs one fetch and guarantees no missed event slipped past during the background window. Do this regardless of the health check outcome.

4. **Tests**
   - Vitest unit: mock `teardownChannel` to throw → next subscribe still proceeds → status reaches `connected`.
   - Vitest unit: simulate a 3s elapsed timer where channel.state stayed `joining` → assert `invalidateQueries` ran and a retry subscribe was attempted.
   - Manual: lock device for 5 minutes, resume; verify orders that were inserted during the lock appear within 4s.

## Acceptance criteria

- [ ] `teardownChannel` errors no longer block channel recreation.
- [ ] Post-resume health check fires at 3s and recovers stalled subscribes.
- [ ] Resume always triggers one cache invalidation.
- [ ] Unit tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.

## Out of scope

- Replacing the realtime hook architecture.
- Visibility events on iOS Notification Center.
