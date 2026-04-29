# 🟡 Medium fixes — Mobile

Correctness, UX, and resilience. Each is small enough to land alongside feature work.

---

## M1 — Suppress duplicate sound when realtime + push fire for same event

**Where:** [apps/mobile/src/hooks/use-orders.ts](../../apps/mobile/src/hooks/use-orders.ts) (75–96), [apps/mobile/src/lib/notifications.ts](../../apps/mobile/src/lib/notifications.ts)

**Fix:** Maintain a small in-memory `Map<eventId, timestamp>`; on realtime payload set the entry; in the foreground notification handler skip sound if entry < 500ms old. Cleanup entries > 5s.

**Acceptance:** Manual test — back-to-back realtime + push for one order plays one sound.

**Estimate:** 0.25 day

---

## M2 — Debounce/serialize `playNewOrderSound`

**Where:** [apps/mobile/src/lib/sound.ts](../../apps/mobile/src/lib/sound.ts) (41–56)

**Fix:** Track `lastPlayedAt`. If called within 300ms, queue at most one replay; drop further calls until the queued one fires. Or use a promise mutex — only one play in flight; subsequent calls coalesce into one.

**Acceptance:** Insert 5 orders in 200ms via SQL; device plays one alert, not five overlapping ones.

**Estimate:** 0.25 day

---

## M3 — Single `tenantPlan` fetch path

**Where:** [apps/mobile/App.tsx](../../apps/mobile/App.tsx) (158–199)

**Fix:** Move both the boot-time and `onAuthStateChange` plan fetches into one auth-store action `loadSession()`. Call it from one place. Eliminate the duplicated `db.tenants.getCurrent()` calls.

**Acceptance:** Network tab shows one `/tenants` call per login (not two).

**Estimate:** 0.25 day

---

## M4 — Convert whole-store Zustand subscribers to selectors

**Where:** [apps/mobile/src/navigation/RootNavigator.tsx](../../apps/mobile/src/navigation/RootNavigator.tsx) (46) and grep `useAuthStore\(\)` without selector across `apps/mobile`.

**Fix:** Replace `const { staff, isLoading } = useAuthStore()` with `const staff = useAuthStore(s => s.staff)` etc. Add a Biome rule banning `useAuthStore()` without a selector via `noRestrictedSyntax`.

**Acceptance:** Profiler shows `RootNavigator` no longer re-renders on `tenantPlan` change.

**Estimate:** 0.5 day

---

## M5 — Persist `useAuthStore` for crash-resilient identity

**Where:** [apps/mobile/src/store/auth-store.ts](../../apps/mobile/src/store/auth-store.ts)

**Fix:** Wrap the store with `zustand/middleware` `persist` backed by `expo-secure-store` (sensitive: staff_id, tenant_id, role). Do *not* persist `tenantPlan` (it's authoritative server-side anyway). On `cleanupClientState()`, call `useAuthStore.persist.clearStorage()`.

**Acceptance:** Crash mid-shift → relaunch resumes the same identity without a brief logged-out flash.

**Estimate:** 0.5 day

**Dependencies:** C3 (secure storage primitive).

---

## M6 — Scope `invalidateOrdersAndTables` to actual transitions

**Where:** [packages/queries/src/invalidation.ts](../../packages/queries/src/invalidation.ts) (22–32)

**Fix:** Accept `(oldStatus, newStatus)`; only invalidate `[QUERY_KEYS.TABLES]` when the transition crosses the `closed`/`!closed` boundary. Same for `[QUERY_KEYS.DELIVERY_ORDERS]` — only on transitions involving `out_for_delivery`/`delivered`.

**Acceptance:** Toggling 10 item statuses on the kitchen screen produces 10 order-list refetches and zero table refetches.

**Estimate:** 0.5 day

---

## M7 — `pending-intent-store` queues, not overwrites

**Where:** [apps/mobile/src/store/pending-intent-store.ts](../../apps/mobile/src/store/pending-intent-store.ts) (15–23)

**Fix:** State becomes `pending: PendingIntent[]`; `setPending` → `addPending`; consumer iterates `consumeAll()`. On replay, drain in arrival order. Cap at 10 to prevent unbounded growth.

**Acceptance:** Two notifications received while logged out → both replay after login (in order).

**Estimate:** 0.5 day

---

## M8 — Captive-portal-aware online detection

**Where:** [apps/mobile/src/lib/online-state.ts](../../apps/mobile/src/lib/online-state.ts) (32–34)

**Fix:** On NetInfo `isConnected: true`, perform a 2-second `HEAD https://<api>/health` (cached for 30s). Only flip `online = true` after success. On failure, treat as offline. Show a "Connected to Wi-Fi but no internet" banner.

**Acceptance:** Connect to a captive-portal hotspot → app stays in offline mode and queues mutations rather than failing them.

**Estimate:** 0.5 day

---

## M9 — Sentry breadcrumb body redaction

**Where:** [apps/mobile/App.tsx](../../apps/mobile/App.tsx) (54–79)

**Fix:** Extend `beforeSend` to walk `breadcrumb.data?.body` (parse if string) and redact known PII fields (`customer_name`, `customer_phone`, `delivery_address`, `email`, `notes`). Replace with `'[redacted]'`. Same in `beforeBreadcrumb`.

**Acceptance:** Triggered error in dev → Sentry event lacks PII fields verifiable by reviewing the captured event.

**Estimate:** 0.5 day

---

## M10 — Tenant-validate deep-link payloads before navigation

**Where:** [apps/mobile/src/lib/navigation-ref.ts](../../apps/mobile/src/lib/navigation-ref.ts) (32–51)

**Fix:** Before dispatching `navigate('OrderDetail', { orderId })`, optimistically peek the cache via `queryClient.getQueryData([QUERY_KEYS.ORDERS])` and confirm `orderId` matches an order belonging to the current tenant. If not in cache, fetch with a tenant filter; if mismatch, route to a generic "Notification expired" screen.

**Acceptance:** Spoofed notification with a foreign `orderId` → no spinner, no RLS-blocked fetch flash, soft-fail screen.

**Estimate:** 0.5 day

---

## M11 — Memoize `MenuManagementScreen` category counts

**Where:** [apps/mobile/src/screens/menu-management/MenuManagementScreen.tsx](../../apps/mobile/src/screens/menu-management/MenuManagementScreen.tsx) (74–76, 215)

**Fix:** Build a `useMemo<Map<categoryId, number>>` keyed on `items`. Reads in O(1) instead of O(items × categories) per render.

**Acceptance:** With 50 items × 10 categories, scroll performance no longer drops on filter toggles.

**Estimate:** 0.25 day

---

## M12 — Tasks screen: server-side filter, not three concurrent queries

**Where:** [apps/mobile/src/screens/tasks/TasksListScreen.tsx](../../apps/mobile/src/screens/tasks/TasksListScreen.tsx) (104–125)

**Fix:** Replace `useTasks` + `useTodaysTasks` + `useMyTasks` with a single `useTasks({ scope })` where `scope: 'all' | 'today' | 'mine'`. The wrapper applies the filter at the SQL level (`@gustri/api-client/tasks.findAll({scope, staff_id})`). Drop in-memory filtering.

**Acceptance:** Tab switching triggers one query, not three. Result identical.

**Estimate:** 1 day (touches wrapper + hook + screen).

---

## M13 — `ReportsScreen` — collapse five `useMemo`s

**Where:** [apps/mobile/src/screens/reports/ReportsScreen.tsx](../../apps/mobile/src/screens/reports/ReportsScreen.tsx) (58–123)

**Fix:** One `useMemo` returning `{ totals, byStaff, byHour, byCategory, byTender }`. Iterate `filteredOrders` once. The staff perf nested `.find()` becomes a `Map<staff_id, Aggregator>` — O(n) instead of O(n × s).

**Acceptance:** Date preset change re-aggregates in one pass; profiler shows a single memo evaluation.

**Estimate:** 0.5 day

---

## M14 — Push permission request with timeout

**Where:** [apps/mobile/src/lib/notifications.ts](../../apps/mobile/src/lib/notifications.ts) (16–46)

**Fix:** `Promise.race([requestPermissionsAsync(), timeout(5000)])`. On timeout, return `'undetermined'`; retry on next AppState `active`.

**Acceptance:** A device that hangs on the permission dialog (rare on custom Android ROMs) doesn't block app boot past 5s.

**Estimate:** 0.25 day

---

## M15 — RLS: restrict broad staff-visibility policy  `[needs-server-confirm]`

**Where:** [supabase/migrations/00000000000000_baseline.sql](../../supabase/migrations/00000000000000_baseline.sql) (line 2791, "Staff can view all staff")

**Fix:** New migration replacing the policy:
```sql
DROP POLICY "Staff can view all staff" ON public.staff;
CREATE POLICY "Staff can view colleagues in tenant" ON public.staff
  FOR SELECT USING (
    is_active_staff()
    AND tenant_id = current_tenant_id()
    AND (current_user_role() IN ('admin','owner') OR id = current_staff_id())
  );
```
Adjust columns visible to non-admins via column-level grants if salary/email leak is a concern.

**Acceptance:** A waiter session selecting from `staff` returns only their own row plus admins (or whatever the spec demands). Verified with the RLS test suite.

**Estimate:** 0.5 day
