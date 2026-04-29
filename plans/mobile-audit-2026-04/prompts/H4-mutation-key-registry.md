# H4 — Centralize mutation-key registry between mobile and `@gustri/queries`

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. Mobile maintains its own `MUTATION_KEYS` in [apps/mobile/src/lib/mutation-keys.ts](../../../apps/mobile/src/lib/mutation-keys.ts) and registers defaults in [register-mutation-defaults.ts](../../../apps/mobile/src/lib/register-mutation-defaults.ts). When a new mutation is added to `@gustri/queries` and someone forgets to wire the mobile default, persisted offline mutations rehydrate without a `mutationFn` and silently fail. Read [plans/mobile-audit-2026-04/02-HIGH.md](../02-HIGH.md) section H4.

## Implementation steps

1. **Single source of truth in `@gustri/queries`**
   - Create `packages/queries/src/mutation-keys.ts` exporting `MUTATION_KEYS` as a `const` object literal — every mutation gets an entry: `CREATE_ORDER: ['create-order'] as const` etc.
   - Each shared mutation hook in `packages/queries/src/mutations/` imports its key from this module and passes it to `useMutation({ mutationKey })`.

2. **Mobile reads from the shared module**
   - Replace the contents of `apps/mobile/src/lib/mutation-keys.ts` with `export { MUTATION_KEYS } from '@gustri/queries'` (or delete and update imports).
   - Update [register-mutation-defaults.ts](../../../apps/mobile/src/lib/register-mutation-defaults.ts) to iterate `Object.entries(MUTATION_KEYS)`. For each key:
     - Look up the registered default in a local `defaults: Record<string, MutationFn>` map.
     - If missing, throw in dev (`if (__DEV__) throw new Error(...)`) and Sentry-warn in prod (skip registration).

3. **Lint guard**
   - Add a Biome `noRestrictedSyntax` rule (in `biome.json` or `apps/mobile/biome.json`) banning literal `mutationKey: ['...']` outside `packages/queries/src/`. Allow `mutationKey: MUTATION_KEYS.X`.
   - Verify by adding a test fixture and confirming `pnpm check` flags it.

4. **Audit existing mutations**
   - Search `apps/mobile/src/hooks/` for `useMutation` and ensure every one uses `MUTATION_KEYS.*`.
   - Search `packages/queries/src/mutations/` similarly.

5. **Tests**
   - Vitest: import `MUTATION_KEYS` and assert each key has a registered default after `registerMutationDefaults(queryClient)` runs (introspect `queryClient.getMutationDefaults`).
   - Vitest: deliberately drop a default and assert the registration throws in dev mode.

## Acceptance criteria

- [ ] `MUTATION_KEYS` lives in `@gustri/queries`.
- [ ] Mobile reads from the shared module; the local file is a re-export or removed.
- [ ] `register-mutation-defaults` validates completeness at boot.
- [ ] Biome rule blocks literal mutation keys outside `@gustri/queries`.
- [ ] Tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.

## Out of scope

- Renaming any mutation keys.
- Promoting mobile-only mutations into shared package (separate decision).
