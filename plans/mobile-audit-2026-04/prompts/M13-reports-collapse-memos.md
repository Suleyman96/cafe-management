# M13 — `ReportsScreen` — collapse five memos into one pass

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. [ReportsScreen.tsx](../../../apps/mobile/src/screens/reports/ReportsScreen.tsx) lines 58–123 has five separate `useMemo` blocks computing on the same `filteredOrders` array, with a nested `.find()` inside `staffPerformance` (O(n × s)). Read [plans/mobile-audit-2026-04/03-MEDIUM.md](../03-MEDIUM.md) section M13.

## Implementation steps

1. **One pass**
   - Replace the five memos with a single `useMemo(() => aggregate(filteredOrders, staffList), [filteredOrders, staffList])` returning `{ totals, byStaff, byHour, byCategory, byTender }`.
   - Inside `aggregate`, build a `Map<staff_id, Aggregator>` for staff lookups instead of `staffList.find()`.

2. **Tests**
   - Vitest unit for `aggregate`: deterministic output for a sample dataset of 100 orders.
   - Profiler verification in PR description.

## Acceptance criteria

- [ ] Single memo, single pass.
- [ ] Tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.
