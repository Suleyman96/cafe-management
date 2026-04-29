# M4 — Convert whole-store Zustand subscribers to selectors

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. Several files call `useAuthStore()` without a selector (e.g. [RootNavigator.tsx](../../../apps/mobile/src/navigation/RootNavigator.tsx) line 46). Any state change — including `tenantPlan` updates — re-renders the navigator. Read [plans/mobile-audit-2026-04/03-MEDIUM.md](../03-MEDIUM.md) section M4.

## Implementation steps

1. **Find all offenders**
   - Grep `useAuthStore\(\)` (no argument) across `apps/mobile/`. Convert each to selector form: `const staff = useAuthStore(s => s.staff)` etc. Same for any other Zustand stores in `apps/mobile/src/store/`.

2. **Lint guard**
   - Add a Biome `noRestrictedSyntax` rule in `apps/mobile/biome.json` banning `CallExpression[callee.name=/^use(Auth|PendingIntent)Store$/][arguments.length=0]`. Verify by introducing a violation and running `pnpm check`.

3. **Tests**
   - Component re-render test (Profiler-style): set up `RootNavigator`, mutate `tenantPlan`, assert navigator does not re-render.

## Acceptance criteria

- [ ] No `useAuthStore()` (no arg) calls remain in mobile code.
- [ ] Biome rule catches future violations.
- [ ] Profiler-style test passes.
- [ ] `pnpm check`, `pnpm type-check`, `pnpm test` pass.
