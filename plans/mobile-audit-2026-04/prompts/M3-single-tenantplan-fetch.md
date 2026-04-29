# M3 — Single `tenantPlan` fetch path

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. [App.tsx](../../../apps/mobile/App.tsx) lines 158–199 calls `db.tenants.getCurrent()` twice — once on boot, once on `onAuthStateChange`. Race-prone and wasteful. Read [plans/mobile-audit-2026-04/03-MEDIUM.md](../03-MEDIUM.md) section M3.

## Implementation steps

1. **Auth-store action**
   - In [apps/mobile/src/store/auth-store.ts](../../../apps/mobile/src/store/auth-store.ts), add `loadSession(staff: Staff | null)`:
     - Sets `staff`.
     - If `staff` is non-null, fetches `db.tenants.getCurrent()` and sets `tenantPlan`.
     - Catches errors → Sentry breadcrumb, leaves `tenantPlan = null`.

2. **Call from one place**
   - In `App.tsx` boot effect: `getCurrentUser().then(loadSession).finally(setIsLoading(false))`.
   - In `onAuthStateChange` callback: `loadSession(staff)`.
   - Delete the duplicated `db.tenants.getCurrent()` calls.

3. **Tests**
   - Vitest: `loadSession(null)` clears `tenantPlan`.
   - Vitest: `loadSession(staff)` sets both `staff` and `tenantPlan`.
   - Manual: confirm one `/tenants` request per login in the network tab.

## Acceptance criteria

- [ ] `loadSession` is the single entry point for setting auth state in mobile.
- [ ] One network call per login.
- [ ] Tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.
