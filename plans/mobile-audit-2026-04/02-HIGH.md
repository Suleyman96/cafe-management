# 🟠 High-risk fixes — Mobile

These don't leak data, but they cause user-visible operational failures during a busy shift: missed kitchen tickets, lock bypasses, render storms, validation thrash.

---

## H1 — Aggressive fallback when realtime is `degraded`

**Where:** [apps/mobile/src/hooks/use-realtime-sync.ts](../../apps/mobile/src/hooks/use-realtime-sync.ts) (177–186), [packages/core/src/constants.ts](../../packages/core/src/constants.ts) (65–71)

**Failure scenario:** Realtime channel exhausts retries, transitions to `degraded`. Fallback poll is 120s. Twelve orders arrive in that window — none reach the kitchen with sound until the next poll.

**Fix steps**
1. On entering `degraded`, immediately call `queryClient.invalidateQueries(...)` for every channel-bound key (orders, tables, waiter_calls, tasks).
2. Drop poll interval to **20s** while `degraded`. Restore to `FALLBACK` only after `connected`.
3. Show a sticky red banner ("Live updates degraded — refreshing every 20s") that the user cannot dismiss while degraded.
4. Telemetry: emit a Sentry breadcrumb on every status transition with retry count and last-event timestamp.

**Acceptance criteria**
- Maestro: kill the WebSocket → app polls every 20s and surfaces banner. Kitchen sees orders within 25s of insert.
- Sentry shows degraded transitions in production with timing data.

**Estimate:** 0.5 day

---

## H2 — Post-resume health check on AppState foreground

**Where:** [apps/mobile/src/hooks/use-realtime-sync.ts](../../apps/mobile/src/hooks/use-realtime-sync.ts) (147–165)

**Failure scenario:** App backgrounds for 5 min, iOS kills the WebSocket. On resume, `teardownChannel()` throws (rare edge), the new subscribe stalls in `JOINING`. Hook believes itself healthy but is dead. Fallback poll won't run for 2 min.

**Fix steps**
1. After AppState `active`, schedule a 3s timer.
2. At the timer, check `channel.state` — if not `'joined'`, force `invalidateQueries()` once and retry the subscribe.
3. Wrap `teardownChannel()` in try/catch so a thrown unsubscribe never blocks recreation.
4. After H1 lands, also force an immediate invalidation on every resume regardless of channel state — cheap insurance.

**Acceptance criteria**
- Vitest: simulate `teardownChannel` throwing → next subscribe still proceeds → status reaches `connected`.
- Manual: lock device 5 min, resume, verify orders appear within 4s.

**Estimate:** 0.5 day

---

## H3 — Inactivity lock survives OS-lock and force-quit

**Where:** [apps/mobile/src/hooks/use-inactivity-lock.ts](../../apps/mobile/src/hooks/use-inactivity-lock.ts) (17–27)

**Failure scenario:** Tablet stolen, screen auto-locks. App is still authenticated in RAM. Attacker keeps the screen alive (or force-quits and reopens) — full session, no re-auth.

**Fix steps**
1. On every AppState `background` transition, persist `lastActiveAt = Date.now()` to encrypted MMKV (depends on C3 for encryption).
2. On every `active` transition AND on cold-start *after* `getCurrentUser()` resolves, compute `Date.now() - lastActiveAt`. If `> INACTIVITY_TIMEOUT_MS`, call `forceLogout()`.
3. Add an OS-lock detection branch: subscribe to `expo-keep-awake` / native `UIApplicationProtectedDataWillBecomeUnavailable` (iOS) and equivalent Android `SCREEN_OFF` broadcast (small native module, or Expo's `expo-background-task`). On lock, mark `lastActiveAt` immediately so a force-quit-after-lock path is also covered.
4. Reduce `INACTIVITY_TIMEOUT_MS` for the kitchen role specifically — kitchen iPads sit unattended; admin/owner can stay 60 min, waiter 30 min, kitchen 15 min.

**Acceptance criteria**
- Lock device → wait 16 min → unlock → app drops to login screen.
- Force-quit while locked → relaunch → login screen, no cached data visible.

**Estimate:** 1 day

**Dependencies:** C3 (encrypted storage of `lastActiveAt`).

---

## H4 — Centralize mutation-key registry between mobile and `@gustri/queries`

**Where:** [apps/mobile/src/lib/mutation-keys.ts](../../apps/mobile/src/lib/mutation-keys.ts), [apps/mobile/src/lib/register-mutation-defaults.ts](../../apps/mobile/src/lib/register-mutation-defaults.ts), [packages/queries/src/](../../packages/queries/src/)

**Failure scenario:** Developer adds `useCreateExpense` to `@gustri/queries` with a new `mutationKey`. Forgets to wire `setMutationDefaults` in mobile. User creates an expense offline; app crashes. On relaunch, the persisted mutation has no `mutationFn` — silent loss.

**Fix steps**
1. In `packages/queries/src/mutation-keys.ts`, export `MUTATION_KEYS` as the single source of truth (object literal).
2. Each shared mutation hook imports its key from there: `mutationKey: MUTATION_KEYS.CREATE_ORDER`.
3. Mobile's `register-mutation-defaults.ts` iterates `Object.entries(MUTATION_KEYS)` and asserts every one has a registered default. Throw at boot in dev if mismatched; Sentry warn in prod and skip.
4. Delete `apps/mobile/src/lib/mutation-keys.ts` (or make it a thin re-export).
5. Add a CI lint rule (Biome `noRestrictedSyntax`) banning literal `mutationKey: [...]` outside of `packages/queries/src/`.

**Acceptance criteria**
- Adding a new shared mutation without a mobile default breaks the boot in dev (with a useful error pointing to the missing key).
- All existing keys verified registered.

**Estimate:** 1 day

---

## H5 — Validate before `mutationFn`, not inside it

**Where:** [apps/mobile/src/hooks/use-create-order.ts](../../apps/mobile/src/hooks/use-create-order.ts) (17–19), [apps/mobile/src/lib/mutation-defaults.ts](../../apps/mobile/src/lib/mutation-defaults.ts) (11–16)

**Failure scenario:** Bad input (negative qty) → `validateOrThrow` throws inside `mutationFn` → React Query treats it as a transient failure → 3 retries × 1–6s backoff → user waits ~7s for an instant validation error.

**Fix steps**
1. Update `mutationDefaults.retry` predicate: `if (error instanceof ValidationError) return false`.
2. In each mutation hook, prefer validating in the component before calling `mutate()`; the predicate above is the safety net.
3. Add a unit test: a `ValidationError` thrown from `mutationFn` produces zero retries.

**Acceptance criteria**
- Bad input shows the field error within 100ms.
- Network errors still retry as before.

**Estimate:** 0.25 day

---

## H6 — Scope `PendingSyncBadge` mutation predicate

**Where:** [apps/mobile/src/components/PendingSyncBadge.tsx](../../apps/mobile/src/components/PendingSyncBadge.tsx) (16–19)

**Failure scenario:** A root-mounted badge subscribes to *all* mutations with no predicate — every order item toggle, every menu update fires a re-render at the root. Cascades into the navigator tree.

**Fix steps**
1. Pass a `filters` predicate that selects only paused mutations: `{ status: 'pending', predicate: m => m.state.isPaused }`.
2. Memoize the predicate.
3. Verify count is identical to the unfiltered version when paused mutations exist.

**Acceptance criteria**
- React DevTools Profiler shows badge does not re-render on a normal (non-paused) mutation.

**Estimate:** 0.25 day

---

## H7 — Stabilize `renderItem` callbacks across hot list rows

**Where:**
- [apps/mobile/src/screens/orders/OrderDetailScreen.tsx](../../apps/mobile/src/screens/orders/OrderDetailScreen.tsx) (199–209)
- [apps/mobile/src/screens/calls/WaiterCallsScreen.tsx](../../apps/mobile/src/screens/calls/WaiterCallsScreen.tsx) (66–68)
- [apps/mobile/src/components/kitchen/KitchenOrderCard.tsx](../../apps/mobile/src/components/kitchen/KitchenOrderCard.tsx) (41–46)

**Failure scenario:** Memoized cards still re-render on every realtime tick because callback identity changes each parent render. With 50 active orders, every realtime payload re-renders 50 cards.

**Fix steps**
1. Lift handlers to `useCallback` keyed by id: `const handleAck = useCallback((id: string) => { ... }, [stableDeps])`.
2. Card components accept `onPress: (id) => void` and bind the id internally — no closure per row.
3. Verify `KitchenOrderCard` derived state (`activeItems`, `allItemsReady`) is computed in the parent with `useMemo` and passed down (not derived inside the card).
4. Add `displayName` and a custom `areEqual` to `React.memo` only if profiling shows still-leaky equality.

**Acceptance criteria**
- React DevTools Profiler "why did this render": each card re-renders only when its own data changed.
- Frame time during a 10-event burst stays ≤16ms on a Pixel 5a baseline.

**Estimate:** 1 day

---

## H8 — Single global `useNow` ticker

**Where:** [apps/mobile/src/components/ui/TimeElapsed.tsx](../../apps/mobile/src/components/ui/TimeElapsed.tsx) (31–52)

**Failure scenario:** Every `TimeElapsed` ticks at 1Hz independently. With 50 visible cards, that's 50 renders/sec — battery + jank, especially on low-end Android.

**Fix steps**
1. Create `apps/mobile/src/lib/now-ticker.ts` exporting a Zustand store `useNow` with a single `setInterval` started lazily on first subscribe and torn down on last unsubscribe.
2. Default cadence: 30s.
3. For elapsed values < 60s, fall through to a local 1s ticker per component (rare in practice).
4. Replace direct `Date.now()` reads in `TimeElapsed.tsx` with `useNow(s => s.now)`.

**Acceptance criteria**
- Profiler: cards re-render once per 30s, not per 1s, when elapsed > 60s.
- CPU drops measurably on a kitchen screen with 30+ cards visible.

**Estimate:** 0.5 day

---

## H9 — Re-verify JWT tenant claim against the `tenants` table  `[needs-server-confirm]`

**Where:** [apps/staff-web/src/lib/services/refund-service.ts](../../apps/staff-web/src/lib/services/refund-service.ts) (19–29), `apps/staff-web/src/lib/auth/verify-staff.ts`, `apps/staff-web/src/lib/auth/verify-admin.ts`

**Failure scenario:** Compromised JWT with a swapped `tenant_id` claim → server trusts it → admin from one cafe operates on another cafe's data.

**Fix steps**
1. In `verifyStaff()` and `verifyAdmin()`, after extracting claims, do `const tenant = await db.tenants.findById(claims.tenant_id)`. If null, throw 403.
2. (Optional, recommended) `const staff = await db.staff.findById(claims.sub)` and assert `staff.tenant_id === claims.tenant_id`.
3. Cache the lookup in-process for 30s (TTL-LRU) to avoid extra DB hits per request.
4. Add Sentry alert if mismatch ever fires.

**Acceptance criteria**
- A crafted JWT with a `tenant_id` claim that doesn't match the `staff` row → 403.
- Latency overhead < 5ms per request after warmup.

**Estimate:** 0.5 day (server)

---

## H10 — Server-side discount cap by role

**Where:** [apps/staff-web/src/app/api/v1/orders/[id]/discount/route.ts](../../apps/staff-web/src/app/api/v1/orders/[id]/discount/route.ts), `apps/staff-web/src/lib/services/discount-service.ts`

**Failure scenario:** Waiter colludes with customer; applies 99% fixed discount on a 10000 order — economically equivalent to a refund without admin role or audit.

**Fix steps**
1. Per-role caps: `waiter` ≤ 10%, `admin`/`owner` ≤ 100%. Enforce in `discount-service.ts`.
2. Any discount > 20% writes a `financial_audit_log` entry with role, staff_id, order_id, amount.
3. Configurable per tenant (`tenant_settings.max_discount_percent`) — default keeps the cap.
4. Mobile UI: disable discount input above the cap for the current role.

**Acceptance criteria**
- A waiter token POSTing 99% discount → 403 with a typed `discount_cap_exceeded`.
- Audit row written for every above-threshold discount.

**Estimate:** 1 day
