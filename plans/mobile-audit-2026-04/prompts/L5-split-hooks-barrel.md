# L5 — Split `apps/mobile/src/hooks/index.ts` barrel

## Context

[apps/mobile/src/hooks/index.ts](../../../apps/mobile/src/hooks/index.ts) mixes re-exports from `@gustri/queries` with mobile-only hooks (some of which wrap the shared ones). Importers can't tell which is which.

## Steps

1. Split:
   - `apps/mobile/src/hooks/shared.ts` — re-exports from `@gustri/queries` only.
   - `apps/mobile/src/hooks/local.ts` — mobile-only hooks and wrappers.
2. Update mobile imports app-wide (`apps/mobile/src/screens/**`) to point at the new barrels. Prefer `from '@/hooks/local'` for wrapper hooks (e.g. mobile's `useOrders`).
3. Add JSDoc tags on each wrapper: "Wraps `@gustri/queries.useOrders` with realtime subscription, sound, and fallback poll."

## Acceptance

- [ ] Two clear barrels.
- [ ] All imports updated; `pnpm check` and `pnpm type-check` pass.
