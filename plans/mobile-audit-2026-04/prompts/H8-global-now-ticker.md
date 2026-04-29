# H8 — Single global `useNow` ticker

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. [TimeElapsed.tsx](../../../apps/mobile/src/components/ui/TimeElapsed.tsx) (lines 31–52) ticks at 1Hz per instance. With 50 visible cards, that's 50 renders per second — battery + jank. Read [plans/mobile-audit-2026-04/02-HIGH.md](../02-HIGH.md) section H8.

## Implementation steps

1. **Create a global ticker store**
   - New file `apps/mobile/src/lib/now-ticker.ts`:
     - Zustand store with `now: number`, started lazily on first subscribe and torn down on last unsubscribe (use a small ref-counter pattern).
     - Default cadence: 30 seconds.
     - Export hook `useNow(selector)` that wraps `useNowStore(selector)`.

2. **Refactor `TimeElapsed`**
   - Replace any internal `setInterval` / direct `Date.now()` with `useNow(s => s.now)`.
   - For values where elapsed < 60s, allow the component to fall through to a local 1s `setState` ticker for the first minute only (granularity matters when something just happened). Switch to global ticker after.

3. **Style memoization**
   - While in the file, memoize the inline style object (`useMemo([color, fontWeight])`) so the prop identity is stable.

4. **Tests**
   - Vitest: render `TimeElapsed` with a mocked `useNow` store; assert it updates only when `now` advances.
   - Vitest: ref-counter — first subscribe starts the interval, last unsubscribe stops it (assert with a fake timer).

## Acceptance criteria

- [ ] `useNow` exists and is started/stopped via subscribe count.
- [ ] `TimeElapsed` uses the global ticker for elapsed > 60s.
- [ ] Style object is memoized.
- [ ] Tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.

## Out of scope

- Replacing `Date` formatting with native APIs.
- Server-time sync.
