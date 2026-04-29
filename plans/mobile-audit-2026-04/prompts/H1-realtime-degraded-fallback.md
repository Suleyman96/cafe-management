# H1 — Aggressive fallback when realtime is `degraded`

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. The mobile realtime hook ([apps/mobile/src/hooks/use-realtime-sync.ts](../../../apps/mobile/src/hooks/use-realtime-sync.ts) lines 177–186) falls back to a 120-second poll when the WebSocket fails. During a busy service that's a 2-minute kitchen blackout — orders arrive over REST but never reach the kitchen with sound until the next poll. Read [plans/mobile-audit-2026-04/02-HIGH.md](../02-HIGH.md) section H1.

## Implementation steps

1. **Two-speed poll**
   - In `use-realtime-sync.ts`, when the channel transitions to `degraded`:
     - Immediately call `queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.<channel-key>] })` for the channel's bound key.
     - Replace the existing 120s `setInterval` with a 20s one. Restore to `REFRESH_INTERVALS.FALLBACK` (or remove the interval entirely) once the channel reaches `connected` again.

2. **Add a `DEGRADED_FALLBACK_MS` constant**
   - Edit [packages/core/src/constants.ts](../../../packages/core/src/constants.ts) `REFRESH_INTERVALS`:
     - Add `DEGRADED_FALLBACK: 20_000`.
     - Document semantics in JSDoc: `FALLBACK` is the steady-state poll, `DEGRADED_FALLBACK` is the active-recovery poll.

3. **Surface the state in UI**
   - Add a sticky banner above the navigator (or inside `OfflineBanner.tsx`) that shows when `realtime status === 'degraded'`. Copy: i18n key `realtime.degraded` ("Live updates degraded — refreshing every 20s"). Required locales: `en`, `az`, `ru`, `tr`.
   - The banner should not be dismissible while degraded; auto-hides on `connected`.

4. **Telemetry**
   - On every status transition, emit a Sentry breadcrumb with `{ channelName, fromStatus, toStatus, retryCount, lastEventAt }`. Use existing Sentry init (no new config).

5. **Tests**
   - Vitest unit: mock the channel to fire a `degraded` status; assert the poll interval becomes 20s and an immediate `invalidateQueries` is called.
   - Vitest unit: degraded → connected transitions back to the original interval.
   - Maestro test (manual is fine in PR description): kill the WebSocket via airplane mode → confirm banner shows and orders refresh within 25s of insert.

## Acceptance criteria

- [ ] `DEGRADED_FALLBACK` constant exists in `packages/core`.
- [ ] `use-realtime-sync.ts` enters fast-poll on `degraded`, exits on `connected`.
- [ ] Banner visible during degraded state, hidden otherwise.
- [ ] Sentry breadcrumb emitted on every transition.
- [ ] Unit tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.

## Out of scope

- Server-side push-on-degraded retry (separate concern).
- Modifying the upstream `FALLBACK` value for steady state.
