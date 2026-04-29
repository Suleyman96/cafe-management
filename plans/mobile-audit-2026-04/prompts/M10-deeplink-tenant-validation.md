# M10 — Tenant-validate deep-link payloads before navigation

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. [navigation-ref.ts](../../../apps/mobile/src/lib/navigation-ref.ts) lines 32–51 routes by `orderId`/`tableId` from notification payloads without validating tenant ownership. RLS blocks the actual fetch, but the screen mounts with a foreign id, causing UX flicker and exposing a small spoof surface. Read [plans/mobile-audit-2026-04/03-MEDIUM.md](../03-MEDIUM.md) section M10.

## Implementation steps

1. **Pre-navigation tenant check**
   - In `handleNotificationNavigation(data)`, before dispatching the route:
     - For order targets: peek `queryClient.getQueryData([QUERY_KEYS.ORDERS])` for a matching `id`. If present and `tenant_id !== currentTenantId`, route to a generic "expired notification" screen.
     - If not in cache, fetch via `db.orders.findById(id)` (RLS-guarded). If 404 or wrong tenant, route to expired screen.
   - Same pattern for tables, waiter calls.

2. **New "expired notification" screen**
   - Create `apps/mobile/src/screens/system/NotificationExpiredScreen.tsx` with a friendly message and a "Back" button. i18n keys: `notification.expired.title`, `notification.expired.body`. Locales: `en`, `az`, `ru`, `tr`.

3. **Tests**
   - Vitest: mock cache with a foreign-tenant order → `handleNotificationNavigation` routes to expired screen.
   - Vitest: matching order → routes to OrderDetail.

## Acceptance criteria

- [ ] Foreign-tenant deep-links route to a generic screen, never to a sensitive detail screen.
- [ ] Tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.

## Out of scope

- Cryptographic signing of notification payloads (server-side concern).
