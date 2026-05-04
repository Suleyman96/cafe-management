/**
 * Cross-tab communication channel for cache + auth synchronization.
 *
 * Without this, two tabs of the same staff session diverge: take a payment
 * in tab A and tab B keeps showing the prior remaining balance until its
 * own realtime event arrives (or its 30s safety-net poll fires, see
 * `use-realtime-sync.ts`). Auth is worse — sign-out in one tab leaves the
 * other tab logged in until it eventually fails an API call.
 *
 * Design:
 * - Coarse-grained `mutation-success` ping: any successful mutation in one
 *   tab triggers `queryClient.invalidateQueries()` in others. Cheaper to
 *   wire than per-key broadcasts and no risk of drift between sender and
 *   receiver about which keys to invalidate. The originating tab still does
 *   its own fine-grained `onSuccess` invalidations for snappy local UX.
 * - Auth events (`signed-out`, `tenant-changed`) broadcast explicitly so the
 *   receiving tab can `queryClient.clear()` + redirect/sign-out without
 *   waiting for `onAuthStateChange` propagation across the supabase-js
 *   single-client-per-tab boundary.
 *
 * Echo-loop protection: each message carries an originating `tabId`.
 * Receivers ignore messages they sent themselves. (BroadcastChannel does
 * not echo to the same context, but the storage-event fallback would.)
 *
 * Browser support: BroadcastChannel is available in Safari 15.4+ (Mar 2022)
 * and all evergreen browsers. The `storage` event fallback covers older
 * Safari and SSR/test environments where BroadcastChannel is missing.
 */

const CHANNEL_NAME = 'gustri-cache-v1';
const STORAGE_KEY = 'gustri-cache-v1:msg';

export type CrossTabMsg =
  | { kind: 'mutation-success'; tabId: string }
  | { kind: 'signed-out'; tabId: string }
  | { kind: 'tenant-changed'; tabId: string; tenantId: string };

// Distributive Omit so the union members each retain their kind-specific
// fields (`tenantId` on tenant-changed) when the caller supplies them.
type CrossTabPayload = CrossTabMsg extends infer T
  ? T extends { tabId: string }
    ? Omit<T, 'tabId'>
    : never
  : never;

const TAB_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function getTabId() {
  return TAB_ID;
}

const broadcastChannel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

const useStorageFallback = broadcastChannel === null && typeof window !== 'undefined';

export function postCrossTab(msg: CrossTabPayload) {
  const stamped = { ...msg, tabId: TAB_ID } as CrossTabMsg;

  if (broadcastChannel !== null) {
    broadcastChannel.postMessage(stamped);
    return;
  }

  if (useStorageFallback) {
    // Use a unique key per write so two identical messages still trigger a
    // `storage` event on other tabs (the event only fires when the value
    // actually changes). Stale entries are best-effort cleaned by the
    // sender; if a tab dies mid-write the worst case is a few orphaned
    // localStorage rows.
    try {
      const payload = JSON.stringify({ ...stamped, _seq: Date.now() + Math.random() });
      window.localStorage.setItem(STORAGE_KEY, payload);
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage may be unavailable (private mode, quota); silently
      // drop — the cost is delayed cross-tab convergence, not correctness.
    }
  }
}

export function onCrossTab(cb: (msg: CrossTabMsg) => void): () => void {
  if (broadcastChannel !== null) {
    const handler = (event: MessageEvent<CrossTabMsg>) => {
      const data = event.data;
      if (!data || data.tabId === TAB_ID) return;
      cb(data);
    };
    broadcastChannel.addEventListener('message', handler);
    return () => broadcastChannel.removeEventListener('message', handler);
  }

  if (!useStorageFallback) return () => {};

  const handler = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || event.newValue === null) return;
    try {
      const data = JSON.parse(event.newValue) as CrossTabMsg;
      if (!data || data.tabId === TAB_ID) return;
      cb(data);
    } catch {
      // Ignore malformed payloads — fire-and-forget protocol.
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
