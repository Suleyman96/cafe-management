# L11 — Shared hooks accept `enabled`

## Context

Mobile wraps `useTables` to add `enabled: !!tenantId` ([apps/mobile/src/hooks/use-tables.ts](../../../apps/mobile/src/hooks/use-tables.ts) line 23). The shared hook in `@gustri/queries` has no such option. Web will need to invent it independently.

## Steps

1. Update each tenant-scoped shared hook in `packages/queries/src/hooks/` (orders, tables, waiter-calls, menu-items, tasks, etc.) to accept `enabled?: boolean` (default `true`).
2. Pass to the underlying `useQuery({ enabled, ... })`.
3. Mobile wrappers pass `!!tenantId`.
4. Document the convention in `packages/queries/src/README.md` (or top of barrel): "All tenant-scoped hooks accept `enabled` to allow consumers to gate on auth state."

## Acceptance

- [ ] Every tenant-scoped shared hook accepts `enabled`.
- [ ] Mobile wrappers updated.
- [ ] `pnpm check`, `pnpm type-check`, `pnpm test` pass.
