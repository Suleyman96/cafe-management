# Decision: keep mobile React Query cache config as-is

**Date:** 2026-04-27
**Context:** Considered as PR 4 from `plans/prompts/mobile-review-02-data-flow-and-state.md`
**Outcome:** Skip PR 4. Current config is correct.

## What was proposed

The data-flow review recommended introducing per-domain cache tiers:

- "hot" / "realtime": `staleTime: 30s`, `gcTime: 2min`
- "reference": `staleTime: 5min`, `gcTime: 10min`

Rationale given: mobile devices have constrained RAM; aggressive `gcTime`
reduces memory pressure. Several hooks were flagged as "missing `staleTime`".

## What's actually in place

[apps/mobile/src/lib/query-client.ts](../apps/mobile/src/lib/query-client.ts):

```ts
defaultOptions: {
  queries: { staleTime: 60_000, gcTime: OFFLINE_GC_TIME /* 4h */, retry: 1 },
  mutations: { networkMode: 'offlineFirst' },
}
```

The "missing staleTime" finding was inaccurate — hooks without explicit
`staleTime` inherit the 60s default. Only `useTables` had a real gap (no
`staleTime` even with the default), which PR 3 fixed with an explicit 30s.

## Why we're not lowering `gcTime`

`gcTime: OFFLINE_GC_TIME` (4 hours) is **paired** with the persister:

[apps/mobile/src/lib/query-persister.ts](../apps/mobile/src/lib/query-persister.ts)
sets `OFFLINE_GC_TIME = 4 * 60 * 60 * 1000` and
[App.tsx](../apps/mobile/App.tsx) passes the same value as `maxAge` to
`PersistQueryClientProvider`.

Lowering `gcTime` to 2 minutes breaks offline navigation:

1. Screen unmounts → query observed-count hits 0
2. After 2 minutes, in-memory cache evicts the query data
3. User navigates back to the screen
4. `useQuery` re-observes, queryFn runs
5. Offline (default `networkMode: 'online'`) → queryFn paused → screen
   shows `{ data: undefined, isLoading: true }`

The `PersistQueryClientProvider` only restores cache **on mount**, not
on subsequent re-observations. AsyncStorage is not a fallback for runtime
queries — it's a snapshot store for cold-start.

The 4h `gcTime` keeps data in memory long enough to survive the typical
shift-length of foregrounded use, which is the design goal.

## When to revisit

Reopen this decision if any of the following hold:

- We add `networkMode: 'offlineFirst'` to query defaults so paused queries
  serve stale data — at that point, lower `gcTime` becomes safe.
- We see actual OOM reports on Android low-end devices (Sentry tag:
  `out-of-memory`) with mobile users.
- We add genuinely large reference data (e.g. an analytics dashboard with
  thousands of rows) where eviction would help.

Until then, the current config is correct for the offline-first goal.

## Outstanding cache work (deferred, not scheduled)

- `useUpdateOrderItemStatus` and waiter-call status flips would benefit
  from optimistic updates with rollback on error. Sub-100ms perceived
  latency for waiters on bad wifi. Low risk because they're status flips,
  not money-touching. Worth ~3h if user-facing perceived speed becomes a
  complaint.
