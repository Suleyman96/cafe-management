# C1 — Idempotency keys for all mutating endpoints

## Context

You are working in a Turborepo monorepo at `/Users/kamilhajilov/Documents/github/cafe-idare`. The mobile staff app (Expo 54 / RN 0.81) persists paused mutations to MMKV via `PersistQueryClientProvider` and replays them on relaunch. There is currently no way for the server to detect that a replayed mutation is the same logical operation as one that already succeeded — so a mutation that committed server-side but lost the response will create duplicate orders, payments, refunds, etc. on replay.

Read [plans/mobile-audit-2026-04/01-CRITICAL.md](../01-CRITICAL.md) section C1 before starting. This is a security/correctness fix — no shortcuts.

## Scope

Implement end-to-end idempotency for every mutating endpoint and direct-write wrapper that mobile can replay offline. Do not ship without server enforcement.

## Implementation steps

1. **Mobile — generate and persist a `client_request_id`**
   - Update [apps/mobile/src/lib/register-mutation-defaults.ts](../../../apps/mobile/src/lib/register-mutation-defaults.ts) so every registered default's `mutationFn` accepts a `clientRequestId` from the variables/context (or generates one in `onMutate` if absent).
   - Add a small helper `apps/mobile/src/lib/idempotency.ts` exporting `getOrCreateClientRequestId(variables)` that returns a stable UUID v4. Stamp it into a `clientRequestId` field on the mutation's `meta` so it survives dehydration → rehydration.
   - All mobile-local hooks under `apps/mobile/src/hooks/` that perform writes (search for `useMutation`) must include the id in the request payload.

2. **Shared — extend `@gustri/queries` mutation hooks**
   - For every mutation in [packages/queries/src/mutations/](../../../packages/queries/src/mutations/), accept and forward `clientRequestId` to the wrapper call.

3. **Wrapper — extend `@gustri/api-client`**
   - For each wrapper method that performs an `INSERT` or state-changing `UPDATE`, accept an optional `clientRequestId` and write it into the column of the same name. Affects at least: `orders.create`, `order-items.create`, `payments.create`, `refunds.create`, `stock-movements.create`, `waiter-calls.create`, `tasks.create`, `expenses.create`.
   - For mobile mutations that go through `apps/mobile/src/lib/api-routes.ts` (`apiFetch`), add the id to the JSON body.

4. **Server — accept and dedupe**
   - For every `apps/staff-web/src/app/api/v1/*` route that mutates state, read `client_request_id` from the body. Use `INSERT … ON CONFLICT (tenant_id, client_request_id) DO NOTHING RETURNING *`. If `RETURNING` is empty, re-`SELECT` the existing row and return it with HTTP 200 (not 409) so the client treats the replay as success.
   - Update services (`apps/staff-web/src/lib/services/*`) accordingly.

5. **Database migration**
   - New migration `supabase/migrations/<timestamp>_idempotency_keys.sql`:
     - Add `client_request_id uuid` column to: `orders`, `order_items`, `order_payments`, `refunds`, `stock_movements`, `waiter_calls`, `tasks`, `expenses`. Nullable for backfill compatibility.
     - `CREATE UNIQUE INDEX CONCURRENTLY` on `(tenant_id, client_request_id) WHERE client_request_id IS NOT NULL` for each table.
   - Regenerate types: `pnpm db:types:generate`. Commit `packages/database/src/types/generated.ts`.
   - Update Zod input schemas in `packages/database/src/schemas/inputs/` to include the optional `client_request_id` field.

6. **Tests**
   - Unit test in `apps/mobile/src/__tests__/lib/register-mutation-defaults.test.ts`: mutate → simulate failure → replay; assert the same `clientRequestId` is sent both times.
   - Integration test under `packages/api-client/src/__tests__/` (or server-side under `apps/staff-web/src/app/api/v1/__tests__/`): replay a mutation 3× and assert exactly one DB row exists.
   - E2E (maestro) under `apps/mobile/maestro/`: airplane mode → create order → re-enable → kill app → relaunch → assert kitchen sees one ticket.

## Acceptance criteria

- [ ] Every mutating route under `apps/staff-web/src/app/api/v1/*` reads and dedupes on `client_request_id`.
- [ ] Every mobile mutation hook ships a `clientRequestId` in the payload.
- [ ] Migration applies cleanly to a fresh `pnpm db:reset`. `pnpm db:types:check` passes.
- [ ] Unit + integration + maestro tests above are green in `pnpm test` and the maestro suite.
- [ ] `pnpm check` and `pnpm type-check` pass.

## Out of scope

- Backfill historical rows (leave `client_request_id` NULL).
- Idempotency for read-only endpoints.
- Client-side dedup in the mutation cache (the server is authoritative).

## Reporting

When done, summarize: list of files changed, number of routes updated, name of migration file, any deviations from the steps above and why.
