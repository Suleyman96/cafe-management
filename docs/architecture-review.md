# Gustri Architecture Review

**Date:** 2026-04-18
**Reviewer:** Senior Tech Architect / System Engineer

---

## Overall Verdict

The architecture is solid for a startup/early-stage product. The monorepo structure, package separation, type safety, and Supabase integration are well done. But there are real problems that will hurt as you scale.

---

## SECURITY — Issues That Need Immediate Attention

### Critical

**1. Public SELECT policies leak data across tenants**

Categories and menu_items RLS policies use `USING (true)` — meaning ANY user (authenticated or anonymous, from ANY tenant) can read ALL menu data from ALL restaurants in the database. This completely breaks multi-tenant isolation.

**Status: FIXED** — Migration `20260418000001_fix_security_issues.sql` replaces permissive policies with scoped RLS + RPC functions.

**2. Anonymous users can read payment records**

The `anon_read_via_context` policy on `order_payments` lets QR-scanning customers see payment amounts, methods, and staff names. Customers should never see payment data.

**Status: FIXED** — Anon SELECT blocked on `order_payments` and `customer_feedback`.

**3. No middleware-based route protection**

Staff-web has no `middleware.ts`. All auth is client-side via `ProtectedRoute` component. Pages briefly flash before redirect on unauthorized access. Server-side data can potentially be fetched without auth.

**Status: FIXED** — Added Next.js middleware with `@supabase/ssr` for cookie-based server-side auth validation.

### High

**4. No server-side rate limiting**

API routes (`/api/staff`) have zero rate limiting. Anyone with a valid admin token can hammer endpoints.

**Status: FIXED** — In-memory sliding window rate limiter added (10/min for staff CRUD, 5/5min for password reset).

**5. Anonymous context validation is weak**

If `set_table_context()` isn't called, `current_setting('app.current_tenant_id', true)` returns NULL, and RLS policies may fail open.

**Status: FIXED** — Switched to RPC functions for anonymous data reads (SECURITY DEFINER, parameterized by table_id/order_id).

---

## PERFORMANCE — What Will Hurt at Scale

### Database

**6. Missing critical composite indexes**

Missing obvious indexes:
- `orders(tenant_id, status)` — every tenant-scoped order list query does a full scan
- `order_items(order_id, status)` — kitchen display queries are slow
- `staff_schedules(staff_id, date)` — schedule lookups
- `tasks(assigned_to, status)` — task assignment queries

Won't matter with 100 orders. Will absolutely matter with 100,000.

**Status: NOT YET FIXED**

**7. No pagination in most list queries**

Wrapper methods like `findAll()` return ALL records. `orders.findAll()` with no limit fetches every order ever created for that tenant. As data grows, this becomes a real problem. `limit` support exists in some wrappers but is optional and rarely used by hooks.

**Status: NOT YET FIXED**

**8. Image optimization disabled**

`apps/customer-web/src/components/menu/menu-item-card.tsx` uses `unoptimized={true}` on Next.js Image. Full-resolution Supabase images are served to mobile devices. This kills page load time for customers.

**Status: NOT YET FIXED**

**9. Duplicate real-time subscriptions**

The `NotificationProvider` subscribes to orders/waiter_calls globally, AND individual pages subscribe to the same tables again. Doubling Supabase Realtime connections and processing events twice.

**Status: NOT YET FIXED**

---

## SCALABILITY — Architectural Limits

**10. No offline support on mobile**

Zero offline capability. `persistSession: true` keeps auth alive, but if a waiter loses WiFi in the middle of a busy restaurant, the entire app becomes unusable. For a restaurant app, this is a real-world problem.

**Status: NOT YET FIXED** (large effort)

**11. DECIMAL(10,2) will overflow**

If you expand to countries with high-denomination currencies (e.g., Indonesian Rupiah, Vietnamese Dong), price columns max out at 99,999,999.99. Should use `DECIMAL(14,4)`.

**Status: NOT YET FIXED**

**12. Supabase as the only backend**

No API layer between frontend and database. Everything goes through Supabase's PostgREST. This means:
- Complex business logic lives in client-side hooks (plan limit checks, discount validation)
- Can't add a queue, background jobs, or webhooks without a separate service
- Locked into Supabase's pricing and scaling model

Fine for now, becomes a constraint when you need async processing (e.g., receipt emails, inventory alerts, reporting jobs).

**Status: ARCHITECTURAL — no fix planned**

**13. React Query stale time is aggressive**

Staff-web uses `staleTime: 30s` globally plus `refetchInterval: 10s` on active orders. Combined with Realtime subscriptions that invalidate caches, generating a lot of unnecessary refetches. In a busy restaurant with 20 browser tabs open, this multiplies fast.

**Status: NOT YET FIXED**

---

## MAINTAINABILITY — What Makes Future Dev Harder

### Good Things

- Monorepo structure with clear package boundaries
- Type safety end-to-end (Database types -> Zod schemas -> API wrapper -> hooks)
- Consistent hook naming convention (`*-safe.ts`)
- Centralized query keys and error handling
- i18n support for 18+ languages
- Biome over ESLint (faster, simpler)
- Good test coverage (~98 test files)

### What Needed Work

**14. No React Error Boundaries anywhere**

If any component throws, the entire app white-screens. Production risk. Need at least a root-level error boundary in each app's layout.

**Status: FIXED** — Added `error.tsx` and `global-error.tsx` to staff-web and customer-web. Added class-based `ErrorBoundary` to mobile app.

**15. The UI package is almost empty**

`@gustri/ui` had just `Button` and `LoadingSpinner`. Staff-web and customer-web each had their own `components/ui/` with duplicated base components. Confusion about where to put new components.

**Status: FIXED** — Moved `Badge`, `NumberInput`, `GustriLogo` to `@gustri/ui`. Deleted 7 duplicate files. Updated ~38 import paths. Customer-web now imports from `@gustri/ui`.

**16. No optimistic updates**

Every mutation waited for server response before updating UI. For a real-time restaurant app where waiters tap status buttons rapidly, this creates noticeable lag.

**Status: FIXED** — Added optimistic updates to `useUpdateOrderStatus`, `useUpdateOrderItemStatus`, `useUpdateTableStatus` with rollback on error.

**17. 65+ migration files with security fixes layered on top of each other**

Migration history shows multiple rounds of "fix RLS", "fix RLS again", "enable RLS production". Hard to audit. Should squash into a clean baseline.

**Status: DEFERRED** — Planned for a dedicated branch.

**18. Mobile app uses React 19 while web apps use React 18**

`apps/mobile/package.json` has `react: 19.1.0` while web apps have `react: ^18.3.0`. Expo 54 requires React 19 so can't downgrade.

**Status: FIXED** — Widened `packages/ui` peer dependencies to `^18.2.0 || ^19.0.0`.

---

## Priority Action List (Remaining)

| Priority | Issue | Effort |
|----------|-------|--------|
| **P1** | Add composite database indexes (#6) | 1 hour |
| **P1** | Fix image optimization (#8) | 30 min |
| **P2** | Implement pagination in list queries (#7) | 4-6 hours |
| **P2** | Deduplicate real-time subscriptions (#9) | 2-3 hours |
| **P2** | Squash migration files (#17) | 2 hours |
| **P3** | Reduce aggressive refetch intervals (#13) | 1-2 hours |
| **P3** | Upgrade DECIMAL precision (#11) | 1 hour |
| **P3** | Plan for offline mobile support (#10) | Large |
