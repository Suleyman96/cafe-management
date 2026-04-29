# M11 — Memoize `MenuManagementScreen` category counts

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. [MenuManagementScreen.tsx](../../../apps/mobile/src/screens/menu-management/MenuManagementScreen.tsx) lines 74–76 and 215 calls `getCategoryItemCount(category)` inline in the chip loop. With 50 items × 10 categories that's 500 filter operations per render. Read [plans/mobile-audit-2026-04/03-MEDIUM.md](../03-MEDIUM.md) section M11.

## Implementation steps

1. **Build a `Map<categoryId, number>` once per `items` change**
   - Replace the inline filter with a `useMemo<Map<string, number>>(() => buildCounts(items), [items])`.
   - Reads in the chip loop become O(1).

2. **Tests**
   - Vitest: render with 5 items in 2 categories → chip counts match. Update items → counts re-derive once.
   - Profiler manual test in PR description.

## Acceptance criteria

- [ ] Single map build per `items` change.
- [ ] Tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.
