# M2 — Debounce / serialize order sound playback

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. [apps/mobile/src/lib/sound.ts](../../../apps/mobile/src/lib/sound.ts) (lines 41–56) `playNewOrderSound()` does not await previous playback. Five orders inserted in 200ms produce five overlapping audio plays. Read [plans/mobile-audit-2026-04/03-MEDIUM.md](../03-MEDIUM.md) section M2.

## Implementation steps

1. **Promise mutex**
   - In `sound.ts`, hold a module-level `inFlight: Promise<void> | null`. Wrap the play in `if (inFlight) return inFlight; inFlight = (async () => { ... })().finally(() => { inFlight = null; })`.
   - Result: concurrent calls coalesce into one play.

2. **Time floor**
   - Track `lastPlayedAt`. If a new call comes in < 300ms after the last completion, drop it silently.

3. **Tests**
   - Vitest: call `playNewOrderSound` 5× in a tick → audio player's play method is called once. Use a fake `expo-audio` mock.
   - Vitest: time floor honored — call after 200ms is dropped, after 400ms is allowed.

## Acceptance criteria

- [ ] One sound per burst of order events.
- [ ] No overlapping audio playback observable in tests.
- [ ] Tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.

## Out of scope

- Sound file selection / haptics tuning.
