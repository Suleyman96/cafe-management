# L6 — Shared `CACHE_SCHEMA_VERSION`

## Context

[apps/mobile/src/lib/query-persister.ts](../../../apps/mobile/src/lib/query-persister.ts) lines 55–57 defines `CACHE_BUSTER` locally. Future web persistence will need a coordinated schema version.

## Steps

1. Export `CACHE_SCHEMA_VERSION = 'v1'` (or current value) from `packages/core/src/constants.ts`.
2. Mobile composes its `CACHE_BUSTER = `${CACHE_SCHEMA_VERSION}-${appVersion}``.
3. Document the contract in JSDoc: "Bump when persisted cache shape changes incompatibly."

## Acceptance

- [ ] Constant exported and consumed.
- [ ] `pnpm check`, `pnpm type-check`, `pnpm test` pass.
