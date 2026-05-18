/**
 * M5 — realtime-echo dedup for customer-own writes.
 *
 * The mutation hooks (`useCreateOrder`, `useAddOrderItems`, …) invalidate
 * the order query in `onSuccess` so the UI updates immediately. ~200ms
 * later, the Supabase realtime channel echoes the same INSERT/UPDATE as a
 * `postgres_changes` event, and the channel callback invalidates *again*.
 * Result: brief skeleton flash and a wasted refetch on every customer
 * mutation.
 *
 * This module is a tiny FIFO-capped registry of recently-applied
 * `client_request_id`s, scoped per `orderId`. Mutation hooks register the
 * id they just persisted; the realtime callback checks the registry and
 * skips invalidation for events that match.
 *
 * - Per-order cap (`MAX_PER_ORDER = 16`) bounds memory. A customer
 *   submitting more than 16 items in a single sitting is the realistic
 *   upper bound; past that, FIFO eviction means the oldest ids start
 *   re-triggering invalidates — which is the *correct* fallback (echoes
 *   for those ids will refetch, identical to staff updates).
 * - Module-level singleton so the `onSuccess` hook on a mutation and the
 *   realtime callback inside `useOrder` see the same state without
 *   threading a ref through.
 * - String `'_global_'` bucket as an escape hatch for the rare case where
 *   we record an id before knowing which orderId it belongs to (e.g. the
 *   order-create mutation: the order doesn't exist yet, so we record on
 *   the global bucket and the matching INSERT echo dedupes via lookup
 *   under the same key).
 */

const MAX_PER_ORDER = 16;
const GLOBAL_BUCKET = '__global__';
// RT3 — cross-tab dedup. Two tabs of the same table/order: tab A's
// mutation records the crid into its in-memory registry, then the
// realtime echo fires in BOTH tabs. Tab B has no crid → invalidates →
// visible flicker. A BroadcastChannel mirrors every `record` call to
// sibling tabs of the same origin, so the dedup hit also fires there.
// Marginal in practice (most customers don't keep two tabs of the same
// cart open), but free to fix once the registry exists.
const CHANNEL_NAME = 'realtime-dedup';

const recentByBucket = new Map<string, string[]>();

type BroadcastPayload = {
  type: 'record';
  orderId: string | null | undefined;
  clientRequestId: string;
};

// Module-level channel. `typeof BroadcastChannel` guards SSR (Next.js
// server render) and tests where the API isn't polyfilled. The
// `onmessage` handler re-runs `recordLocal` but does NOT re-broadcast
// — that's the loop break.
const broadcast: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

function bucket(orderId: string | null | undefined): string {
  return orderId && orderId.length > 0 ? orderId : GLOBAL_BUCKET;
}

function recordLocal(orderId: string | null | undefined, clientRequestId: string): void {
  const key = bucket(orderId);
  const list = recentByBucket.get(key) ?? [];
  // Move-to-front semantics so a duplicate record (replay path) doesn't
  // age its entry; the most-recent slot wins.
  const existing = list.indexOf(clientRequestId);
  if (existing >= 0) list.splice(existing, 1);
  list.push(clientRequestId);
  while (list.length > MAX_PER_ORDER) list.shift();
  recentByBucket.set(key, list);
}

if (broadcast) {
  broadcast.onmessage = (event: MessageEvent<BroadcastPayload>) => {
    const msg = event.data;
    // Validate shape — a stray message from another consumer of the
    // same channel name shouldn't poison the registry. Per CR2-style
    // scrutiny of cross-tab `storage`/`postMessage` surfaces.
    if (!msg || msg.type !== 'record' || typeof msg.clientRequestId !== 'string') return;
    if (msg.clientRequestId.length === 0) return;
    if (msg.orderId !== null && msg.orderId !== undefined && typeof msg.orderId !== 'string') {
      return;
    }
    recordLocal(msg.orderId, msg.clientRequestId);
  };
}

export function recordRecentClientRequestId(
  orderId: string | null | undefined,
  clientRequestId: string | null | undefined,
): void {
  if (!clientRequestId) return;
  recordLocal(orderId, clientRequestId);
  // RT3 — fan out so other tabs of the same origin record the same id
  // and skip the realtime echo. Fire-and-forget; if it throws (channel
  // closed in some teardown race) we still have the local entry.
  if (broadcast) {
    try {
      broadcast.postMessage({
        type: 'record',
        orderId,
        clientRequestId,
      } satisfies BroadcastPayload);
    } catch {
      // Ignore — local registry is the source of truth for this tab.
    }
  }
}

export function isRecentClientRequestId(
  orderId: string | null | undefined,
  clientRequestId: string | null | undefined,
): boolean {
  if (!clientRequestId) return false;
  const key = bucket(orderId);
  const list = recentByBucket.get(key);
  if (list?.includes(clientRequestId)) return true;
  // Global bucket fallback for ids recorded before the orderId was
  // known (order-create path). We don't promote on hit because the
  // mutation hook will record into the order-id bucket on its own
  // success path; this is just the bridge for the first INSERT echo.
  const globalList = recentByBucket.get(GLOBAL_BUCKET);
  return globalList?.includes(clientRequestId) ?? false;
}

// Test affordance — keeps the surface area tight while still letting
// unit tests assert FIFO eviction without poking the Map directly.
export function _resetRecentClientRequestIdsForTests(): void {
  recentByBucket.clear();
}
