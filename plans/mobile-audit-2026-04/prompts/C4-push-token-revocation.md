# C4 — Blocking push-token revocation + server-side token uniqueness

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. On logout, mobile calls `db.staff.updatePushToken(staffId, null)` with catch-and-continue. If logout happens offline (the common case at end-of-shift on flaky cafe Wi-Fi), the server-side row keeps the token. The next user on the same device receives the previous tenant's notifications — order numbers, table layouts, and sometimes customer names leak across tenants. Read [plans/mobile-audit-2026-04/01-CRITICAL.md](../01-CRITICAL.md) section C4.

## Implementation steps

1. **Convert revoke into a queued mutation**
   - Add a mutation key `MUTATION_KEYS.REVOKE_PUSH_TOKEN` (centralized per H4 if already in flight; otherwise add to the mobile registry).
   - Register a default in [register-mutation-defaults.ts](../../../apps/mobile/src/lib/register-mutation-defaults.ts) whose `mutationFn` POSTs to a new server route `/api/v1/push-tokens/revoke` with `{ staff_id, expo_token }`.
   - Update [auth.ts `forceLogout`](../../../apps/mobile/src/lib/auth.ts) to enqueue the revoke mutation (just `mutate()`, do not `await` completion). The persister will replay it next time the network returns.

2. **Switch register flow to a server route**
   - New server route `apps/staff-web/src/app/api/v1/push-tokens/register/route.ts`:
     - `verifyStaff()` to extract `tenant_id`, `staff_id`.
     - In a transaction: `DELETE FROM staff_push_tokens WHERE expo_token = $1` (across all tenants); then `INSERT … (tenant_id, staff_id, expo_token, platform, last_seen_at)`.
     - Return 200 with the new row.
   - Update [use-push-token-sync.ts](../../../apps/mobile/src/hooks/use-push-token-sync.ts) to call this route via `apiFetch` instead of the direct wrapper write.
   - Keep the mobile-side debounce/dedup cache (`clearPushTokenSyncCache`) but include a 60s time floor (also covered by L4).

3. **New revoke route**
   - `apps/staff-web/src/app/api/v1/push-tokens/revoke/route.ts`:
     - Accept `{ expo_token }` from body. Use `verifyStaff()` to confirm the caller's `staff_id`.
     - `DELETE FROM staff_push_tokens WHERE staff_id = $1 AND expo_token = $2`. Idempotent — return 200 on zero rows affected too.

4. **Database — uniqueness + denormalization audit**
   - Confirm the schema layout: the audit suspects either a `staff.push_token` column OR a normalized `staff_push_tokens` table. Read [supabase/migrations/](../../../supabase/migrations/) and document which one exists in the PR.
   - New migration `supabase/migrations/<ts>_push_token_uniqueness.sql`:
     - If normalized: `CREATE UNIQUE INDEX CONCURRENTLY staff_push_tokens_expo_token_uq ON staff_push_tokens (expo_token);`
     - If denormalized on `staff.push_token`: convert to a normalized table now (one row per device), migrate existing tokens, drop the old column. This is cleaner and required for the cross-tenant DELETE step.
   - Regenerate types: `pnpm db:types:generate`. Commit `packages/database/src/types/generated.ts`.

5. **Server-side dispatcher audit  `[needs-server-confirm]`**
   - Search for code that sends Expo pushes (likely in `apps/staff-web/src/lib/services/notification-service.ts` or similar). Confirm payloads are built by joining `staff` to `staff_push_tokens` filtered by `tenant_id` — never from a free-floating token list.
   - If not, refactor to enforce that join.

6. **Tests**
   - Vitest integration: register token T to staff A; register T to staff B; assert exactly one row exists, scoped to B.
   - Vitest integration: call `/revoke` twice with the same token → both succeed (200), row count goes 1 → 0.
   - Manual: log out offline → restore network → check `staff_push_tokens` for the device.

## Acceptance criteria

- [ ] Push-token register and revoke both go through `/api/v1/push-tokens/*` server routes.
- [ ] Server enforces global Expo-token uniqueness via DB index.
- [ ] Logout offline → token eventually deleted server-side after network recovery.
- [ ] Backend dispatcher is verified to scope by tenant via join, not raw token list.
- [ ] Tests pass; `pnpm check` and `pnpm type-check` pass.

## Out of scope

- Push-token rotation on JWT refresh (separate concern).
- Migrating the table type in this PR if the existing schema is already normalized — only the index migration applies.
