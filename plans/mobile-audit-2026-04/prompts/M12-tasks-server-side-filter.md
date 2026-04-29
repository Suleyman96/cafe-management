# M12 — Tasks: server-side filter, one query

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. [TasksListScreen.tsx](../../../apps/mobile/src/screens/tasks/TasksListScreen.tsx) lines 104–125 calls `useTasks` + `useTodaysTasks` + `useMyTasks` simultaneously, then filters client-side. With 200+ tasks this is wasteful. Read [plans/mobile-audit-2026-04/03-MEDIUM.md](../03-MEDIUM.md) section M12.

## Implementation steps

1. **Wrapper change**
   - In [packages/api-client/src/wrapper/tasks.ts](../../../packages/api-client/src/wrapper/tasks.ts), extend `findAll(params)` to accept `{ scope: 'all' | 'today' | 'mine', staff_id?, status?, priority? }`. Translate `scope` into the appropriate `WHERE` clauses (today: `due_date::date = current_date`; mine: `assigned_to = staff_id`).

2. **Hook**
   - Update `useTasks(params)` in `packages/queries/src/hooks/use-tasks.ts` to forward `scope` and pass it through to the wrapper. Cache key includes `scope`.

3. **Screen**
   - Replace the three concurrent hooks with one call: `const { data: tasks } = useTasks({ scope: selectedScope, staff_id: currentStaff?.id })`. Drop the in-memory filter `useMemo`.

4. **Tests**
   - Vitest: each scope returns the correct subset.
   - Vitest: switching scope triggers exactly one query (cache key differs, but at most one in flight per scope).

## Acceptance criteria

- [ ] Wrapper supports server-side scope filter.
- [ ] Screen uses one query at a time.
- [ ] Tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.
