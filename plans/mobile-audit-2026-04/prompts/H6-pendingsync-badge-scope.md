# H6 — Scope `PendingSyncBadge` mutation predicate

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. [PendingSyncBadge.tsx](../../../apps/mobile/src/components/PendingSyncBadge.tsx) (lines 16–19) calls `useMutationState` with no predicate, so it re-renders on every mutation in the entire app. The badge is mounted at the root, so its re-render cascades into the navigator. Read [plans/mobile-audit-2026-04/02-HIGH.md](../02-HIGH.md) section H6.

## Implementation steps

1. **Add a predicate**
   - Update the `useMutationState` call to pass `filters: { predicate: m => m.state.isPaused === true }`.
   - Memoize the predicate via `useMemo` so identity is stable across renders.

2. **Verify count parity**
   - In dev, log a warning if the new filtered count differs from the unfiltered count for >1s — sanity check during the rollout. Remove the dev-only log after one release if it never fires.

3. **Tests**
   - Vitest using the existing `PendingSyncBadge.test.tsx`:
     - Add a mutation that is in `pending` but not paused → badge shows 0.
     - Add a paused mutation → badge shows 1.
   - Profiler check (manual, document in PR): perform a non-paused mutation; confirm `PendingSyncBadge` does not re-render.

## Acceptance criteria

- [ ] `useMutationState` predicate filters to paused-only.
- [ ] Existing test file updated and passes.
- [ ] No re-render of the badge on non-paused mutations (verified via React DevTools Profiler in the PR).
- [ ] `pnpm check`, `pnpm type-check`, `pnpm test` pass.

## Out of scope

- Repositioning the badge in the navigation tree.
