# Mobile Staff App — Audit Findings

**Scope:** `apps/mobile` only (React Native 0.81 / Expo 54 / React 19)
**Date:** 2026-05-07
**Lens:** Performance, realtime/offline, architecture, push, auth, UX-under-load, mobile-specific risks
**Verdict:** Production-ready. Codebase is markedly more mature than typical RN apps at this stage — the issues below are polish, not blockers.

---

## TL;DR — Bottlenecks under real-world load

The app holds up well in the busy-shift scenario (kitchen, 10–60 order events/min). The realtime architecture is genuinely good: exponential backoff, post-resume health check, dual-speed fallback poll, sound coalescing, idempotent mutations.

The two real production bottlenecks:

1. **Inline `onPress={() => onPress(id)}` lambdas in `OrderCard` and `TableCard`** defeat their own `React.memo` wrappers. Every parent re-render re-renders every card. In a busy shift, every realtime event currently re-renders the full visible list (not just the changed row).
2. **Degraded-state recovery has no event backfill.** When realtime exhausts retries, the app flips to a 20s poll. Any INSERT/UPDATE that happened during the outage isn't replayed — it's only filled in whenever the next poll fires. For a 90-second outage, the kitchen can miss order sounds for that window.

Everything else is small.

---

## 1. Performance / re-renders / memory

### 1.1 [MEDIUM] OrderCard inline lambda breaks memoization
- **File:** [apps/mobile/src/components/orders/OrderCard.tsx:57](apps/mobile/src/components/orders/OrderCard.tsx#L57)
- **Code:** `onPress={() => onPress(order.id)}`
- **Problem:** New function identity every render. `React.memo` at line 30 always sees a "changed" prop and re-renders. With FlashList recycling, this also defeats item-level recycling efficiency.
- **Why mobile-specific:** On RN, JS-thread re-renders block bridge calls and gesture responsiveness more visibly than on web.
- **Fix:** Pass `onPress` directly (the parent already memoizes `handleOrderPress` with `useCallback`):
  ```tsx
  // OrderCard.tsx
  onPress={() => onPress(order.id)}  // ← remove
  // Either pass a prebound id from parent, or change the prop signature to () => void
  // and bind in the parent's renderItem via a stable per-id closure cache.
  ```
  Simplest: change `onPress` type to `(id: string) => void`, render row via a wrapper that captures `order.id` once via `useCallback` keyed on id, or hoist a `RowPress` component that uses `useCallback`.

### 1.2 [MEDIUM] TableCard inline lambda — same pattern
- **File:** [apps/mobile/src/components/tables/TableCard.tsx:53](apps/mobile/src/components/tables/TableCard.tsx#L53)
- **Code:** `onPress={() => onPress(table.id)}`
- **Same fix as 1.1.** Tables grid is 2-column FlashList — pain is doubled because each card has more children (status badge, call dot, totals).

### 1.3 [LOW] Haptics not coalesced like sound is
- **File:** [apps/mobile/src/hooks/use-orders.ts:90](apps/mobile/src/hooks/use-orders.ts#L90)
- **Problem:** Sound is throttled to 1 every 300ms in `sound.ts:28`. Haptics fire per-event. In a 60 events/min storm (1/sec), this is fine. In a 5-events-in-200ms burst (e.g. printer-driven catch-up, post-reconnect replay), haptic engine queues vibrations and the device buzzes for seconds.
- **Mobile-specific:** Yes — haptics are a CoreHaptics/Vibrator OS resource, not free.
- **Fix:** Add a 300ms coalescer mirroring `sound.ts` logic.

### 1.4 [INFO — no action] Lists, memoization, selectors are otherwise solid
- All four primary screens (`OrdersListScreen`, `KitchenDisplayScreen`, `TablesListScreen`, `WaiterCallsScreen`) use `FlashList` with stable `keyExtractor`s.
- Zustand consumers use selectors (`useAuthStore((s) => s.staff)`) — no whole-store subscriptions found.
- `KitchenDisplayScreen` uses a `kitchenOrdersRef` pattern ([KitchenDisplayScreen.tsx:61-62](apps/mobile/src/screens/kitchen/KitchenDisplayScreen.tsx#L61)) to keep callbacks stable while reading the freshest list — a deliberate, correct optimization.
- `TablesListScreen` pre-buckets `orderAggregatesByTable` once per data change ([TablesListScreen.tsx:51-66](apps/mobile/src/screens/tables/TablesListScreen.tsx#L51)) — O(orders) instead of O(orders × tables).

### 1.5 [INFO] No subscription leaks found
- Every `useEffect` that subscribes (realtime, AppState, NetInfo, push tokens, intervals) returns a cleanup. Channels are torn down on unmount, on tenant change, and on app foreground (defensive recreate).

---

## 2. Realtime & offline

### 2.1 [MEDIUM] No event backfill on degraded transition
- **File:** [apps/mobile/src/hooks/use-realtime-sync.ts:159-169](apps/mobile/src/hooks/use-realtime-sync.ts#L159-L169)
- **Problem:** When a channel exhausts `MAX_RETRIES = 10` it flips to `degraded` and calls `invalidateAll()`. That triggers a refetch of *current* state, which catches up on UPDATEs and steady-state inserts — but **side effects (sound/haptic/notification) never fire for the orders that arrived during the outage.** The kitchen list shows them; the staff member doesn't *hear* them.
- The fallback in `use-orders.ts:141-173` (`knownOrderIdsRef` diff in degraded state) exists, but it only triggers on the next 20s poll tick, not immediately on transition. So there's a 0–20s silent window after the transition.
- **Mobile-specific:** Yes — sound is the primary alert channel during a busy shift. Web staff can see the screen; mobile staff often have the phone face-down.
- **Fix options (pick one):**
  1. On `degraded` transition, immediately fire the same diff against `knownOrderIdsRef` that the poll fires, so the catch-up sound plays at transition time, not 20s later.
  2. Track `lastEventAt` (already exists, line 101) and on transition fire a `gte('created_at', lastEventAt)` query against orders, then synthesize INSERT events through the same handler.

### 2.2 [LOW] Duplicate INSERT replay on reconnect can re-fire side effects
- **File:** [apps/mobile/src/hooks/use-orders.ts:82-109](apps/mobile/src/hooks/use-orders.ts#L82)
- **Problem:** Realtime can re-deliver an INSERT after a brief disconnect. The 5s `event-dedup` map (`event-dedup.ts:11-12`) covers the realtime↔push race window, but reconnect-replay can land >5s after the original. Result: same order plays its sound twice.
- **Mobile-specific:** Yes — sound spam is more annoying on mobile and harder to dismiss than a web toast.
- **Fix:** Either (a) widen the dedup window for the INSERT path specifically (e.g. 60s, keyed on order id), or (b) check `knownOrderIdsRef` at INSERT-handler time before firing side effects.

### 2.3 [LOW] No explicit data refetch on foreground (relies on focus manager)
- **File:** [App.tsx:120-125](apps/mobile/App.tsx#L120) (RQ focus manager wired to AppState)
- **Problem:** The focus manager only refetches *stale* queries. If a staff member backgrounds for 10s and foregrounds within the stale window, the orders list shows pre-background data until next realtime event or stale boundary. Realtime channel teardown/recreate on foreground (use-realtime-sync.ts:200-220) plus invalidateAll() at line 225 mostly covers this — but the gap between `AppState=active` and the channel being SUBSCRIBED again is where stale UI shows.
- **Mobile-specific:** Yes — backgrounding is constant on mobile, never on web.
- **Fix:** Already mostly handled. Worth verifying that `invalidateAll()` at line 225 fires before any user interaction window.

### 2.4 [INFO — strong] Things to keep
- Two-layer NetInfo detection with captive-portal probe to `/auth/v1/health`, origin-validated ([use-network-status.ts:33-53](apps/mobile/src/hooks/use-network-status.ts#L33))
- React Query `onlineManager` wired to NetInfo
- Mutation persistence in encrypted MMKV (not AsyncStorage), throttled writes ([query-persister.ts:83](apps/mobile/src/lib/query-persister.ts#L83))
- Cross-tenant mutation drain on rehydration ([mutation-drain.ts:13-36](apps/mobile/src/lib/mutation-drain.ts#L13))
- `client_request_id` mandatory on every mutable apiRoute ([api-routes.ts:114-220](apps/mobile/src/lib/api-routes.ts#L114))
- Push-token revoke queue that survives offline logout ([auth.ts:118-128](apps/mobile/src/lib/auth.ts#L118))

---

## 3. Architecture

### 3.1 [INFO — strong] Shared package consumption is clean
- All four primary screens import from `@gustri/core`, `@gustri/database`, `@gustri/queries`, `@gustri/i18n`, `@gustri/ui`, `@gustri/api-client`. No duplicated query logic in `apps/mobile/src`.
- Mobile-only `apiFetch`/`apiRoutes` correctly uses `httpStatusToAppError` so error semantics match the wrapper path ([api-routes.ts:58](apps/mobile/src/lib/api-routes.ts#L58)).

### 3.2 [INFO] Platform branches are minimal and justified
- `Platform.OS === 'ios'` only in `LoginScreen` for `KeyboardAvoidingView`.
- `Platform.OS === 'android'` for notification channel setup and version-gate (correct, both required by platform).
- No suspicious `patches/` or `patch-package` entries.

### 3.3 [INFO] Zustand vs RQ split is clean
- Zustand: identity-only (`staff`, `tenantPlan`, realtime status). Persisted via `expo-secure-store`.
- RQ: all operational data. Persisted via encrypted MMKV.
- No state stored in both layers — no risk of staleness drift.

---

## 4. Push notifications

### 4.1 ~~[MEDIUM] No Android foreground service for active-shift alerts~~ — RESOLVED
- **Audit miss:** Already documented in [RUNBOOK.md:127-195](apps/mobile/RUNBOOK.md#L127) under "Audible-alert constraint: keep the app foregrounded during shift (Android)". Covers iOS/Android delivery semantics, OEM battery-saver caveats, ops guidance, and the deliberate choice not to ship a foreground service. The audit explore agent inferred the constraint from `shouldPlayInBackground: false` in code but didn't open RUNBOOK.md to confirm whether it was already documented. No action required.

### 4.2 [LOW] Notification dedup keys on event id, not notification id
- **File:** [apps/mobile/src/lib/notifications.ts:10-31](apps/mobile/src/lib/notifications.ts#L10)
- **Problem:** Dedup uses `seenRecently(orderId|tableId)` within a 500ms window. If the OS re-delivers the same notification (rare but possible on Android boot or app reinstall), the 500ms window is too narrow. Belt-and-braces: also key on `notification.request.identifier`.
- **Severity:** Low. Expo handles OS-level dedup in practice.

### 4.3 [INFO — strong] Token lifecycle is excellent
- Registered with timeout-bounded permission prompt ([notifications.ts:40-62](apps/mobile/src/lib/notifications.ts#L40))
- Re-synced on every AppState=active (60s floor, 7d max-age dedup)
- **Revoked server-side on logout, even offline** (queue-and-drain via [pending-revokes.ts](apps/mobile/src/lib/pending-revokes.ts)) — prevents the next user on the device from receiving the previous user's notifications. This is rare to see done correctly.
- Composite dedup key `${staffId}:${token}` catches user-switch on same device ([use-push-token-sync.ts:113](apps/mobile/src/hooks/use-push-token-sync.ts#L113))

### 4.4 [INFO] Payloads contain only operational data
- Order: `orderNumber`, `tableNumber`, `orderId` — no customer PII.
- Waiter call payload includes `reason` (free-text). Worth confirming the call-creation form sanitizes this server-side, since it shows up on a lock screen.

---

## 5. Auth / session

### 5.1 [INFO — strong] Session storage is correct
- Auth store persists to `expo-secure-store` (Keychain / Keystore-encrypted), not AsyncStorage. Only `staff` is persisted — `tenantPlan` is server-authoritative on every load. ([auth-store.ts:42-50](apps/mobile/src/store/auth-store.ts#L42))
- Inactivity lock on cold start ([App.tsx:264-277](apps/mobile/App.tsx#L264)) — reads timestamp, immediately clears it (correct ordering, prevents re-trigger), forces logout if budget exceeded.
- Cross-tenant detection on `TOKEN_REFRESHED` ([auth.ts:195-208](apps/mobile/src/lib/auth.ts#L195)) — clears cache before loading new session if user switched.

---

## 6. UX under stress (busy restaurant)

### 6.1 Scenario walkthrough — kitchen, 30 orders/min
- **List rendering:** FlashList + memoized cards = O(changed rows) re-renders, *if* findings 1.1/1.2 are fixed. Today: O(visible rows) per event.
- **Sound:** Coalesced to 1/300ms — correct.
- **Haptics:** Not coalesced — see 1.3.
- **Realtime invalidation:** Per-event `queryClient.invalidateQueries` per query key. Reasonable. Could be debounced to 100ms in storm conditions, but only if profiling shows refetch is the bottleneck.
- **Modals/animations:** None heavy — RN Navigation default transitions only.

### 6.2 [LOW] No debounce on per-event invalidation
- In a 60 events/sec burst (post-reconnect replay), every event triggers a separate invalidate → separate refetch. RQ deduplicates in-flight queries, so this is mostly fine, but every event still walks the cache.
- **Fix:** Only worth doing if profiling shows it. Trust-but-verify with `react-devtools` profiler in a dev build under simulated load.

---

## 7. Other mobile-specific concerns

### 7.1 [INFO] Sentry redaction is comprehensive
- [App.tsx:68-105](apps/mobile/App.tsx#L68): Authorization headers stripped, `/auth/` breadcrumbs filtered, request bodies redacted via `redactJsonBody`/`redactPii`, `token`/`apikey` query params nulled.

### 7.2 [INFO] OTA updates
- Runtime version policy: `fingerprint` ([app.json:73](apps/mobile/app.json#L73)). Correct — auto-bumps on native dep changes.
- 5s fallback-to-cache timeout. No client-side signature verification, but EAS handles this server-side. Acceptable for the threat model.

### 7.3 [INFO] Deep links
- Routes hardcoded in `linking-config.ts`, no parameterized redirect. Pending-intent stash for logged-out deep links is correct.
- Worth a UUID-shape check on `:orderId`/`:tableId` before navigating, but realistically the route handlers will 404 cleanly.

### 7.4 [INFO] Hermes / New Architecture
- Neither enabled. Defensible for stability on RN 0.81 — Fabric/TurboModules is still settling. Not a finding.

### 7.5 [INFO] Assets
- All under 51KB, properly compressed. No bundle bloat.

---

## Prioritized punch list

| # | Severity | Effort | Finding | File |
|---|---|---|---|---|
| 1 | MEDIUM | S | Inline lambda breaks `OrderCard` memo | [OrderCard.tsx:57](apps/mobile/src/components/orders/OrderCard.tsx#L57) |
| 2 | MEDIUM | S | Inline lambda breaks `TableCard` memo | [TableCard.tsx:53](apps/mobile/src/components/tables/TableCard.tsx#L53) |
| 3 | MEDIUM | M | No event backfill on degraded transition (silent gap) | [use-realtime-sync.ts:159-169](apps/mobile/src/hooks/use-realtime-sync.ts#L159) |
| 4 | ~~MEDIUM~~ | — | ~~Document Android backgrounded-shift sound limitation~~ — already covered in [RUNBOOK.md:127-195](apps/mobile/RUNBOOK.md#L127). Audit miss. |
| 5 | LOW | S | Duplicate-INSERT replay re-fires sound | [use-orders.ts:82-109](apps/mobile/src/hooks/use-orders.ts#L82) |
| 6 | LOW | XS | Coalesce haptics like sound | [use-orders.ts:90](apps/mobile/src/hooks/use-orders.ts#L90) |
| 7 | LOW | XS | Add notification.request.identifier to dedup | [notifications.ts:10-31](apps/mobile/src/lib/notifications.ts#L10) |

**Recommended order:** 1, 2, 3 before launch. 5–7 can ride a follow-up. (4 is already
documented in RUNBOOK.md — audit miss, no action needed.)

---

## What this audit didn't cover

- Maestro/E2E test coverage of the realtime degraded path — worth a separate pass.
- Battery impact of fast-poll-while-degraded (20s × ~hours of degraded). Likely fine but unmeasured.
- Push delivery latency under FCM throttling for high-event-rate tenants.
- iOS background modes / VoIP push (intentionally not used — see Intentional mobile-only omissions in CLAUDE.md).
