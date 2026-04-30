# `@gustri/queries`

Shared TanStack Query hooks consumed by `apps/staff-web`,
`apps/customer-web`, and `apps/mobile`. Each hook wraps a `SupabaseWrapper`
call from `@gustri/api-client`, owns the cache key, and centralises the
fetch contract so the apps don't fork query shapes.

## Conventions

### `enabled` on every tenant-scoped hook

All tenant-scoped read hooks accept an `enabled?: boolean` option (default
`true`). Consumers pass `enabled: !!authReady` (or `!!tenantId`,
`!!staffId`, etc.) to gate the query on auth state. Without this, a query
that fires during the auth-boot window can either error or return the
wrong tenant's rows when the session transitions.

```ts
// List hook with no other args:
useTables({ enabled: !!tenantId });

// List hook with filter object — enabled lives inside the same options:
useOrders({ statuses: ['new', 'preparing'], enabled: !!tenantId });

// Hook with a required positional arg:
useFeedback('pending', { enabled: !!tenantId });

// Single-row hook — gate composes with the existing !!id guard:
useOrder(orderId, { enabled: hasPermissionToView });
```

The `enabled` flag never enters the `queryKey`, so toggling it does not
invalidate or fragment the cache.

### When NOT to gate with `enabled`

- Single-row hooks with a required `id` already guard on `!!id`. Pass
  `enabled` only if you need an *additional* condition.
- Hooks that take naturally-required inputs (search query, QR code,
  email) already guard on the required arg's truthiness; supply
  `enabled` only when adding another condition.

### Mobile-local wrappers

Mobile sometimes wraps a shared hook to inject side effects (realtime
subscriptions, sound, fallback polls) — see `apps/mobile/src/hooks/`.
Those wrappers **forward** `enabled` to the shared hook rather than
reimplementing `useQuery`.

### Query keys

Cache keys come from `QUERY_KEYS` in `./keys.ts`. Never inline a string
literal as a query key — invalidations rely on the shared identifier.
