# 🔴 Critical fixes — Mobile

These five items must ship before the next mobile release. Each has the potential to cause cross-tenant data leakage, duplicated financial state, or PII loss on a stolen device.

---

## C1 — Idempotency keys for all mutating endpoints

**Where**
- [apps/mobile/src/lib/register-mutation-defaults.ts](../../apps/mobile/src/lib/register-mutation-defaults.ts)
- [packages/queries/src/mutations/use-order-mutations.ts](../../packages/queries/src/mutations/use-order-mutations.ts)
- Server endpoints: `apps/staff-web/src/app/api/v1/orders/**`, `payments/**`, `refunds/**`, `discount/**`, `stock-movements/**`

**Failure scenario**
Waiter creates an order on a flaky 3G connection. Server commits, but the response is dropped. Mutation pauses. App is force-quit at end of shift. Next morning persister rehydrates and replays — kitchen sees two identical orders, payment recorded twice.

**Fix steps**
1. Add a `client_request_id: string` (UUID v4) to every mutation payload at the *first* attempt and store it with the persisted mutation.
2. Mobile: generate the UUID inside `useMutation`'s `onMutate`; attach to `variables.context.clientRequestId`. Reuse on retry/replay.
3. Server: for each `/api/v1/*` mutating route, accept `client_request_id`; on receipt, `INSERT … ON CONFLICT (tenant_id, client_request_id) DO NOTHING RETURNING *`. If the row already existed, return the original response (200, not 409) so the client treats it as success.
4. Migration: add a unique index on `(tenant_id, client_request_id)` for `orders`, `order_items`, `order_payments`, `refunds`, `stock_movements`, `waiter_calls`, `tasks`, `expenses`. Use `CREATE UNIQUE INDEX CONCURRENTLY`.
5. Update `@gustri/api-client` wrapper methods to accept and forward `client_request_id` for direct-to-Supabase writes that don't go through `/api/v1`.

**Acceptance criteria**
- Replaying any persisted mutation a second time returns the original result, no new row created.
- DB has unique indexes on the listed tables, verified by `pnpm db:types:check`.
- Vitest integration: replay a mutation 3× → server returns the same row, exactly one DB row exists.

**Test plan**
- Unit test in `register-mutation-defaults.test.ts`: mutate → fail → replay; assert single API call's payload contains stable `client_request_id`.
- E2E (maestro): airplane mode → create order → re-enable → kill app → relaunch → assert kitchen sees one ticket, not two.

**Estimate:** 2–3 days (server + client + migrations)

**Dependencies:** none. Land first.

---

## C2 — Tenant-stamped paused mutations to prevent cross-tenant replay

**Where**
- [apps/mobile/src/lib/auth.ts](../../apps/mobile/src/lib/auth.ts) (`cleanupClientState` 150–157)
- [apps/mobile/src/lib/query-persister.ts](../../apps/mobile/src/lib/query-persister.ts) (78–84)
- [apps/mobile/App.tsx](../../apps/mobile/App.tsx) (295–303, `resumePausedMutations`)

**Failure scenario**
Staff A queues a CREATE_ORDER offline. Logs out before the cleanup flush completes (or app crashes). Staff B logs in on the same device. `resumePausedMutations` fires under B's auth context — A's order is created in B's restaurant.

**Fix steps**
1. Stamp every persisted mutation with `{ tenant_id, staff_id }` at `onMutate` time. Add to `variables.context` and ensure `shouldDehydrateMutation` includes it.
2. In `onSuccess` of the persister (App.tsx:295), after hydration, iterate `queryClient.getMutationCache().getAll()` and `cache.remove(m)` any mutation whose stamp doesn't match the freshly-resolved `getCurrentUser()` result. Then call `resumePausedMutations()`.
3. Persist `currentTenantId` next to the cache (small MMKV key, not in the cache blob). On hydration, if `persistedTenantId !== resolvedTenantId`, call `persister.removeClient()` *before* the cache hydrates.
4. Make `cleanupClientState()` blocking on `auth state → loggedOut` transition — the root navigator must `await` it before flipping `staff = null`.
5. Wrap the navigator in a "draining" gate: while `cleanupClientState()` is in flight, show a small loader, not the next screen.

**Acceptance criteria**
- Switching tenants on the same device, with a paused mutation in flight, never produces a write under the new tenant.
- Crash mid-cleanup recovers cleanly: relaunch resolves the live session and discards mismatched mutations before resuming.

**Test plan**
- Vitest: simulate persister hydration with a mismatched stamp → mutation cache empty after `onSuccess`.
- Manual: log in as A, queue a mutation offline (e.g. via NetInfo mock), force-quit, log in as B → mutation does not replay.

**Estimate:** 1.5 days

**Dependencies:** C1 (the idempotency key gives an extra safety net).

---

## C3 — Encrypted MMKV cache + clean unmount on logout

**Where**
- [apps/mobile/src/lib/query-persister.ts](../../apps/mobile/src/lib/query-persister.ts)
- [apps/mobile/src/lib/auth.ts](../../apps/mobile/src/lib/auth.ts) (`cleanupClientState`)
- New: `apps/mobile/src/lib/storage-key.ts`

**Failure scenario**
Tablet stolen overnight. Even with screen lock, attacker pulls `/data/data/<bundle>/files/mmkv/` via ADB and reads orders, customer phone numbers, table maps. Or: re-login as different tenant on the same device renders previously-cached screens for ~1 frame before cleanup completes.

**Fix steps**
1. Add `expo-secure-store` boot step that reads (or creates) a 32-byte random key, persists to Keychain (iOS) / Keystore (Android).
2. Initialize MMKV with this key: `new MMKV({ id: 'gustri-query-cache', encryptionKey })`. Update both the persister and any other MMKV consumers.
3. On install/upgrade detection, drop any pre-existing unencrypted MMKV bundle (cannot be re-read with the new key — it'll fail to decrypt; catch and `removeClient()`).
4. `cleanupClientState()` becomes async-await blocking:
   - cancel all in-flight queries (`queryClient.cancelQueries()`)
   - `queryClient.clear()`
   - `persister.removeClient()`
   - `clearPushTokenSyncCache()`
   - clear Zustand stores explicitly (`useAuthStore.getState().reset()` etc.)
5. Root navigator gates the `auth: 'authenticated'` → `auth: 'guest'` transition on `cleanupClientState()` resolving (small loading spinner during the flip).

**Acceptance criteria**
- MMKV files on disk fail to parse without the Keychain key (verified via `adb pull` + a test script).
- Logout → re-login (different tenant) shows zero frames of the prior tenant's data. Add a Sentry breadcrumb assertion: `tenant_mismatch_render_count = 0`.

**Test plan**
- Manual: pull MMKV file with `adb`, attempt to read with the stock library → fails.
- Maestro: log in A → log out → log in B → assert no orders from A's tenant appear in any list during the transition.

**Estimate:** 2 days

**Dependencies:** none.

---

## C4 — Blocking, queued push-token revocation on logout + server-side token uniqueness

**Where**
- [apps/mobile/src/hooks/use-push-token-sync.ts](../../apps/mobile/src/hooks/use-push-token-sync.ts) (42–54)
- [apps/mobile/src/lib/auth.ts](../../apps/mobile/src/lib/auth.ts) (71–92, `forceLogout`)
- [packages/api-client/src/wrapper/staff.ts](../../packages/api-client/src/wrapper/staff.ts) (102–109, `updatePushToken`)
- New migration: token uniqueness + delete-on-register

**Failure scenario**
Manager logs out at end of shift on a shared loaner tablet. Logout is offline so `updatePushToken(staffId, null)` silently fails (catch-and-continue). Manager from Cafe B logs in next morning. Push notifications for Cafe A still route to the device — order numbers, table layouts, customer names leak across tenants.

**Fix steps**
1. Convert `db.staff.updatePushToken(staffId, null)` into a *queued mutation* (`mutationKey: ['revoke-push-token']`) registered in `register-mutation-defaults.ts`. It survives offline logout via the persister.
2. Make `forceLogout()` `await` the revoke mutation's enqueue (not its completion — the persister handles eventual delivery).
3. On the *next* device-launch with network, the queued revoke fires before any new login replay (rely on FIFO ordering of `resumePausedMutations`).
4. Server side:
   - Migration: unique index on `staff.push_token` (or `staff_push_tokens.expo_token` if normalized) — `CREATE UNIQUE INDEX CONCURRENTLY`.
   - Server route `/api/v1/push-tokens/register`: on insert/update, `DELETE FROM staff_push_tokens WHERE expo_token = $1` (across all tenants) before binding to the new `staff_id`.
   - Add an explicit `revoke` route that does the same delete keyed by `staff_id`.
5. Mobile push-token sync now goes through `/api/v1/push-tokens/register`, not direct Supabase writes. Update wrapper.
6. **[needs-server-confirm]** Audit the backend push dispatcher to confirm every push payload is built from `staff.tenant_id` joined to `staff_push_tokens.staff_id` — never from a raw token list.

**Acceptance criteria**
- Logging in as user B on a device that previously belonged to user A *deletes A's token row before binding B's*. Verified by SQL inspection.
- Offline logout → eventual online → token revoked within 2 minutes of network return.
- Sentry breadcrumb on every revoke success/failure.

**Test plan**
- Vitest integration: register token T to staff A; register T to staff B; assert exactly one row exists, scoped to B.
- Manual: log out offline → restore network → check `staff_push_tokens` row count for that device decreases.

**Estimate:** 2 days

**Dependencies:** C1 (idempotency keys help the queued revoke replay safely).

---

## C5 — Server-side plan enforcement on every plan-aware endpoint  `[needs-server-confirm]`

**Where**
- [apps/mobile/App.tsx](../../apps/mobile/App.tsx) (163–172, `setTenantPlan`)
- [apps/mobile/src/store/auth-store.ts](../../apps/mobile/src/store/auth-store.ts) (`tenantPlan`)
- All `apps/staff-web/src/app/api/v1/*` routes that gate behavior on plan
- All `@gustri/api-client` wrapper methods invoked by gated UI

**Failure scenario**
Attacker decompiles the Hermes bundle (or MITMs the `/tenants` response) and forces `tenantPlan = 'pro'`. Calls a pro-only endpoint (e.g. multi-location reports, advanced refunds) that only checks JWT identity, not plan. Pro features unlocked free.

**Fix steps**
1. Define a server middleware `verifyPlan(allowed: PlanName[])` that:
   - Resolves `tenant_id` from `verifyStaff()` / `verifyAdmin()` (already JWT-derived, never client body).
   - `SELECT plan FROM tenants WHERE id = $1` server-side (cache for 30s in-memory if needed for cost).
   - `if (!allowed.includes(plan)) throw new ForbiddenError('plan_required')`.
2. Audit every `/api/v1/*` route — anywhere the UI hides a button based on `tenantPlan`, the corresponding route gets `verifyPlan(['pro' | 'premium'])`.
3. Audit every `@gustri/api-client` direct-write path that's plan-gated. If a wrapper method exists for a plan-gated resource and there's no server-side check (Supabase RLS-only), promote that resource behind a `/api/v1/*` route or push the plan check into RLS via a `plan_allows_<feature>(tenant_id)` SQL function used in `WITH CHECK`.
4. Keep client-side `tenantPlan` for UI hints only — comment in `auth-store.ts` makes this explicit so future contributors don't trust it.

**Acceptance criteria**
- A test client that lies about `tenantPlan` cannot trigger any plan-gated mutation. Add a Vitest suite that crafts a JWT for a `free` tenant and POSTs to every gated route → all return 403.
- Inventory complete: every UI gate has a matching server check, listed in `apps/staff-web/AUDIT-plan-gates.md`.

**Test plan**
- Server integration tests under `apps/staff-web/src/app/api/v1/__tests__/plan-gates/`: one per gated route.
- Manual: in dev DB, set tenant plan to `free`, drive the app to a pro feature, observe 403 in the network tab.

**Estimate:** 3 days (most of the cost is the route inventory + per-route check)

**Dependencies:** none. Run in parallel with C1–C4.
