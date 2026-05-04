# ADR 0001 — Realtime cache strategy: invalidation, not payload writes

- Status: Accepted
- Date: 2026-05-04
- Author: Realtime + cache integrity audit follow-up (#7)

## Context

Staff-web subscribes to Supabase Realtime `postgres_changes` events for live
updates on orders, order_items, tables, waiter_calls, and adjacent tables.
The hook driving this is [`apps/staff-web/src/hooks/use-realtime-sync.ts`](../../apps/staff-web/src/hooks/use-realtime-sync.ts).

A multi-agent audit raised the question: should the hook write the realtime
payload contents straight into the React Query cache via `setQueryData`?
Doing so could elide a refetch and feel snappier under burst traffic. But it
opens a class of races where a stale payload — emitted before a newer payload
that has already been applied — overwrites fresher data, especially across
disjoint subscriptions on the same logical row.

## Decision

**Realtime invalidation is `invalidateQueries` only. We do NOT call
`setQueryData` from a `postgres_changes` handler.**

Refetches against the wrapper (which goes through Postgres via Supabase) are
the source of truth. Realtime tells the cache *something changed* and the
cache pulls a fresh, ordered snapshot.

Concretely, the hook:

- Adds the affected query keys to a `Set` on each event.
- Debounces invalidation by `REALTIME_INVALIDATE_DEBOUNCE_MS` (300ms) so a
  burst of events on the same key produces one refetch, not N.
- On reconnect (`SUBSCRIBED` after a prior CHANNEL_ERROR), invalidates all
  registered keys to catch up — Supabase Realtime has no replay, events
  during the WS-down window are lost.

That's the entire write path. No `setQueryData`. No payload merging. No
`updated_at` comparisons.

## Why this is sufficient today

- **Single-writer Postgres.** This codebase runs one Postgres instance via
  Supabase. There is no read replica with measurable lag, so a refetch right
  after an event sees the committed state.
- **No server-side response cache.** Wrapper calls go straight to Postgres.
  There is no Redis or CDN layer between the client and the row, so refetch
  latency is just network + query.
- **TanStack Query 5 dedupes parallel fetches per query key.** If a debounced
  invalidation triggers a refetch while another is already in flight, both
  observers share the same promise. We don't pay for double-fetching the
  same key under burst traffic.
- **The race the audit imagined doesn't exist here.** It would require either
  (a) replica lag — we have none, or (b) a server cache between us and the
  row — we have none. Adding a `mergeIfNewer(prev, next)` helper to defend
  against a non-existent race would be speculative complexity.

## When this decision should be revisited

Re-open this ADR if any of the following become true:

1. **Read replicas are introduced** (Supabase has them on enterprise tiers; a
   self-hosted variant could add streaming replicas). Realtime events fire
   off the primary; a refetch routed to a lagging replica may not see the
   change yet.
2. **A server-side response cache is introduced** (Redis, CDN edge cache,
   PostgREST-level cache). The `Cache-Control` window can serve a stale row
   to the refetch that the realtime event was supposed to invalidate.
3. **A measured performance need to elide refetches.** If profiling shows
   the burst-and-debounce pattern is bottlenecking dinner-rush UX (today
   it's well under 300ms), trusting payload contents for hot paths becomes
   worth the complexity.

## Minimum-bar fix if any of the above conditions appear

Implement a small `mergeIfNewer(prev, next)` helper in the same file that
compares `updated_at` (or a per-row `version` column if added) and applies
`setQueryData` only when the incoming payload is strictly newer. Cover it
with unit tests that pin both monotonic-write and out-of-order-event cases.

**Do not implement this helper speculatively.** Helpers without callers rot.
The guard test in [`apps/staff-web/src/__tests__/hooks/use-realtime-sync.test.ts`](../../apps/staff-web/src/__tests__/hooks/use-realtime-sync.test.ts)
that asserts `setQueryData` is absent from the hook source will force
whoever introduces it to either consciously update this ADR or pick the
invalidation path and stay consistent.

## Consequences

- (+) Cache writes from realtime are linearizable — Postgres is the only
  ordering authority. No payload race can corrupt the cache.
- (+) The hook stays small; no `mergeIfNewer`, no `updated_at` plumbing
  into payloads, no per-table version columns.
- (−) Each invalidation costs a refetch round-trip. Debouncing absorbs
  burst events; sustained event rates above the debounce window still
  cost one refetch per debounce window per affected key. Acceptable today.
- (−) Anyone tempted to add `setQueryData` from the realtime path has to
  read this ADR or trip the guard test before merging.
