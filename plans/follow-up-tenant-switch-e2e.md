# Follow-up: tenant-switch e2e test

**Created during PR 3 (`ref/mobile-auth-tenant-safety`).**

PR 3 added cross-tenant cache isolation in `apps/mobile/src/lib/auth.ts` —
`onAuthStateChange` now tracks `lastUserId` and calls `cleanupClientState()`
when the identity changes mid-session. We need an e2e test to lock in the
behavior, but the prerequisites aren't in place yet.

## Why deferred

`apps/mobile/maestro/` uses Maestro (`pnpm test:e2e`). Existing flows assume
a single test account (`admin@test.com`). `supabase/seed.sql` seeds one
tenant. To prove tenant isolation we need:

- A second tenant row + at least one staff account scoped to it
- Distinguishable data per tenant (orders, tables) so a leak would be visible
- A Maestro flow that signs in as A, observes A's data, signs out, signs in
  as B, and asserts none of A's data is visible

That's seed work + a flow file — straightforward but separate from the
auth-cleanup change.

## Suggested approach

1. Extend `supabase/seed.sql`:
   - Add a second tenant (`Test Tenant Two`).
   - Add `admin2@test.com` as staff under that tenant.
   - Seed a couple of tenant-scoped rows (e.g. an order with a unique
     customer name) so a cross-tenant leak would be visually obvious.
2. New `apps/mobile/maestro/tenant-switch.yaml`:
   - Sign in as `admin@test.com` → navigate to Tables → assert tenant-A row
   - Tap Profile → Sign out
   - Sign in as `admin2@test.com` → assert tenant-A row is NOT visible
3. Wire into CI alongside the existing Maestro suite.

## Acceptance

The flow fails on `main` if you remove the `cleanupClientState()` call
from the tenant-transition branch in `auth.ts`, and passes after restoring
it.
