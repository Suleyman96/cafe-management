/**
 * Re-export from `@gustri/queries` so the mobile mutation-key registry stays
 * in lockstep with shared mutation hooks. Add new keys to
 * `packages/queries/src/mutation-keys.ts`, not here. The companion
 * `register-mutation-defaults.ts` iterates `MUTATION_KEYS` and throws in dev
 * if any key is missing a registered `mutationFn`.
 */
export { MUTATION_KEYS, type MutationKey } from '@gustri/queries';
