# L3 — `keepPreviousData` on tab swaps

## Context

[apps/mobile/src/screens/feedback/FeedbackListScreen.tsx](../../../apps/mobile/src/screens/feedback/FeedbackListScreen.tsx) lines 59–68: switching tabs triggers a full list dump until the new query resolves. Looks like a flicker.

## Steps

1. Pass `placeholderData: keepPreviousData` (TanStack Query v5 syntax) to the relevant `useQuery`. Import `keepPreviousData` from `@tanstack/react-query`.
2. Audit other tab-driven screens for the same pattern (orders by status, takeout by status, tasks by scope). Apply where it makes UX sense.

## Acceptance

- [ ] Tab swaps show the previous list until the new one is ready.
- [ ] `pnpm check`, `pnpm type-check`, `pnpm test` pass.
