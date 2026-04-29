# H5 — Validate before `mutationFn`, not inside it

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. Validation via `validateOrThrow` happens inside `mutationFn` (e.g. [apps/mobile/src/hooks/use-create-order.ts](../../../apps/mobile/src/hooks/use-create-order.ts) lines 17–19). React Query treats the thrown `ValidationError` as a transient failure and retries. Users wait ~7 seconds for an instant input error. Read [plans/mobile-audit-2026-04/02-HIGH.md](../02-HIGH.md) section H5.

## Implementation steps

1. **Update the global retry predicate**
   - In [apps/mobile/src/lib/mutation-defaults.ts](../../../apps/mobile/src/lib/mutation-defaults.ts) (lines 11–16), short-circuit the retry predicate:
     ```ts
     retry: (failureCount, error) => {
       if (error instanceof ValidationError) return false;
       // ...existing logic
     }
     ```
   - Import `ValidationError` from `@gustri/core`.

2. **Audit and prefer pre-call validation**
   - Search `apps/mobile/src/hooks/` and `packages/queries/src/mutations/` for `validateOrThrow` inside a `mutationFn`. For each hit, refactor to validate at the call site (the screen that triggers `mutate()`), exposing per-field errors via `ValidationError.details.fieldErrors`.
   - The retry predicate above remains the safety net.

3. **Tests**
   - Vitest: a `ValidationError` thrown from `mutationFn` results in zero retries (assert `failureCount === 1` after the rejection settles).
   - Vitest: a `NetworkError` still retries per existing policy.

## Acceptance criteria

- [ ] `mutation-defaults.ts` retry predicate ignores `ValidationError`.
- [ ] At least the high-traffic mutations (create-order, update-order-status, create-payment) validate at the call site.
- [ ] Bad input shows the field error in < 100 ms.
- [ ] Tests pass; `pnpm check` and `pnpm type-check` pass.

## Out of scope

- Removing `validateOrThrow` from mutation hooks entirely (the safety net stays).
