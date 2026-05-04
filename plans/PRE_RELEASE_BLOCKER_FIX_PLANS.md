# Pre-release blocker fix plans

Source: final pre-release audit, 2026-05-04. Ordered by deploy sequence (DB first, then server, then client). Estimated total engineering: 3–4 days for one engineer + 1 day QA + 0.5 day staging soak.

| # | Title | Status |
|---|---|---|
| 1 | `client_request_id` required on money mutations | **DONE** — see PR linked from this branch |
| 2 | Disable retry on money mutations + protect submit buttons | **DONE** — see PR linked from this branch |
| 3 | `ON DELETE RESTRICT` on financial tables + archival path | **DONE** — merged via PR #93 |
| 4 | Realtime reconnect on `visibilitychange` / `online` | **DONE** — `LifecycleBridge` wired in `providers.tsx` |
| 5 | Cross-tab cache & auth sync via `BroadcastChannel` | **DONE** — `CrossTabBridge` + `cross-tab.ts` wired in `providers.tsx` |
| 6 | Atomic mutation + audit insert via single Postgres RPC | **DONE** — branch `blocker-5`, commit `eb9c75a` |
| 7 | `/api/v1/health` + observability hooks | **DONE** — branch `blocker-5` |

---

## Blocker 1 — Make `client_request_id` REQUIRED for money mutations ✅

**Status:** Implemented on branch `blocker-1-required-client-request-id`.

**Goal:** A retry of any money mutation must hit the dedupe path. No quiet bypass.

### Files touched

**Server (Zod schemas → require UUID v4):**
- `apps/staff-web/src/app/api/v1/orders/route.ts`
- `apps/staff-web/src/app/api/v1/orders/[id]/payments/route.ts`
- `apps/staff-web/src/app/api/v1/orders/[id]/refunds/route.ts`
- `apps/staff-web/src/app/api/v1/orders/[id]/discount/route.ts`
- `apps/staff-web/src/app/api/v1/customer/orders/route.ts`
- `apps/staff-web/src/app/api/v1/customer/orders/[id]/items/route.ts` (per item)
- `apps/staff-web/src/app/api/v1/stock/[id]/adjust/route.ts`

**Server (defense-in-depth):**
- `apps/staff-web/src/lib/api/dedupe.ts` — `findOrCreateByClientRequestId` throws `ValidationError` on missing key
- `apps/staff-web/src/lib/services/discount-service.ts` — same guard at the top
- `apps/staff-web/src/lib/api/validate.ts` — surface Zod field errors so clients can detect `client_request_id` specifically
- `apps/staff-web/src/lib/api/response.ts` — `jsonError` accepts an optional structured `details` object

**Schemas:**
- `packages/database/src/schemas/inputs.ts` — `OrderCreateInputSchema`, `OrderPaymentCreateInputSchema`, `StockAdjustInputSchema` all require the key

**Client wrappers (typed required):**
- `apps/staff-web/src/lib/api-routes.ts`
- `apps/mobile/src/lib/api-routes.ts`
- `apps/customer-web/src/lib/api-routes.ts` (also auto-stamps as a safety net)

**Hooks (stamp in `onMutate`, set `retry: 0`):**
- `apps/staff-web/src/hooks/use-payments-safe.ts`
- `apps/staff-web/src/hooks/use-refunds-safe.ts`
- `apps/staff-web/src/hooks/use-discount-safe.ts`
- `apps/staff-web/src/hooks/use-orders-safe.ts` (`useCreateOrder`)
- `apps/staff-web/src/hooks/use-stock-safe.ts`
- `apps/customer-web/src/hooks/use-order.ts` (`useCreateOrder`, `useAddOrderItems`)
- `apps/customer-web/src/hooks/use-delivery.ts` (`useCreateDeliveryOrder`, `useAddDeliveryOrderItems`)
- `apps/mobile/src/hooks/use-payments.ts`, `use-create-order.ts`, `use-stock.ts` already stamped via `register-mutation-defaults.ts`; signatures aligned to required field

**Tests:**
- Service tests for refund / discount / order / customer-order updated with `client_request_id` and a "rejects with ValidationError when missing" case
- Hook tests assert UUID v4 stamping
- Route tests assert 400 when key missing (`orders-route.test.ts`, `customer-orders-route.test.ts`)
- `dedupe-coverage.test.ts` — replaced "omitting key skips lookup" with "missing key throws"

### Pattern

```ts
// hook
return useMutation({
  retry: 0,
  onMutate: (input) => {
    input.client_request_id = getOrCreateClientRequestId(input.client_request_id);
  },
  mutationFn: (input) => apiRoutes.x.create({ ...input, client_request_id: input.client_request_id! }),
});
```

### Risks / rollout
- Old browser tabs still on a cached JS bundle will 400 → pair with Blocker 7 (build-SHA cache bust + "new version available" toast).
- Combine with `app_versions` `min_supported_version` bump to force-upgrade mobile clients.

---

## Blocker 2 — Disable retry on money mutations + protect submit buttons ✅

**Status:** Implemented on this branch.

**Goal:** No automatic retry of payments/refunds/discounts at the React Query layer. Manual retries only, with idempotency.

### Files touched

**Global mutation defaults:**
- `apps/staff-web/src/app/providers.tsx` — `defaultOptions.mutations: { retry: 0, networkMode: 'online' }`
- `apps/customer-web/src/components/providers.tsx` — same defaults applied for delivery flow

**Shared hook (new):**
- `packages/queries/src/use-stable-client-request-id.ts` — `useStableClientRequestId()` exposes `{ get(), reset() }` for per-form key reuse across user-driven retries
- `packages/queries/src/index.ts` — export `useStableClientRequestId` and `StableClientRequestId` type

**Forms — added `mutation.isPending`, `useIsOnline()`, `useCanPerform(action)` gates and stable-key wiring:**
- `apps/staff-web/src/components/modals/refund-modal.tsx` — gates on `issue_refund`
- `apps/staff-web/src/components/modals/discount-modal.tsx` — gates on `apply_discount`. Apply and remove each get their *own* stable key — both paths emit `action='discount_applied'` server-side, so a shared key would let an apply-then-remove double-tap dedupe to the apply result and silently keep the discount
- `apps/staff-web/src/components/modals/split-payment-modal.tsx` — drops manual `loading` state in favor of `createPayment.isPending || updateOrderStatus.isPending`; resets key on modal open
- `apps/staff-web/src/components/modals/create-table-order-modal.tsx` — `useCreateOrder` + `isOnline` gate
- `apps/staff-web/src/components/modals/create-delivery-modal.tsx` — order key + per-line item keys (Map by `menu_item.id`) so the `addOrderItems` batch dedupes on retry via `dedupeInsertMany`
- `apps/staff-web/src/components/orders/create-takeout-modal.tsx` — same dual-key pattern
- `apps/staff-web/src/components/modals/stock-movement-modal.tsx` — gates on `manage_stock`
- `apps/customer-web/src/components/cart/delivery-cart-screen.tsx` — order + per-line item keys (no auth gate; customer flow)

**Tests:**
- `packages/queries/src/__tests__/use-stable-client-request-id.test.ts` — 5 unit tests: stable across re-renders, mints fresh after reset, lazy mint, function ref stability
- `apps/staff-web/src/__tests__/components/modals/refund-modal.test.tsx` — 5 component tests covering the three plan scenarios + isPending + canPerform

### Pattern

```ts
// new shared hook in @gustri/queries
const idempotencyKey = useStableClientRequestId();

// stamp on submit; reset on success
await mutation.mutateAsync({ ...form, client_request_id: idempotencyKey.get() });
idempotencyKey.reset();

// disable while in-flight, offline, or unauthorized
disabled={mutation.isPending || !isOnline || !canPerform('issue_refund')}
```

For batch inserts (`addOrderItems`, `addDeliveryOrderItems`) the hook stamps a *distinct* key per row (the partial unique index is per-row), so order-create modals also keep a `Map<menu_item_id, key>` ref alongside the single order key — both reset together on success.

### Tests verified
- Component: timeout → `mutationFn` called exactly once (no auto-retry)
- Component: offline → submit disabled, mutation never fires
- Component: retry-on-error path reuses the same `client_request_id` (UUID v4 regex match + equality across attempts)
- Component: missing `issue_refund` permission → submit disabled
- Component: `isPending` → submit disabled with "Processing…" label

### Risks / rollout
- The global `mutations: { retry: 0 }` default flips behavior for *all* mutations app-wide, not just money ones. Read mutations (e.g. table status flips, schedule updates) lose their implicit "retry once" safety net — but those mutations are idempotent on the server side and the user can re-tap. If a non-money mutation regresses on flaky networks, override per-hook with `retry: 1`.
- `networkMode: 'online'` is the v5 default — pinning it makes the choice explicit so an upstream change to `'always'` can't silently let writes fire against a stale token while offline.

---

## Blocker 3 — `ON DELETE RESTRICT` on financial tables + archival path

**Goal:** No way (manual SQL, future migration, retention bug) to delete an order without first archiving its money records.

### Files
- New: `supabase/migrations/20260505000001_financial_tables_restrict_delete.sql`
- Rollback: `supabase/migrations/_rollbacks/20260505000001_financial_tables_restrict_delete.down.sql`
- Update: `supabase/migrations/20260424000004_data_retention.sql` (or new migration that supersedes the retention function)

### Migration sketch
```sql
BEGIN;

ALTER TABLE financial_audit_log DROP CONSTRAINT financial_audit_log_order_id_fkey;
ALTER TABLE order_payments      DROP CONSTRAINT order_payments_order_id_fkey;
ALTER TABLE refunds             DROP CONSTRAINT refunds_order_id_fkey;

ALTER TABLE financial_audit_log
  ADD CONSTRAINT financial_audit_log_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;
-- repeat for order_payments, refunds

CREATE TABLE IF NOT EXISTS public.financial_audit_log_archive
  (LIKE public.financial_audit_log INCLUDING ALL);
-- repeat for order_payments_archive, refunds_archive

CREATE OR REPLACE FUNCTION public.archive_old_orders(p_cutoff timestamptz)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE moved integer;
BEGIN
  WITH targets AS (
    SELECT id FROM orders WHERE created_at < p_cutoff AND status IN ('closed','cancelled')
  ),
  audit_moved AS (
    INSERT INTO financial_audit_log_archive
    SELECT * FROM financial_audit_log WHERE order_id IN (SELECT id FROM targets)
    RETURNING 1
  )
  -- repeat for payments, refunds; then DELETE children, then DELETE orders
  ...
END $$;

REVOKE DELETE ON public.orders FROM authenticated, anon;
COMMIT;
```

### Pre-deploy verification
- Staging snapshot: `SELECT count(*) FROM financial_audit_log WHERE order_id NOT IN (SELECT id FROM orders)` must be 0
- Confirm pg_cron retention job (if any) calls the archival function, not raw DELETE

### Tests
- pgTAP: `DELETE FROM orders WHERE id = X` raises `foreign_key_violation`
- Test: `archive_old_orders(now() - interval '90 days')` archives + deletes successfully

### Risks
- Any code path doing `DELETE FROM orders` directly will start failing. Audit: `grep -r "from.*orders.*delete\|delete.*orders" packages/api-client apps`. Route through archival RPC instead.

---

## Blocker 4 — Realtime reconnect on `visibilitychange` / `online`

**Goal:** Tab wake / network restore triggers immediate channel resubscribe + query refetch. No 2-minute lag.

### Files
- `apps/staff-web/src/hooks/use-realtime-sync.ts`
- `apps/staff-web/src/lib/realtime/channel-registry.ts`
- `apps/staff-web/src/app/providers.tsx` (mount new `LifecycleBridge`)

### `LifecycleBridge` component
```tsx
function LifecycleBridge() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const onWake = () => {
      channelRegistry.resubscribeAll();
      queryClient.invalidateQueries();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') onWake();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onWake);
    };
  }, [queryClient]);
  return null;
}
```

### Refinements
- Throttle `onWake` to one call per 2s (50 tablets toggling fast)
- Heartbeat watchdog in `use-realtime-sync.ts`: every 30s, if `subscribedRef.current === true` but `Date.now() - lastEventAtRef.current > 5*60_000`, force resubscribe
- Reduce `REFRESH_INTERVALS.FALLBACK` from 120s → 30s when `document.hidden === false`. Keep 120s when hidden (battery)
- Add jitter to refetch-on-wake (`setTimeout(onWake, Math.random() * 500)`) so a wifi blip across 50 tablets doesn't synchronize fanout

### Tests
- Manual: open kitchen, sleep laptop 5 min, wake → orders refetch immediately
- Manual: airplane mode toggle → refetch fires within 2s of `online`
- Unit: mock `visibilitychange` event → spy on `resubscribeAll` and `invalidateQueries`

---

## Blocker 5 — Cross-tab cache & auth sync via `BroadcastChannel`

**Goal:** Tabs converge on the same view of orders/tables/payments. Logout in one tab logs out all.

### Files
- New: `apps/staff-web/src/lib/realtime/cross-tab.ts`
- `apps/staff-web/src/app/providers.tsx` — wire the channel + new `CrossTabBridge`
- All write hooks — broadcast invalidations alongside local `onSuccess`
- `apps/staff-web/src/hooks/use-auth.ts` — broadcast auth events

### `cross-tab.ts`
```ts
type Msg =
  | { kind: 'invalidate'; queryKey: unknown[] }
  | { kind: 'signed-out' }
  | { kind: 'tenant-changed'; tenantId: string };

const channel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('gustri-cache-v1')
  : null;

export function postCrossTab(msg: Msg) { channel?.postMessage(msg); }
export function onCrossTab(cb: (m: Msg) => void) {
  if (!channel) return () => {};
  const handler = (e: MessageEvent<Msg>) => cb(e.data);
  channel.addEventListener('message', handler);
  return () => channel.removeEventListener('message', handler);
}
```

### Wiring
```tsx
function CrossTabBridge() {
  const queryClient = useQueryClient();
  useEffect(() => onCrossTab((m) => {
    if (m.kind === 'invalidate') queryClient.invalidateQueries({ queryKey: m.queryKey });
    if (m.kind === 'signed-out') { queryClient.clear(); supabase.auth.signOut(); }
    if (m.kind === 'tenant-changed') queryClient.clear();
  }), [queryClient]);
  return null;
}
```

### Use in hooks
```ts
function invalidateAndBroadcast(queryClient, keys: unknown[][]) {
  for (const k of keys) {
    queryClient.invalidateQueries({ queryKey: k });
    postCrossTab({ kind: 'invalidate', queryKey: k });
  }
}
```

### Tests
- Open two tabs, take a payment in tab A → tab B shows updated remaining balance within 1s
- Sign out in tab A → tab B redirects to login

### Risks
- `BroadcastChannel` not on Safari < 15.4 → fall back to `storage` events
- Echo loops: only broadcast on local mutation success, not on receipt

---

## Blocker 6 — Atomic mutation + audit insert via single Postgres RPC ✅

**Status:** Implemented on branch `blocker-5` (commit `eb9c75a`). RPCs `create_refund_with_audit` (mig 20260505000002+3) and `apply_discount_with_audit` (mig 20260505000004+5) consolidate dedupe lookup, order lock, mutation, and audit row writes into single transactions. Payment audit atomicity restored via the rewritten `update_order_payment_status` trigger (mig 20260505000006). Services in `apps/staff-web/src/lib/services/{refund,discount}-service.ts` swapped to `client.rpc(...)` calls; the `console.warn` "best-effort" branch in `discount-service.ts` is gone. P0002 (`no_data_found`) added to `handleSupabaseError` in `packages/api-client/src/errors.ts`. Verified with 21 staff-web vitest cases + 28 api-client cases + smoke against local Postgres.

**Goal:** Refunds, discounts, payments either commit *with* their audit row or not at all. No best-effort logging.

### Files
- New: `supabase/migrations/20260505000002_refund_rpc.sql`
- New: `supabase/migrations/20260505000003_discount_rpc.sql`
- New: `supabase/migrations/20260505000004_payment_audit_unique.sql`
- `apps/staff-web/src/lib/services/refund-service.ts`, `discount-service.ts`, `payment-service.ts`

### Refund RPC
```sql
CREATE OR REPLACE FUNCTION public.create_refund_with_audit(
  p_order_id uuid, p_tenant_id uuid, p_amount numeric, p_reason text,
  p_method payment_method, p_processed_by uuid, p_item_ids uuid[],
  p_notes text, p_client_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing refunds%ROWTYPE;
  v_refund refunds%ROWTYPE;
BEGIN
  SELECT * INTO v_existing FROM refunds
   WHERE tenant_id = p_tenant_id AND client_request_id = p_client_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('refund', row_to_json(v_existing), 'deduped', true);
  END IF;

  PERFORM 1 FROM orders WHERE id = p_order_id AND tenant_id = p_tenant_id FOR UPDATE;

  INSERT INTO refunds (order_id, tenant_id, amount, reason, refund_method,
                       processed_by, order_item_ids, notes, client_request_id)
  VALUES (p_order_id, p_tenant_id, p_amount, p_reason, p_method,
          p_processed_by, p_item_ids, p_notes, p_client_request_id)
  RETURNING * INTO v_refund;

  INSERT INTO financial_audit_log (order_id, tenant_id, action, triggered_by,
                                    new_total, created_at)
  VALUES (p_order_id, p_tenant_id, 'refund', 'rpc:create_refund_with_audit',
          p_amount, now());

  RETURN jsonb_build_object('refund', row_to_json(v_refund), 'deduped', false);
END $$;
REVOKE ALL ON FUNCTION public.create_refund_with_audit FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_refund_with_audit TO service_role;
```

### Payment audit unique index
```sql
ALTER TABLE financial_audit_log ADD COLUMN IF NOT EXISTS triggered_by_request_id uuid;
CREATE UNIQUE INDEX CONCURRENTLY financial_audit_log_payment_unique
  ON financial_audit_log (tenant_id, order_id, action, triggered_by_request_id)
  WHERE action = 'payment';
```

### Service refactor
- `refund-service.ts`: replace direct INSERT + post-hoc audit with `client.rpc('create_refund_with_audit', { ... })`
- `discount-service.ts`: replace UPDATE + INSERT pair with `client.rpc('apply_discount_with_audit', { ... })`
- Remove `console.warn` non-fatal audit branches

### Tests
- Force audit insert to fail (constraint violation) → refund row also rolls back
- Replay same `client_request_id` → returns deduped result; only one audit row
- Concurrent refunds same key in parallel → one wins, one returns deduped, exactly one audit row

### Risks
- `SECURITY DEFINER` RPCs bypass RLS — explicitly check `tenant_id` parameter against caller's claim. Pass it from the service after `verifyAdmin` so it can't be spoofed

---

## Blocker 7 — `/api/v1/health` + observability hooks ✅

**Status:** Implemented on branch `blocker-5`. `/api/v1/health` route added with db + optional redis probes (`apps/staff-web/src/app/api/v1/health/route.ts`); middleware exempts it from JWT auth. Build SHA pipeline wired in `next.config.js` (`NEXT_PUBLIC_BUILD_SHA` + `generateBuildId`), service worker (`public/sw.js`), and CI-only postbuild injector (`scripts/inject-sw-version.mjs`). Sentry `build_sha` tag set in `instrumentation-client.ts` + `sentry.server.config.ts`; `tenant_id` and user tags set in `RealtimeAuthBridge`. Production boot guard added to `instrumentation.ts` requiring Upstash env when `NEXT_PUBLIC_SENTRY_DSN` is set. Version-skew detector polls `/api/v1/health` from `connection-provider.tsx` and surfaces a sticky toast on SHA mismatch (i18n keys in en/az/ru/tr). Verified with 9 health-route vitest cases + local curl smoke.

**Goal:** External uptime monitor + deploy verifier + version-skew detector.

### Files
- New: `apps/staff-web/src/app/api/v1/health/route.ts`
- `apps/staff-web/next.config.js` — inject `VERCEL_GIT_COMMIT_SHA` into `NEXT_PUBLIC_BUILD_SHA` and `generateBuildId`
- `apps/staff-web/src/instrumentation.ts` — fail boot in production if `UPSTASH_REDIS_REST_URL`/`TOKEN` missing
- `apps/staff-web/src/components/providers/connection-provider.tsx` — poll the endpoint, broadcast SHA mismatch
- `apps/staff-web/public/sw.js` — version cache name with build SHA, purge old caches in `activate`

### Health route
```ts
export const dynamic = 'force-dynamic';

export async function GET() {
  const t0 = Date.now();
  const checks: Record<string, { ok: boolean; ms?: number; error?: string }> = {};

  try {
    const t = Date.now();
    const { error } = await getSupabaseAdmin().from('cafe_settings').select('id').limit(1);
    checks.db = error ? { ok: false, error: error.message } : { ok: true, ms: Date.now() - t };
  } catch (e: any) {
    checks.db = { ok: false, error: e.message };
  }

  if (process.env.UPSTASH_REDIS_REST_URL) {
    try {
      const t = Date.now();
      const r = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
        cache: 'no-store',
      });
      checks.redis = r.ok ? { ok: true, ms: Date.now() - t } : { ok: false, error: `${r.status}` };
    } catch (e: any) {
      checks.redis = { ok: false, error: e.message };
    }
  }

  const ok = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    { ok, sha: process.env.NEXT_PUBLIC_BUILD_SHA ?? 'unknown', ts: new Date().toISOString(), latency_ms: Date.now() - t0, checks },
    { status: ok ? 200 : 503 },
  );
}
```

### Build-SHA injection (`next.config.js`)
```js
const COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev';
module.exports = withSentryConfig({
  ...
  env: { NEXT_PUBLIC_BUILD_SHA: COMMIT_SHA },
  generateBuildId: async () => COMMIT_SHA,
});
```

### Service worker cache bust
```js
// public/sw.js
const CACHE_NAME = '__BUILD_SHA__'; // replaced by postbuild script
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
  ));
});
```
A `apps/staff-web/scripts/inject-sw-version.mjs` postbuild step replaces `__BUILD_SHA__` with `VERCEL_GIT_COMMIT_SHA`.

### Sentry tagging (`instrumentation.ts` + `RealtimeAuthBridge`)
```ts
Sentry.setTag('build_sha', process.env.NEXT_PUBLIC_BUILD_SHA);
Sentry.setTag('tenant_id', staff?.tenant_id ?? 'unauth');
Sentry.setUser({ id: staff?.id, role: staff?.role });
```

### Tests / smoke
- `curl /api/v1/health` → 200 with all checks ok in staging
- Kill Redis → 503 with `redis.ok=false`
- Deploy a new SHA → old tab polls health, sees mismatch, toast appears

### Monitoring wiring (separate but enabled by this)
- Vercel uptime / BetterStack / UptimeRobot: GET `/api/v1/health` every 1 min; alert on 503 or > 2s latency
- Sentry alert: payment 5xx > 1%/5min; refund rate per tenant; realtime reconnect counter

### Risks
- `/api/v1/health` is unauthenticated — return only booleans + latency, never tenant data, never DSNs

---

## Deploy order (all blockers)

1. **Day −2** — Migration `20260505000001` (FK RESTRICT) on staging. Verify retention cron + manual delete paths
2. **Day −1** — Migrations `20260505000002–4` (RPCs + payment audit unique). Deploy server with required `client_request_id` (already on this branch), retry=0 (Blocker 2), RPC services (Blocker 6). Mobile force-upgrade via `app_versions`
3. **Day 0** — Deploy staff-web with `LifecycleBridge`, `CrossTabBridge`, `/api/v1/health`, SW cache bust
4. **Day +1** — Wire uptime monitor + Sentry alerts. Run a planned restore drill from PITR to validate Blocker-3 archival

---

## Status tracking

When picking up the next blocker, branch from `main` (after Blocker 1 merges), copy this file's relevant section into the PR description, and tick the row in the table at the top.
