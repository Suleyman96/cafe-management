# H9 — Re-verify JWT tenant claim against the `tenants` table  `[server-side]`

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. `verifyStaff()` and `verifyAdmin()` (in `apps/staff-web/src/lib/auth/`) trust the `tenant_id` JWT claim without cross-checking it against the database. A compromised JWT with a swapped `tenant_id` could route an admin from one cafe to another's data. Read [plans/mobile-audit-2026-04/02-HIGH.md](../02-HIGH.md) section H9.

## Implementation steps

1. **Locate auth helpers**
   - Read `apps/staff-web/src/lib/auth/verify-staff.ts`, `verify-admin.ts` (or whichever files implement the existing checks). Document their current behavior in the PR.

2. **Cross-check claim against `tenants` and `staff` tables**
   - After extracting JWT claims:
     - `const tenant = await db.tenants.findById(claims.tenant_id)` — if null, throw 403 (`'invalid_tenant'`).
     - `const staff = await db.staff.findById(claims.sub)` — if null or `staff.tenant_id !== claims.tenant_id`, throw 403 (`'tenant_claim_mismatch'`).
   - Cache lookups in-process for 30s with a tiny TTL-LRU keyed by `(staff_id, tenant_id)` — use existing utility if any, otherwise inline `Map<string, { value, expiresAt }>`.

3. **Sentry alerting**
   - On every mismatch, call `Sentry.captureMessage('tenant_claim_mismatch', { level: 'warning', extra: claims })` so we hear about exploits attempts.

4. **Tests**
   - Vitest: a JWT with a `tenant_id` claim that doesn't match the `staff` row → 403.
   - Vitest: a valid JWT → 200 (smoke).
   - Latency test: warm cache, 100 sequential requests should add <5ms total over baseline.

## Acceptance criteria

- [ ] `verifyStaff` and `verifyAdmin` cross-check `tenant_id` against `tenants` + `staff`.
- [ ] In-process LRU cache used; 30s TTL.
- [ ] Mismatch fires Sentry warning.
- [ ] Tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.

## Out of scope

- Rotating signing keys.
- Reworking JWT claim shape.
