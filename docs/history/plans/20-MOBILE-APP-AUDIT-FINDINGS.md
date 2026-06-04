# Mobile App Audit — 2026-05-07

**Scope:** `apps/mobile` only (Expo 54 / React Native 0.81 / React 19)
**Lens:** performance, realtime/offline, architecture, push, auth, mobile-specific risks, tests, accessibility
**Verdict:** Production-ready. Five small findings; nothing that would block release.

---

## TL;DR

The codebase is in noticeably better shape than typical RN apps at this stage. The previous audit's seven punch-list items are all confirmed fixed in current code, with `Mobile audit #N` breadcrumb comments in place. Realtime, offline persistence, push token lifecycle, and inactivity-lock paths are all carefully built and well-tested.

The new pass surfaces one MEDIUM (a missed instance of the same memo-defeating lambda pattern that audit #1/#2 fixed in `OrderCard`/`TableCard`, but not in `AddItemsScreen`'s menu list), and four LOW items (PII leak risk in a single Sentry path, an unreachable error branch in the offline push-revoke queue, a dead dependency, and one accessibility inconsistency on a button that's labelled in its sibling component).

---

## Findings

### MEDIUM

#### M1 — `AddItemsScreen` inline lambdas defeat `MenuItemCard.React.memo` — ✅ FIXED 2026-05-07

- **File:** [apps/mobile/src/screens/orders/AddItemsScreen.tsx:210-217](apps/mobile/src/screens/orders/AddItemsScreen.tsx#L210-L217)
- **Verified snippet (lines 210–217):**
  ```tsx
  renderItem={({ item }) => (
    <MenuItemCard
      menuItem={item}
      quantity={cart[item.id]?.quantity || 0}
      currencySymbol={currencySymbol}
      onAdd={() => handleAdd(item)}
      onRemove={() => handleRemove(item.id)}
    />
  )}
  ```
- And the parent handlers (lines 80, 95) are plain functions, not `useCallback`:
  ```tsx
  const handleAdd = (item: { id: string; price: number; name: string }) => { ... };
  const handleRemove = (itemId: string) => { ... };
  ```
- **Why it's a problem:** `MenuItemCard` at [apps/mobile/src/components/orders/MenuItemCard.tsx:21](apps/mobile/src/components/orders/MenuItemCard.tsx#L21) is wrapped with `React.memo`, but every keystroke into the cart (a `setCart` for + / − ) re-renders `AddItemsScreen`, which re-creates `handleAdd`/`handleRemove` *and* the inline `() => handleAdd(item)` lambdas — so every visible card receives "changed" prop identities and re-renders. For a long menu (50–150 items, common for full-service restaurants) the waiter sees noticeable jank when tapping +/− on one item. Same anti-pattern as audit #1/#2 fixed in `OrderCard` / `TableCard`; this instance was missed.
- **Fix:** Wrap `handleAdd` / `handleRemove` in `useCallback` (the setters are stable, so the dep list is empty). Then change `MenuItemCard`'s prop signature from `onAdd: () => void` / `onRemove: () => void` to `onAdd: (item) => void` / `onRemove: (id: string) => void`, push the `(item)`/`(id)` capture into the card itself with a per-id `useCallback`, and pass the parent handlers directly. Mirror the pattern used in [OrderCard.tsx:38](apps/mobile/src/components/orders/OrderCard.tsx#L38) and [TableCard.tsx:32](apps/mobile/src/components/tables/TableCard.tsx#L32).
- **Resolution (2026-05-07):** Fixed in [MenuItemCard.tsx:31-35](apps/mobile/src/components/orders/MenuItemCard.tsx#L31-L35) (per-item `useCallback` wrappers) and [AddItemsScreen.tsx:80-120](apps/mobile/src/screens/orders/AddItemsScreen.tsx#L80-L120) (`useCallback`-stabilized `handleAdd`/`handleRemove` plus a memoized `renderMenuItem`). Type-check + biome + 11 related vitest tests all green.
- **Mobile-specific?** Yes — the cost shows up as JS-thread jank on the bridge. Less visible on web's main thread.

---

### LOW

#### L1 — `validateRealtimePayload` ships full row to Sentry, bypassing PII redactor — ✅ FIXED 2026-05-07

- **File:** [apps/mobile/src/lib/realtime-validation.ts:28-33](apps/mobile/src/lib/realtime-validation.ts#L28-L33)
- **Verified snippet:**
  ```ts
  Sentry.captureException(parsed.error, {
    tags: { area: 'realtime-validation', ...meta },
    extra: { payload },
  });
  ```
- And the `beforeSend` redactor at [App.tsx:68-99](apps/mobile/App.tsx#L68-L99) only walks `event.breadcrumbs[*].data` and `event.request.data` — `event.contexts` and `event.extra` pass through untouched.
- **Why it's a problem:** Supabase Realtime delivers the full row in `payload.new`, not just the schema's narrow subset. For `orders` that's `customer_name`, `customer_phone`, `delivery_address`, `customer_notes`, `internal_notes`. On any schema-drift event (the whole *point* of this validator firing), the entire row — including PII — lands in Sentry's `extra.payload`. Failure rate should be near zero, so blast radius is bounded, but the breach class (PII to a third-party error tracker) is exactly what `redactPii` exists to prevent.
- **Fix (smallest):** Pass `payload` through `redactPii` at the call site, e.g. `extra: { payload: redactPii(payload) }`. **Or** narrow what gets reported to just the schema's known fields, which are not PII (`id`, `table_id`, `order_number`, `status`).
- **Mobile-specific?** Affects any client running the same handler, but only mobile uses this code path today.
- **Resolution (2026-05-07):** Took the smallest fix — wrapped the reported payload in `redactPii` at [realtime-validation.ts:36](apps/mobile/src/lib/realtime-validation.ts#L36) and added the rationale to the JSDoc above the function. Added a 2-case test at [apps/mobile/src/__tests__/lib/realtime-validation.test.ts](apps/mobile/src/__tests__/lib/realtime-validation.test.ts) covering both the success path (no Sentry call) and the failure path (PII fields replaced with `[redacted]`). Type-check + biome + new tests all green.

#### L2 — `pending-revokes.ts` 4xx-drop branch is dead code — ✅ FIXED 2026-05-07

- **File:** [apps/mobile/src/lib/pending-revokes.ts:104-115](apps/mobile/src/lib/pending-revokes.ts#L104-L115)
- **Verified snippet:**
  ```ts
  } catch (err) {
    const status = (err as { status?: number } | null)?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      // Server rejected — drop it, retrying won't help.
      Sentry.captureException(err, { ... outcome: '4xx-dropped' });
      drained++;
    } else {
      // Network/5xx — keep for the next drain attempt.
      remaining.push(token);
    }
  }
  ```
- The error thrown by `apiFetchUnauthed` ([api-routes.ts:88-92](apps/mobile/src/lib/api-routes.ts#L88-L92)) goes through `httpStatusToAppError`, which produces `AppError` subclasses whose property is `statusCode`, not `status` (verified at [packages/core/src/errors.ts:5-15](packages/core/src/errors.ts#L5-L15)).
- **Why it's a problem:** `(err as { status?: number }).status` is always `undefined` for the production error shape, so the 4xx branch is unreachable. A token the server permanently rejects (already-revoked → 410, malformed → 400) re-queues forever. Impact is bounded — the queue dedups identical tokens at enqueue time and the unauthed revoke endpoint should rarely 4xx — but it's wasted bytes + battery on every boot drain. The unit test at [pending-revokes.test.ts:53-64](apps/mobile/src/__tests__/lib/pending-revokes.test.ts#L53-L64) masks the bug by mocking with `{ status: 422 }`, which doesn't match the production error shape.
- **Fix:** Read `err.statusCode` instead of `err.status`. Update the test to throw `httpStatusToAppError(422, ...)` (or any `AppError`-derived error) so it exercises the real production shape. While there, prefer `instanceof AppError` so the check survives a future field rename.
- **Mobile-specific?** Yes.
- **Resolution (2026-05-07):** Switched the discriminator to `err instanceof AppError ? err.statusCode : undefined` at [pending-revokes.ts:104-114](apps/mobile/src/lib/pending-revokes.ts#L104-L114) and added a comment explaining the prior bug. Replaced the misleading `{ status: 422 }` mock in the test with a real `httpStatusToAppError(422, …)` throw, and added a sibling 5xx test to cover the retain-and-retry branch independently. All 6 tests in the file pass; full mobile vitest suite (47 files / 243 tests) is green.

#### L3 — Dead `expo-router` dependency + plugin — ✅ FIXED 2026-05-07

- **Files:** [apps/mobile/package.json:44](apps/mobile/package.json#L44), [apps/mobile/app.json:43](apps/mobile/app.json#L43)
- **Verified snippets:**
  - `package.json` line 44: `"expo-router": "~6.0.23",`
  - `app.json` lines 42-43:
    ```json
    "plugins": [
      "expo-router",
      ...
    ]
    ```
- Confirmed *no* imports of `expo-router` (or `expo/router`) anywhere in `apps/mobile/src/`, `App.tsx`, `index.js`, `babel.config.js`, or `metro.config.js`. The app entry is `registerRootComponent(App)` at [index.js:4](apps/mobile/index.js#L4), and navigation goes through `@react-navigation/*` exclusively.
- **Why it's a problem:** Cruft. expo-router pulls in routing scaffolding and bundles its own `app/` filesystem-routing convention — none of which is consumed. Bundle size, plugin-init work, and a misleading signal to anyone reading `package.json`.
- **Fix:** Remove `expo-router` from `dependencies` in `apps/mobile/package.json`, delete the `"expo-router"` plugin entry from `app.json`, and re-fingerprint (`expo prebuild` or whatever your EAS profile runs) to make sure the runtime version policy picks up the change.
- **Mobile-specific?** Yes (Expo-only).
- **Resolution (2026-05-07):** Dropped `expo-router` from [apps/mobile/package.json](apps/mobile/package.json) `dependencies`, the `"expo-router"` entry from `plugins[]` in [apps/mobile/app.json](apps/mobile/app.json), and the leftover `extra.router` config block (also expo-router only). `pnpm install` resolves cleanly; `apps/mobile/node_modules/expo-router` is gone (the lockfile still references it as an *optional* peer of other Expo packages, which is fine — we're not the consumer). Type-check + full vitest suite green. Note: `runtimeVersion.policy` is `fingerprint`, so the next EAS build will auto-bump and OTA users won't get a runtime mismatch.

#### L4 — `OrderItemRow` "Mark Ready" button is missing accessibility metadata — ✅ FIXED 2026-05-07

- **File:** [apps/mobile/src/components/orders/OrderItemRow.tsx:60-68](apps/mobile/src/components/orders/OrderItemRow.tsx#L60-L68)
- **Verified snippet:**
  ```tsx
  {showActions && onMarkReady && (item.status === 'pending' || item.status === 'preparing') && (
    <TouchableOpacity
      style={styles.actionButton}
      onPress={() => onMarkReady(item.id)}
      activeOpacity={0.7}
    >
      <Text style={styles.actionButtonText}>{t('orders.markReady')}</Text>
    </TouchableOpacity>
  )}
  ```
- The functionally-equivalent button in [KitchenOrderCard.tsx:83-94](apps/mobile/src/components/kitchen/KitchenOrderCard.tsx#L83-L94) carries `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityState` *and* a `hitSlop`. This twin in `OrderDetailScreen` has none of them.
- **Why it's a problem:** Inconsistency, not a hard accessibility blocker — VoiceOver/TalkBack will still read the inner `Text`. But the button isn't announced *as a button*, has no expanded accessibility label, and a 28-pixel-tall target with no `hitSlop` is fiddly with assistive tech enabled.
- **Fix:** Mirror the pattern from `KitchenOrderCard.tsx:88-91` — add `accessibilityRole="button"`, `accessibilityLabel={\`${t('orders.markReady')} — ${item.menu_item?.name ?? ''}\`}`, and `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}`.
- **Mobile-specific?** Yes (RN accessibility props).
- **Resolution (2026-05-07):** Added `hitSlop`, `accessibilityRole="button"`, and `accessibilityLabel={\`${t('orders.markReady')} — ${name}\`}` at [OrderItemRow.tsx:60-69](apps/mobile/src/components/orders/OrderItemRow.tsx#L60-L69), reusing the local `name` variable already computed at line 34.

---

## Things checked, no findings

**1. Performance & rendering (other than M1).** `OrderCard` ([line 38](apps/mobile/src/components/orders/OrderCard.tsx#L38)) and `TableCard` ([line 32](apps/mobile/src/components/tables/TableCard.tsx#L32)) both wrap their `onPress` in `useCallback` keyed on the row id — audit #1/#2 confirmed fixed. `KitchenOrderCard`'s inline lambdas (`onPress={() => onStartPreparing(order.id)}`, etc., lines 85/110/129/146) sit *inside* a memo'd component, not as props to one, so they don't defeat memoization. `WaiterCallCard` and `OrderItemRow` are also genuinely memoizable. Zustand consumers use selectors (`useAuthStore((s) => s.staff)`, `useRealtimeStatusStore((s) => s.channels[name])`); no whole-store subscriptions found.

**2. Realtime & offline.** Audit #3's degraded-transition catchup is in place at [use-orders.ts:201-225](apps/mobile/src/hooks/use-orders.ts#L201-L225) — including the explicit `query.refetch()` on the connected→degraded edge. Audit #5's 60s reconnect-replay dedup is in place at [use-orders.ts:86-102](apps/mobile/src/hooks/use-orders.ts#L86-L102) and [use-waiter-calls.ts:37-57](apps/mobile/src/hooks/use-waiter-calls.ts#L37-L57). NetInfo + captive-portal probe ([use-network-status.ts:33-53](apps/mobile/src/hooks/use-network-status.ts#L33-L53)), exponential backoff and post-resume health check ([use-realtime-sync.ts:147-251](apps/mobile/src/hooks/use-realtime-sync.ts#L147-L251)), and `client_request_id`-stamped paused mutations replayed via the persister-then-drain flow ([App.tsx:404-429](apps/mobile/App.tsx#L404-L429), [mutation-drain.ts](apps/mobile/src/lib/mutation-drain.ts)) are all in good shape.

**3. State management split.** Zustand carries identity-only state (`staff`, `tenantPlan`, realtime channel statuses, captive-portal flag, pending-intent queue). Operational data lives entirely in TanStack Query. `partialize` at [auth-store.ts:108](apps/mobile/src/store/auth-store.ts#L108) persists only `staff`; `tenantPlan` is server-authoritative on every cold start. No duplicated state across the two layers.

**4. Architecture / shared-package boundaries.** All four primary screens (`OrdersListScreen`, `KitchenDisplayScreen`, `TablesListScreen`, `WaiterCallsScreen`) consume `@gustri/core`, `@gustri/database`, `@gustri/queries`, `@gustri/i18n`, `@gustri/ui`, `@gustri/api-client`. Wrapper-vs-route distinction is correctly applied (`apiRoutes` for multi-table transactions and elevated-priv operations, `db.*` for everything else). `apiFetch` maps HTTP errors via `httpStatusToAppError` ([api-routes.ts:58-62](apps/mobile/src/lib/api-routes.ts#L58-L62)).

**5. Auth & session.** Auth store persists to `expo-secure-store` (Keychain / Keystore-encrypted) — verified at [auth-store.ts:42-50](apps/mobile/src/store/auth-store.ts#L42-L50). Inactivity lock survives cold starts via encrypted MMKV ([last-active-at.ts](apps/mobile/src/lib/last-active-at.ts)) and is enforced at boot ([App.tsx:264-280](apps/mobile/App.tsx#L264-L280)) before `loadSession`. Cross-tenant detection on `TOKEN_REFRESHED` clears the cache before loading a new session ([auth.ts:191-208](apps/mobile/src/lib/auth.ts#L191-L208)).

**6. Push notifications.** Audit #7's `notification.request.identifier`-keyed dedup is in place at [notifications.ts:39-45](apps/mobile/src/lib/notifications.ts#L39-L45). Token lifecycle (register on boot, re-sync on AppState=active with 60s floor + 7d max-age, revoke on logout via persistent queue that survives offline logout via [pending-revokes.ts](apps/mobile/src/lib/pending-revokes.ts) + drain on next boot from [App.tsx:241-246](apps/mobile/App.tsx#L241-L246)) is genuinely good. Notification payloads carry only operational identifiers (`orderId`, `tableId`, `orderNumber`, `tableNumber`); `notifyWaiterCall` is called with `call.call_type` (a controlled enum), not the free-text `reason`, so the lockscreen banner doesn't carry user-supplied content.

**7. Mobile-specific risks (other than L3).** Sentry redaction strips Authorization headers, `/auth/` breadcrumbs, and request bodies via `redactJsonBody`/`redactPii` ([App.tsx:68-99](apps/mobile/App.tsx#L68-L99)) — covers everything except the L1 `extra` path noted above. OTA updates use `runtimeVersion: fingerprint` ([app.json:73](apps/mobile/app.json#L73)) with a 5s `fallbackToCacheTimeout` ([app.json:78](apps/mobile/app.json#L78)). Deep-link config is declarative ([linking-config.ts](apps/mobile/src/navigation/linking-config.ts)) with tenant-validation before navigating to entity detail screens ([navigation-ref.ts:86-135](apps/mobile/src/lib/navigation-ref.ts#L86-L135)). Hermes/New Architecture are off — defensible on RN 0.81. No `patches/`/`patch-package` smells.

**8. UX under stress.** Sound + haptics both coalesce at 300 ms ([sound.ts:28](apps/mobile/src/lib/sound.ts#L28), [haptics.ts:22](apps/mobile/src/lib/haptics.ts#L22)). Realtime invalidates per-event but RQ deduplicates in-flight queries — fine until profiling proves otherwise. No heavy modals/animations on the JS thread.

**9. Tests & observability.** 44 vitest test files cover hooks (orders/tables/waiter-calls/payments/etc.), library code (event-dedup, haptics, mutation-drain, notifications dedup, pending-revokes, sentry-redaction, sound, storage-key, session-stamp), and stores (auth, pending-intent). Maestro covers login, view-orders, waiter-calls, tenant-switch, and idempotent-order-replay. Sentry tags are present on every realtime/auth/push code path I checked.

**10. Accessibility (other than L4).** `OrderCard`, `TableCard`, `KitchenOrderCard`, `DeliveryOrderCard`, `FilterChipBar`, and `DrawerMenuButton` all carry `accessibilityRole`/`accessibilityLabel`. `hitSlop` only used in three components (`KitchenOrderCard`, `DrawerMenuButton`, `DeliveryOrderCard`) but most touch targets are ≥40 px so it's not a regression; the L4 finding is the one notable inconsistency.

---

## Open questions

1. **Server-side sanitization of `waiter_calls.reason`?** — ✅ CLOSED 2026-05-07. Verified on three layers: column type is `VARCHAR(50)` ([20250101000001_initial_schema.sql:148](supabase/migrations/_archive/20250101000001_initial_schema.sql#L148)), the dedicated text-length-caps migration explicitly notes that varchar-typed columns including `waiter_calls.reason` are already capped by the column type ([20260507000001_customer_text_length_caps.sql:27-29](supabase/migrations/20260507000001_customer_text_length_caps.sql#L27-L29)), and the customer-facing API route validates with Zod `z.string().max(50).optional().nullable()` ([waiter-calls/route.ts:25](apps/staff-web/src/app/api/v1/customer/waiter-calls/route.ts#L25)). RN's `<Text>` is XSS-safe, and the lockscreen banner uses `call_type` (controlled enum), not `reason`. Non-issue.

2. **`renderItem` recreated each render in `OrdersListScreen` / `KitchenDisplayScreen` / `TablesListScreen`** — ✅ FIXED 2026-05-07. Wrapped each in `useCallback<ListRenderItem<…>>` with explicit deps. Now consistent with `WaiterCallsScreen.tsx:60-65`. Files: [OrdersListScreen.tsx:67-72](apps/mobile/src/screens/orders/OrdersListScreen.tsx#L67-L72), [KitchenDisplayScreen.tsx:201-219](apps/mobile/src/screens/kitchen/KitchenDisplayScreen.tsx#L201-L219), [TablesListScreen.tsx:86-98](apps/mobile/src/screens/tables/TablesListScreen.tsx#L86-L98). Type-check + 243 tests still green.

3. **`runDegradedCatchup` deps include the entire `query.data` array.** [use-orders.ts:199](apps/mobile/src/hooks/use-orders.ts#L199) — every realtime invalidate eventually changes the array reference, which re-fires the catchup callback, which in turn diffs against the ref. This is intentional, but in a sustained-storm scenario where realtime is *also* connected (so `isAnyUnhealthy()` returns false at line 173), it's still a recompute-and-no-op every event. **Deferred — needs profiling, not speculation.** The diff is O(orders) per event; with 100 orders × 60 events/min that's 6,000 set-membership checks/min, which is fine in JS. Optimizing without measurement (e.g. by reading `useRealtimeStatusStore` *before* building `fresh`, short-circuiting when healthy) would either miss the case where healthy → degraded transitions don't yet have a refetch in flight, or save microseconds for a cost in correctness clarity. Re-evaluate when (a) profiling shows it on the hot path, or (b) the pattern needs to be replicated for a third resource.

---

## What this audit didn't cover

- **Real-device profiling.** Re-render counts, JS-thread time, frame drops under sustained 30–60 events/min — needs `react-devtools` profiler or Flipper, not LLM reading.
- **Push delivery latency under FCM throttling** for high-event-rate tenants, OEM battery-saver behavior on Android (Xiaomi/Huawei especially), and APNs background delivery semantics. RUNBOOK.md already documents the constraint.
- **Battery cost of degraded-state polling.** 20s × hours of degraded fallback poll is plausibly fine but unmeasured.
- **Native module health under New Architecture.** Hermes/Fabric stay off; would need a flip-and-test to know if anything regresses.
- **OTA rollback under network failure.** EAS handles signing; the rollback story (e.g. crash loop on a bad OTA) is operational, not in-app.
- **Maestro E2E coverage of the realtime-degraded path** specifically — the existing flows cover login / view / waiter-call / tenant-switch / replay but not "kill the WebSocket while the kitchen is watching." Worth a follow-up YAML.
