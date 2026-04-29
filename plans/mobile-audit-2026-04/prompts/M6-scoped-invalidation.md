# M6 — Scope `invalidateOrdersAndTables` to actual transitions

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. [packages/queries/src/invalidation.ts](../../../packages/queries/src/invalidation.ts) lines 22–32 invalidates ORDERS, ACTIVE_ORDERS, DELIVERY_ORDERS, TAKEOUT_ORDERS, and TABLES on every order status change. Toggling 10 item statuses on the kitchen screen produces 10 unnecessary table refetches. Read [plans/mobile-audit-2026-04/03-MEDIUM.md](../03-MEDIUM.md) section M6.

## Implementation steps

1. **Extend the signature**
   - Change `invalidateOrdersAndTables(qc)` to `invalidateOrdersAndTables(qc, { oldStatus, newStatus, oldType, newType })`.
   - Always invalidate `ORDERS` and `ACTIVE_ORDERS`.
   - Only invalidate `TABLES` when transition crosses `closed` ↔ `!closed`.
   - Only invalidate `DELIVERY_ORDERS` when `out_for_delivery` ↔ `delivered`/`closed`.
   - Only invalidate `TAKEOUT_ORDERS` when `type === 'takeout'`.

2. **Update call sites**
   - Search `packages/queries/src/mutations/` and `apps/mobile/src/hooks/` for callers and pass the transition info.

3. **Tests**
   - Vitest: a kitchen-only transition (`preparing → ready`) does NOT invalidate `TABLES`.
   - Vitest: a `served → closed` transition DOES invalidate `TABLES`.

## Acceptance criteria

- [ ] Helper requires transition info.
- [ ] Refetches happen only when relevant.
- [ ] Tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.
