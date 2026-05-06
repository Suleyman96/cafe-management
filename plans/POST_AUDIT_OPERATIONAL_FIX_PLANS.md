# Post-audit operational fix plans

Source: final pre-launch operational audit, 2026-05-05. Findings cover the human-factor / multi-device / realtime layer that sits ON TOP of the already-shipped money-safety blockers (`PRE_RELEASE_BLOCKER_FIX_PLANS.md`). Money flows are hardened; this plan addresses the operational chaos that surfaces under Friday-rush conditions.

Ordered by deploy sequence (DB → server → client). Estimated total: **5–6 engineer-days + 1.5 QA-days + 1 staging-soak-day**.

| #  | Title                                                                          | Severity     | Est.   |
|----|--------------------------------------------------------------------------------|--------------|--------|
| 1  | Idempotency on waiter-call `acknowledge` / `resolve`                           | **CRITICAL** | 0.5 d  |
| 2  | Per-button pending lock for kitchen + table actions                            | **CRITICAL** | 0.5 d  |
| 3  | Refund / discount confirm step (amount + table + customer summary)             | **CRITICAL** | 0.5 d  |
| 4  | "Items unpaid" guard on close-order                                            | **CRITICAL** | 0.25 d |
| 5  | Persist payment-modal `client_request_id` across error → retry                 | **CRITICAL** | 0.25 d |
| 6  | Localize sentinel error codes (`payment_exceeds_remaining`, …)                 | **CRITICAL** | 0.5 d  |
| 7  | Optimistic-update TTL revert (zombie patch killer)                             | **HIGH**     | 0.5 d  |
| 8  | `version` column on orders + 409 conflict UI                                   | **HIGH**     | 1 d    |
| 9  | Leader-tab election for audio alerts (no double-buzz)                          | **HIGH**     | 0.25 d |
| 10 | Replay-since-checkpoint on realtime resubscribe                                | **HIGH**     | 1 d    |
| 11 | Hard-block on version skew (>2 min)                                            | **HIGH**     | 0.25 d |
| 12 | "Last updated" timestamp on kitchen / orders list                              | **MEDIUM**   | 0.25 d |
| 13 | Idle-session soft-lock (60 min) for staff-web                                  | **MEDIUM**   | 0.5 d  |
| 14 | End-of-shift reconciliation view (`financial_audit_log`)                       | **MEDIUM**   | 1 d    |
| 15 | Per-event audio mute toggles                                                   | **LOW**      | 0.25 d |

---

## Plan 1 — Idempotency on `waiter_calls.acknowledge` / `resolve` 🚨

**Severity:** CRITICAL. Two waiters can answer the same buzz; second `acknowledged_by` write clobbers first silently.

### Goal
A second acknowledgement of an already-acknowledged call must NOT overwrite the first acknowledger. Same for `resolve`. UI should tell the second waiter "this was just answered by X".

### DB
**New migration** `supabase/migrations/20260506000001_waiter_call_acknowledge_guard.sql`:

```sql
-- Guard rule: acknowledge succeeds ONLY when acknowledged_by IS NULL.
-- Implemented via partial unique index for true serialization (two
-- concurrent UPDATEs both succeed in MVCC — we need a hard guard).

ALTER TABLE waiter_calls
  ADD COLUMN IF NOT EXISTS acknowledged_client_request_id UUID,
  ADD COLUMN IF NOT EXISTS resolved_client_request_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS waiter_calls_ack_dedupe
  ON waiter_calls (tenant_id, acknowledged_client_request_id)
  WHERE acknowledged_client_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS waiter_calls_resolve_dedupe
  ON waiter_calls (tenant_id, resolved_client_request_id)
  WHERE resolved_client_request_id IS NOT NULL;

-- BEFORE UPDATE trigger: reject overwrite of an already-set acknowledger.
CREATE OR REPLACE FUNCTION public.guard_waiter_call_acknowledge()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.acknowledged_by IS NOT NULL
     AND NEW.acknowledged_by IS DISTINCT FROM OLD.acknowledged_by THEN
    RAISE EXCEPTION 'waiter_call_already_acknowledged'
      USING ERRCODE = 'P0002';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER waiter_calls_guard_ack
  BEFORE UPDATE OF acknowledged_by ON waiter_calls
  FOR EACH ROW EXECUTE FUNCTION public.guard_waiter_call_acknowledge();
```

### Server / wrapper
- `packages/api-client/src/wrapper/waiter-calls.ts` — `acknowledge` and `resolve` accept `{ clientRequestId }`; map `P0002` → `ConflictError('waiter_call_already_acknowledged')` via `handleSupabaseError`.

### Hook
- `packages/queries/src/mutations/use-waiter-call-mutations.ts` — auto-stamp `client_request_id` in `onMutate` (mirror `getOrCreateClientRequestId` pattern from `packages/queries/src/idempotency.ts`); `retry: 0`.
- `apps/staff-web/src/hooks/use-waiter-calls-safe.ts` — surface `ConflictError` as a localized toast: "Already answered by {{name}}" (refetch first to get the actual acknowledger name from the row).

### Tests
- Wrapper integration test: two concurrent `acknowledge()` calls — exactly one succeeds, the other gets `ConflictError`.
- Hook test: stamping happens before mutationFn fires.
- E2E: two browser contexts, both click "Answer", second sees the localized toast.

### Risks
- Existing rows with `acknowledged_by` set already are unaffected (trigger only fires on new UPDATEs).
- Mobile parity: `apps/mobile/src/hooks/` doesn't call these yet — verify before launch.

---

## Plan 2 — Per-button pending lock for kitchen + table actions 🚨

**Severity:** CRITICAL. `apps/staff-web/src/app/(staff)/kitchen/page.tsx:175-243` mutates without disabling the tapped button. Stressed staff triple-tap; mutations race or feel frozen.

### Goal
Every action button shows pending state for the duration of its mutation. Per-row, per-button granularity (not a single `canMutate` flag).

### Pattern
Introduce a small hook in `apps/staff-web/src/hooks/use-pending-action.ts`:

```ts
export function usePendingAction<TKey extends string>() {
  const [pending, setPending] = useState<Set<TKey>>(new Set());
  const run = useCallback(
    async <T>(key: TKey, fn: () => Promise<T>): Promise<T | undefined> => {
      if (pending.has(key)) return undefined;       // hard idempotent gate
      setPending((s) => new Set(s).add(key));
      try { return await fn(); }
      finally { setPending((s) => { const n = new Set(s); n.delete(key); return n; }); }
    },
    [pending],
  );
  return { isPending: (k: TKey) => pending.has(k), run };
}
```

### Files touched
- **NEW** `apps/staff-web/src/hooks/use-pending-action.ts`
- `apps/staff-web/src/app/(staff)/kitchen/page.tsx` — wrap `handleApproveOrder`, `handleRejectOrder`, item status mutations, order status transitions.
- `apps/staff-web/src/components/orders/order-detail-actions.tsx` — replace shared `canMutate` with per-action keys (`pay`, `close`, `cancel`, `transfer`, `refund`).
- `apps/staff-web/src/components/orders/order-card.tsx` — same.
- `apps/staff-web/src/components/tables/table-card.tsx` — close, transfer, free.
- `apps/staff-web/src/components/waiter-calls/waiter-call-card.tsx` — answer, resolve.

### UX
- Disabled button shows a localized "…" state via existing `LoadingSpinner` from `@gustri/ui`.
- Buttons re-enable on settle (success or error). Error toast already fires via global mutation cache `onError`.

### Tests
- Component test: rapid triple-click on "Mark Ready" fires mutationFn exactly once until settle.
- E2E: kitchen view, simulate 3 taps within 100ms, assert single network request.

### Risks
- Items pending state is component-local — does NOT persist across navigation. Acceptable: the mutation is in-flight on the network and idempotent server-side; navigating away just loses the pending UX.

---

## Plan 3 — Refund / discount confirm step 🚨

**Severity:** CRITICAL. `apps/staff-web/src/components/modals/refund-modal.tsx:51-57` processes refunds in one tap. £200 misclick is one drag of the finger away.

### Goal
Refunds and manual discount overrides require an explicit confirm screen showing: order #, table label / customer name, refund amount in words, reason. Threshold-gated type-to-confirm above a tenant setting.

### DB
**New migration** `supabase/migrations/20260506000002_tenant_refund_confirm_threshold.sql`:

```sql
ALTER TABLE cafe_settings
  ADD COLUMN IF NOT EXISTS refund_type_to_confirm_threshold NUMERIC DEFAULT 100;
-- Default 100 in tenant currency. Owner can raise/lower in settings UI.
```

### Client
- **NEW** `apps/staff-web/src/components/modals/confirm-refund-modal.tsx` — two-step modal: (1) amount/reason form, (2) confirmation panel showing order summary, customer/table label, amount in localized currency + words (`numberToWords` from `@gustri/i18n/formatters.ts` — add helper), and a "Type 'REFUND {{amount}}' to confirm" input when over threshold.
- `apps/staff-web/src/components/modals/refund-modal.tsx` — replace single-step submit with the new two-step flow.
- `apps/staff-web/src/components/modals/discount-modal.tsx` — same two-step pattern when `discount.type === 'manual_override'`.
- `packages/i18n/src/locales/{en,az,ru,tr}/staff.json` — keys: `refunds.confirmTitle`, `refunds.confirmAmount`, `refunds.confirmTypePrompt`, `refunds.confirmTypeMatch`, `refunds.cancel`, etc.

### UX details
- Cancel during step 2 returns to step 1 with form state intact (no re-typing).
- The "type to confirm" input only renders above threshold; small refunds keep the friction low.
- Both steps share the same `useStableClientRequestId()` instance — already-correct dedupe survives the back-and-forth.

### Tests
- Component test: type-to-confirm input enables submit only on exact-match (case-insensitive, trimmed).
- E2E: tenant with threshold=50, refund of 49 — direct submit; refund of 200 — type-to-confirm required.

### Risks
- New column needs default; no backfill needed.
- Mobile parity: refunds are admin-only and web-only per CLAUDE.md "Intentional mobile-only omissions" — no mobile work.

---

## Plan 4 — "Items unpaid" guard on close-order 🚨

**Severity:** CRITICAL. Closing a served-but-unpaid dine-in is a single tap and silently writes off revenue.

### Goal
Server-side: closing an order with `paid_amount < total` requires explicit `force_close_reason`. Client-side: guard modal asks "Items unpaid (₼{{remaining}}). Close anyway?".

### DB / server
**New migration** `supabase/migrations/20260506000003_close_order_unpaid_guard.sql`:

```sql
CREATE OR REPLACE FUNCTION public.guard_close_order_unpaid()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_paid NUMERIC;
BEGIN
  IF NEW.status = 'closed' AND OLD.status <> 'closed' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_paid
      FROM order_payments WHERE order_id = NEW.id AND voided_at IS NULL;
    IF v_paid < NEW.total - 0.0001 AND NEW.force_close_reason IS NULL THEN
      RAISE EXCEPTION 'order_close_requires_payment_or_reason'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;
  RETURN NEW;
END $$;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS force_close_reason TEXT;

CREATE TRIGGER orders_guard_close_unpaid
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_close_order_unpaid();
```

### Wrapper / hook
- `packages/api-client/src/wrapper/orders.ts` — `close(orderId, { forceCloseReason? })`.
- `apps/staff-web/src/hooks/use-orders-safe.ts` — `useCloseOrder` accepts optional reason.

### Client
- `apps/staff-web/src/components/orders/order-detail-actions.tsx` — "Close" button: if `paid_amount < total`, open `ConfirmCloseUnpaidModal` (new), require reason from a small enum (`comped`, `walk_out`, `staff_meal`, `other` → free-text).
- New file: `apps/staff-web/src/components/modals/confirm-close-unpaid-modal.tsx`.
- i18n keys for reasons.

### Tests
- Wrapper integration test: closing unpaid without reason → `ConflictError`; with reason → success and reason persisted.
- E2E: close button on unpaid order opens guard; selecting reason + confirm closes.

### Reporting hook
The `force_close_reason` column powers the end-of-shift reconciliation view (Plan 14). Categorized write-offs become an auditable column instead of a silent gap.

---

## Plan 5 — Persist payment-modal `client_request_id` across error → retry 🚨

**Severity:** CRITICAL. Cashier sees generic 503 toast → closes modal → reopens → re-pays → card charged twice (idempotency key was reset on modal mount).

### Goal
The modal's `client_request_id` survives error → close → reopen for the same logical attempt. Only resets after a confirmed success or after the user explicitly "starts a new attempt".

### Implementation
The shared hook `packages/queries/src/use-stable-client-request-id.ts` already has `{ get, reset }`. The bug is the *modal* unmount destroys the ref. Fix by hoisting state up:

- **NEW** `apps/staff-web/src/hooks/use-persistent-client-request-id.ts` — keys the id by `(orderId, intent)` and persists in `sessionStorage` (POS tablets reload occasionally, but a refresh during a payment retry should still hit the dedupe path).

```ts
export function usePersistentClientRequestId(scopeKey: string) {
  const storageKey = `crid:${scopeKey}`;
  const get = () => {
    let v = sessionStorage.getItem(storageKey);
    if (!v) { v = randomUUIDv4(); sessionStorage.setItem(storageKey, v); }
    return v;
  };
  const reset = () => sessionStorage.removeItem(storageKey);
  return { get, reset };
}
```

### Files touched
- `apps/staff-web/src/components/modals/payment/payment-modal.tsx` (and `payment-footer.tsx`) — `usePersistentClientRequestId(`payment:${orderId}`)`. Add visible "Start new attempt" link beside "Retry" that calls `reset()` then re-mints.
- `apps/staff-web/src/components/modals/refund-modal.tsx` — `usePersistentClientRequestId(`refund:${orderId}`)`.
- `apps/staff-web/src/components/modals/discount-modal.tsx` — `usePersistentClientRequestId(`discount:${orderId}`)`.
- `apps/staff-web/src/hooks/use-payments-safe.ts` — on success, call `reset()`.

### UX
- Error toast gets a "Retry" action that calls `mutate()` again with the SAME id. Idempotency catches the duplicate; UI lands on the original successful payment.
- "Start new attempt" reset is a separate, intentional action — cashier uses it only when they truly want a different charge (e.g., switching cards).

### Tests
- Hook test: across `useEffect` cleanup + remount, `get()` returns the same string.
- E2E: simulate 503 on first payment, retry succeeds, assert exactly one row in `order_payments`.

### Risks
- `sessionStorage` survives tab reloads but not new tabs — acceptable; a new tab is a new logical session.
- Quota: tiny string per scope; cleanup on success keeps it bounded.

---

## Plan 6 — Localize sentinel error codes 🚨

**Severity:** CRITICAL. Users currently see raw strings like `payment_exceeds_remaining`, `refund_exceeds_available`, `payment_tenant_mismatch` in toasts.

### Goal
All sentinel errors thrown by `@gustri/api-client` map to localized, actionable messages. No raw codes reach the UI.

### Inventory pass
Audit all `RAISE EXCEPTION` strings in `supabase/migrations/` and all `throw new ConflictError(`code`)` in `packages/api-client/`. Build a complete code list (~25–30 codes).

### Files touched
- **NEW** `packages/i18n/src/error-keys.ts` — exports `errorMessageKey(code: string): string` returning the i18n key (e.g., `'errors.payment_exceeds_remaining'`).
- `packages/i18n/src/locales/{en,az,ru,tr}/errors.json` — populate every code with translation; include action hint when applicable ("Refresh the order to see updated balance").
- `apps/staff-web/src/app/providers.tsx` — global mutation `onError`: `toast.error(t(errorMessageKey(error.message)) || error.message)`.
- Same in `apps/customer-web/src/components/providers.tsx`.
- Mobile: `apps/mobile/src/lib/api-routes.ts` — `apiFetch` already maps via `httpStatusToAppError`; add the same localization hook in mobile's toast helper.

### Pattern (translation file shape)
```json
{
  "errors": {
    "payment_exceeds_remaining": "Payment exceeds remaining balance. Refresh the order to see the updated total.",
    "waiter_call_already_acknowledged": "This call was just answered by another team member.",
    "order_close_requires_payment_or_reason": "Order is unpaid. Choose 'Comp' or 'Walk-out' to close it.",
    "version_conflict": "Another device just changed this order. Refresh and try again."
  }
}
```

### Tests
- Lint rule (Biome `noRestrictedSyntax` or a custom script) that fails CI if any `toast.error(rawErrorMessage)` reaches client code without going through `errorMessageKey`.
- Unit test: `errorMessageKey('unknown_code')` returns the code itself (graceful fallback).

### Coverage gate
Required locales per CLAUDE.md i18n rule: `en`, `az`, `ru`, `tr`. PR blocked if missing.

---

## Plan 7 — Optimistic-update TTL revert 🟠

**Severity:** HIGH. `apps/staff-web/src/hooks/use-orders-safe.ts:99-111` intentionally skips rollback. On network death + navigation, stale optimistic patches resurrect from cache.

### Goal
Optimistic patches expire after a configured timeout (default 10s) if `onSettled` hasn't fired. On expiry, the patch is reverted by invalidating the affected keys.

### Implementation
**NEW** `apps/staff-web/src/lib/optimistic-ttl.ts`:

```ts
export function withOptimisticTtl(
  queryClient: QueryClient,
  keys: QueryKey[],
  ms = 10_000,
): () => void {
  const timer = setTimeout(() => {
    for (const k of keys) queryClient.invalidateQueries({ queryKey: k });
  }, ms);
  return () => clearTimeout(timer);
}
```

### Files touched
- `apps/staff-web/src/hooks/use-orders-safe.ts` — in `useUpdateOrderStatus.onMutate`, register a TTL timer; cancel it in `onSettled`. Same for `useUpdateOrderItemStatus`.
- `packages/queries/src/mutations/use-table-mutations.ts` — same.
- `packages/queries/src/mutations/use-waiter-call-mutations.ts` — same.

### Pattern in hook
```ts
onMutate: async (vars) => {
  // existing optimistic patch …
  const cancel = withOptimisticTtl(queryClient, [tenantKey(tid, ORDERS), tenantKey(tid, ACTIVE_ORDERS)]);
  return { previousOrder, cancel };
},
onSettled: (_d, _e, _v, ctx) => { ctx?.cancel?.(); /* existing invalidate */ },
```

### Why 10s
Server P95 + realtime broadcast + network jitter ≪ 10s. If we haven't seen `onSettled` after 10s, the mutation is genuinely orphaned (network down, tab backgrounded, etc.) — invalidation forces a refetch as soon as the network is back.

### Tests
- Vitest fake timers: trigger `onMutate`, advance timer 10s without firing `onSettled`, assert invalidate called.
- Cancel path: `onSettled` within 10s clears the timer; no extra invalidate.

### Risks
- A genuinely slow mutation (>10s) will trigger an unnecessary invalidate; harmless because realtime / refetch converges on truth.

---

## Plan 8 — `version` column on orders + 409 conflict UI 🟠

**Severity:** HIGH. Web + mobile concurrent edits silently overwrite each other; no way to detect.

### Goal
Optimistic concurrency control on `orders`: every UPDATE includes the version the client read; mismatch = `ConflictError`. UI surfaces "Another device just changed this — Refresh / Override".

### DB
**New migration** `supabase/migrations/20260506000004_orders_version_etag.sql`:

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.bump_orders_version()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END $$;

CREATE TRIGGER orders_bump_version
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.bump_orders_version();
```

### Wrapper
- `packages/api-client/src/wrapper/orders.ts` — every mutating method accepts `expectedVersion?: number`. When provided, the UPDATE adds `.eq('version', expectedVersion)`; if 0 rows affected, refetch and throw `ConflictError('version_conflict', { current: row.version })`.

### Hook
- `apps/staff-web/src/hooks/use-orders-safe.ts` — pull `version` off the cached order; pass to the mutation. On `ConflictError('version_conflict')`, surface a localized banner with two actions: **Refresh** (invalidate + close modal) or **Override** (re-issue with the new version).

### Realtime
- `packages/database/src/types/generated.ts` — regenerate to include `version` on the row type.
- Realtime subscriptions automatically deliver the new column; consumers see the bumped version on next event.

### UX
- For status transitions in kitchen view (high concurrency): version check enabled; conflicts trigger a soft toast "Order updated by another device — view refreshed."
- For destructive actions (refund, close, cancel): version check enabled; conflicts open the explicit modal — staff MUST choose Refresh or Override.

### Tests
- Wrapper integration: two concurrent `updateStatus` calls with same `expectedVersion` — exactly one wins, the other gets ConflictError.
- Hook test: ConflictError refetches and exposes the new version to the UI.

### Risks / rollout
- Existing rows get `version=1` — first UPDATE bumps to 2, no migration needed.
- Old client (cached JS) doesn't send `expectedVersion` — wrapper falls back to no-check (current behavior). Forces no breakage during deploy gap. Combine with Plan 11.

---

## Plan 9 — Leader-tab election for audio alerts 🟠

**Severity:** HIGH. Two tabs per staff = double-buzz, double-toast. Staff trains itself to mute.

### Goal
Among open tabs of the same staff member, exactly one (the "leader") plays audio. Visual toasts can stay per-tab; only audio is leader-only.

### Implementation
**NEW** `apps/staff-web/src/lib/realtime/leader-election.ts` — Web Locks API (`navigator.locks.request('staff-audio-lock', { mode: 'exclusive' }, …)`) with `BroadcastChannel` fallback for browsers without locks support.

```ts
export function useIsLeaderTab(lockName = 'staff-audio-leader'): boolean {
  const [isLeader, setIsLeader] = useState(false);
  useEffect(() => {
    if (!('locks' in navigator)) { /* fallback via BroadcastChannel + heartbeat */ }
    const ctrl = new AbortController();
    navigator.locks.request(lockName, { signal: ctrl.signal }, async () => {
      setIsLeader(true);
      // Hold lock until tab unloads.
      return new Promise<void>(() => {});
    }).catch(() => {});
    return () => ctrl.abort();
  }, [lockName]);
  return isLeader;
}
```

### Files touched
- **NEW** `apps/staff-web/src/lib/realtime/leader-election.ts`
- `apps/staff-web/src/components/providers/notification-provider.tsx` — gate `orderAudioRef.play()` and `waiterCallAudioRef.play()` behind `useIsLeaderTab()`. Toasts continue per-tab.

### Tests
- Manual: open two tabs, trigger order — only one beeps.
- Unit: leader hook releases lock on unmount; second tab promotes within 100ms.

### Risks
- Web Locks unsupported on very old browsers — fallback path via `BroadcastChannel` + 2s heartbeat (oldest tab wins). Acceptable.

---

## Plan 10 — Replay-since-checkpoint on realtime resubscribe 🟠

**Severity:** HIGH. WebSocket drop + 30s fallback poll = invisible orders for up to 29s. Audio alerts that fired during the gap are lost forever.

### Goal
On every successful resubscribe, fetch all rows changed since `lastEventAt` and re-fire downstream invalidation + (deduplicated) audio for genuinely-new orders.

### Implementation
- `apps/staff-web/src/hooks/use-realtime-sync.ts` — track `lastEventAt` per channel (already exists at line 206). On `SUBSCRIBED` after a drop:
  1. Compute `since = lastEventAt - 5s` (small overlap to absorb clock skew).
  2. Issue a one-shot query: `db.orders.findChangedSince(tenantId, since)`.
  3. For each row, dispatch the equivalent invalidation as a normal realtime event.
  4. For genuinely-new orders (status `pending_approval` or `new`, `created_at > sessionStartedAt`), enqueue a single "catchup" audio cue (one beep regardless of how many orders) plus a toast: "{{count}} new orders received while disconnected".

### Wrapper
- `packages/api-client/src/wrapper/orders.ts` — `findChangedSince(tenantId: string, since: Date): Promise<Order[]>` selecting on `updated_at > since`.

### Notification dedupe
- `apps/staff-web/src/components/providers/notification-provider.tsx` — track an in-memory `Set<string>` of order IDs already audio-alerted in this session. Replay path checks the set before firing.

### Tests
- Integration: simulate channel drop, mutate orders directly via service-role client, resubscribe → assert catchup query fired with correct `since` and audio fired exactly once.
- Edge case: disconnected for >5 min, replay returns ≤200 rows (cap with `LIMIT 200` to avoid overload); banner suggests manual refresh if cap hit.

### Risks
- Replay window cap protects against long disconnects flooding the client; document the cap visibly.

---

## Plan 11 — Hard-block on version skew (>2 min) 🟠

**Severity:** HIGH. `VersionSkewWatcher` toasts but does not enforce. Stale clients hit new contracts and 400.

### Goal
After a version mismatch detected for >2 min, block all mutations with a full-screen modal "Update required — Reload now". Reads continue.

### Files touched
- `apps/staff-web/src/components/providers/connection-provider.tsx` — track `firstSkewAt`; when `Date.now() - firstSkewAt > 120_000`, set context value `mustReload: true`.
- **NEW** `apps/staff-web/src/components/providers/must-reload-overlay.tsx` — full-screen modal with single "Reload" button calling `window.location.reload()`. Localized strings.
- `apps/staff-web/src/app/providers.tsx` — global mutation `onMutate`: if `mustReload`, throw `AppError('client_outdated')` immediately (no network call).

### Tests
- Manual: deploy a SHA bump on staging, leave a tab open 2+ min, assert overlay appears and mutations short-circuit.

### Risks
- Aggressive — could interrupt mid-edit. Mitigated by 2-min debounce: legitimate deploys are rare events; cashiers very rarely have a 2-min edit in flight.

---

## Plan 12 — "Last updated" timestamp 🟡

**Severity:** MEDIUM. Staff has no signal whether they're seeing fresh state.

### Goal
Kitchen view + orders list show a small "Updated 3s ago" indicator that turns amber if >30s and red if >120s (matching realtime fallback thresholds).

### Implementation
- **NEW** `apps/staff-web/src/components/common/freshness-indicator.tsx` — accepts `lastEventAt: number`; renders relative time, refreshes every second.
- `apps/staff-web/src/app/(staff)/kitchen/page.tsx` — render in header.
- `apps/staff-web/src/app/(staff)/orders/page.tsx` — render in header.
- `apps/staff-web/src/hooks/use-realtime-sync.ts` — already tracks `lastEventAt`; expose via context.

### i18n
- `freshness.justNow`, `freshness.secondsAgo`, `freshness.minutesAgo`, `freshness.stale`.

---

## Plan 13 — Idle-session soft-lock (60 min) 🟡

**Severity:** MEDIUM. Tablet left at host stand stays authenticated indefinitely.

### Goal
After 60 min of no input on a staff-web tab, blur the UI and require PIN re-entry. Cached realtime continues so the moment the user returns, the tab is up-to-date.

### Implementation
- **NEW** `apps/staff-web/src/components/auth/idle-soft-lock.tsx` — listens for `mousemove`/`keydown`/`touchstart`; resets 60-min timer. On expiry, mounts a backdrop with `<PinPrompt />`.
- **NEW** PIN field on `staff` table (`pin_hash` NULLABLE, bcrypt). Owner sets PINs via existing staff CRUD UI.
- **NEW** migration `supabase/migrations/20260506000005_staff_pin.sql` — `pin_hash TEXT, pin_set_at TIMESTAMPTZ`.
- New endpoint `apps/staff-web/src/app/api/v1/staff/verify-pin/route.ts` — accepts `{ pin }`; verifies against current session's staff row; returns 200/401.

### Configurability
- `cafe_settings.idle_soft_lock_minutes INT DEFAULT 60` — owner can tune.

### Tests
- E2E: simulate 60 min of idle (advance fake clock), assert backdrop; correct PIN clears it; wrong PIN keeps it.

### Risks
- Mobile parity: defer; mobile uses device-level lock screen.
- Customer-web is unaffected.

---

## Plan 14 — End-of-shift reconciliation view 🟡

**Severity:** MEDIUM. `financial_audit_log` exists but no surfaced "did the shift balance?" view.

### Goal
Closing manager runs a daily report: total orders, total payments by method, total refunds, total comps (`force_close_reason`), and a per-staff breakdown. Discrepancies between expected (sum of order totals) and actual (sum of payments + refunds + comps) are highlighted.

### Implementation
- **NEW** route `apps/staff-web/src/app/(staff)/reports/shift-reconciliation/page.tsx`.
- Wrapper method on `packages/api-client/src/wrapper/reports.ts` (new file): `getShiftReconciliation(tenantId, dateRange)`.
- DB-side: a `reconciliation_view` materialized or regular SQL view in `supabase/migrations/20260506000006_reconciliation_view.sql`.
- Print-friendly layout (existing `print:` Tailwind classes); CSV export via `@gustri/core/csv` (new helper).

### i18n
- All column labels and currency formatting via existing `formatters.ts`.

### Mobile
- Read-only summary card on mobile per CLAUDE.md mobile-parity rule (admin/org tasks omitted; reporting summary OK).

---

## Plan 15 — Per-event audio mute toggles 🟢

**Severity:** LOW. Currently a single global mute; staff disables ALL audio when one channel is annoying.

### Goal
Three independent toggles in the notification settings: Orders, Waiter Calls, Alerts.

### Implementation
- `apps/staff-web/src/components/providers/notification-provider.tsx` — split single `audioEnabled` into `audioEnabledOrders`, `audioEnabledWaiterCalls`, `audioEnabledAlerts`. Persist in `localStorage` per staff member.
- `apps/staff-web/src/components/header/audio-toggle.tsx` — replace single button with a dropdown.
- i18n keys.

---

## Cross-cutting items

### Test infrastructure
- All concurrency tests (Plan 1, Plan 8) use the existing `packages/api-client/src/__tests__/helpers/mock-supabase.ts` extended with a `concurrentExec(fn, n)` helper.
- E2E (Playwright) coverage in `apps/staff-web/e2e/operational-rush.spec.ts` simulating: parallel kitchen taps, tab leader election, version conflict UI.

### Telemetry
- Each new error code (`waiter_call_already_acknowledged`, `version_conflict`, `client_outdated`, `order_close_requires_payment_or_reason`) emits a Sentry breadcrumb with `tenant_id` and `staff_id` so we can spot operational hotspots post-launch.

### Migration ordering
All DB migrations land in a single deploy window. Sequence:
1. `20260506000001_waiter_call_acknowledge_guard.sql`
2. `20260506000002_tenant_refund_confirm_threshold.sql`
3. `20260506000003_close_order_unpaid_guard.sql`
4. `20260506000004_orders_version_etag.sql`
5. `20260506000005_staff_pin.sql`
6. `20260506000006_reconciliation_view.sql`

Each is paired with a rollback under `supabase/migrations/_rollbacks/`. After applying, run `pnpm db:types:generate` and commit the regenerated `packages/database/src/types/generated.ts` — CI's `db:types:check` will fail otherwise.

### Rollout sequence
1. **Day 1**: DB migrations + wrapper changes (Plans 1, 4, 8). No client behavior change yet.
2. **Day 2**: Client guards (Plans 2, 3, 5, 6) — most user-visible work.
3. **Day 3**: Realtime hardening (Plans 7, 9, 10, 11).
4. **Day 4**: Admin features (Plans 12, 13, 14, 15).
5. **Day 5**: QA pass on staging with realistic data + simulated network failures (`tc qdisc` for packet loss / latency).
6. **Day 6**: 24-hour staging soak with synthetic load (10 orders/min, periodic kill of realtime).

### Feature-flag gates
Per CLAUDE.md feature-flag rule, the following ship behind `feature_flags`:
- Plan 8 (`version` conflict UI) — flag `orders_optimistic_concurrency`. Default OFF; enable per-tenant after a week of stable telemetry.
- Plan 11 (hard-block on skew) — flag `client_outdated_hard_block`. Default OFF; enable globally after first uneventful deploy with the toast-only path.
- Plan 13 (idle soft-lock) — flag `idle_soft_lock_pin`. Default OFF; tenants opt in via owner setting.

All other plans ship without flags — they fix observable bugs and have safe defaults.

### Definition of done
- All migrations applied and types regenerated.
- All new toasts and error paths covered in `en`, `az`, `ru`, `tr`.
- Concurrency tests in CI; E2E rush-simulation passes.
- Sentry dashboards updated with the 4 new error codes.
- Runbook entry in `docs/runbooks/operational-incidents.md` for each: detection signal → likely cause → mitigation.
