# C5 — Server-side plan enforcement on every plan-aware endpoint

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. The mobile app stores `tenantPlan` client-side in Zustand and uses it to hide pro features. Nothing on the server checks plan. A modified client (Hermes-decompiled or MITM'd `/tenants` response) can spoof `tenantPlan = 'pro'` and call any plan-gated endpoint — pro features are unlocked free. Read [plans/mobile-audit-2026-04/01-CRITICAL.md](../01-CRITICAL.md) section C5.

This prompt is mostly **server-side work**. The mobile app changes are minor (a comment + audit).

## Implementation steps

1. **Build a `verifyPlan` middleware**
   - New file `apps/staff-web/src/lib/auth/verify-plan.ts` exporting `verifyPlan(allowed: PlanName[])`:
     - Calls existing `verifyStaff()` to resolve `{ tenant_id, staff_id }` from the JWT (never from request body).
     - Looks up `tenants.plan` server-side. Cache the lookup in-process for 30s with a tiny TTL-LRU (e.g. inline `Map` keyed by `tenant_id` with `expiresAt`).
     - If `!allowed.includes(plan)`, throws a typed `ForbiddenError('plan_required')` mapped via the existing `httpStatusToAppError` to 403.
   - Use the existing `PlanName` type from [packages/core/src/](../../../packages/core/src/).

2. **Inventory plan-gated endpoints**
   - Read [packages/core/src/](../../../packages/core/src/) for `PLAN_LIMITS` / plan rules. Compile a list of every feature that the UI hides for non-pro plans.
   - Walk every UI gate in `apps/staff-web/src/` and `apps/mobile/src/`. For each gate, identify the API endpoint(s) it protects.
   - Produce a Markdown inventory file `apps/staff-web/AUDIT-plan-gates.md` listing: feature, plan tier required, server route(s), middleware applied.

3. **Apply `verifyPlan` per route**
   - For every route in the inventory, add `verifyPlan(['pro', 'premium'])` (or the appropriate tier) at the top of the route handler.
   - For wrapper paths that don't go through `/api/v1` (direct-Supabase writes via `@gustri/api-client`), prefer one of:
     - (a) Promote the resource behind a `/api/v1/*` route + middleware.
     - (b) Add an RLS `WITH CHECK` clause that calls a SQL function `plan_allows_<feature>(tenant_id) returns boolean`.
   - Pick (a) for anything financial; (b) for read-heavy or low-risk paths.

4. **Mobile — comment the client-side plan flag**
   - In [auth-store.ts](../../../apps/mobile/src/store/auth-store.ts), add a JSDoc above `tenantPlan`:
     > Client-side plan hint for UI gating only. Never authoritative — the server independently enforces every plan-gated mutation. Do not add new client-only gates without a matching server check.

5. **Tests**
   - For each gated route, add a Vitest test under `apps/staff-web/src/app/api/v1/__tests__/plan-gates/<route>.test.ts`:
     - Free-tier JWT → 403.
     - Pro-tier JWT → 200 (or whatever the success contract is).
   - One smoke test that crafts a body with `tenantPlan: 'pro'` while the JWT is for a free tenant → 403 (proves the body field is ignored).

## Acceptance criteria

- [ ] `verifyPlan` middleware exists and is applied to every gated route.
- [ ] `apps/staff-web/AUDIT-plan-gates.md` lists each feature → route → middleware mapping.
- [ ] Vitest plan-gate suite passes; ≥1 test per gated route.
- [ ] Mobile `auth-store.ts` has the do-not-trust comment on `tenantPlan`.
- [ ] `pnpm check`, `pnpm type-check`, `pnpm test` all pass.

## Out of scope

- Stripe webhook handling for plan transitions.
- Trial logic / grandfather rules.
- Re-architecting the `tenants.plan` column.

## Reporting

Return: list of routes touched, the inventory file, the count of tests added.
