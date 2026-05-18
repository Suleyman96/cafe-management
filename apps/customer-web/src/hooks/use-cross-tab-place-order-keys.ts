import { randomUUIDv4 } from '@gustri/queries';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * H4 — cross-tab-aware idempotency keys for Place Order.
 *
 * `useStableClientRequestId` only survives within a single tab. Two tabs
 * of the same cart (same `tableId` for dine-in, same `qrToken` for
 * delivery) mint independent `client_request_id`s; the
 * `(tenant_id, client_request_id)` partial unique index on the server
 * dedupes within a `client_request_id` but cannot see across them, so
 * tapping Place Order in both tabs creates two orders.
 *
 * Lifting the keys to `localStorage` under a partition-scoped key gives
 * every same-origin tab the same id for "this logical submit". The
 * `storage` event also lets sibling tabs observe a successful submit
 * elsewhere and gate their own button so the customer can't trigger
 * the dedupe-reject UX on a second tap.
 *
 * Per-item keys: stored under the same partition as an object keyed by
 * `menu_item_id` so adding the same item across tabs reuses the same
 * `client_request_id`.
 *
 * Submitted-lock TTL: 5 min. Long enough to cover the realistic
 * double-tap window (customer wandered to a sibling tab while the first
 * tab's confirmation was rendering); short enough that a customer who
 * comes back 30 min later to start a new order isn't blocked.
 */

interface StoredState {
  orderKey?: string;
  itemKeys?: Record<string, string>;
  submittedAt?: number;
}

const STORAGE_PREFIX = 'cw-place-order:';
const SUBMITTED_LOCK_MS = 5 * 60 * 1000;

function storageKey(partition: string) {
  return `${STORAGE_PREFIX}${partition}`;
}

function readState(partition: string): StoredState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey(partition));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeState(partition: string, state: StoredState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(partition), JSON.stringify(state));
  } catch {
    // Quota / private-mode Safari. The bare in-memory ref in the consumer
    // is enough for the same-tab dedup contract; cross-tab simply
    // degrades to per-tab in this case.
  }
}

function clearState(partition: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(partition));
  } catch {
    // ignore
  }
}

function isLockedByOtherTab(state: StoredState, now: number): boolean {
  return !!state.submittedAt && now - state.submittedAt < SUBMITTED_LOCK_MS;
}

interface CrossTabPlaceOrderKeys {
  /** True when a sibling tab has just submitted this partition's order. */
  submittedByOtherTab: boolean;
  /** Lazy mint — only writes localStorage when the customer actually submits. */
  getOrderKey: () => string;
  getItemKey: (menuItemId: string) => string;
  /** Broadcast to sibling tabs that this partition has been submitted. */
  markSubmitted: () => void;
  /** Clear all keys (call on confirmed success in the originating tab). */
  reset: () => void;
}

export function useCrossTabPlaceOrderKeys(partition: string): CrossTabPlaceOrderKeys {
  const partitionRef = useRef(partition);
  partitionRef.current = partition;

  const [submittedByOtherTab, setSubmittedByOtherTab] = useState<boolean>(() => {
    return isLockedByOtherTab(readState(partition), Date.now());
  });

  // Re-evaluate the lock when the partition changes (e.g. customer switches
  // from /delivery to /table/T01 in the same tab). The previous partition's
  // submitted-lock should not bleed into the new one's UI.
  useEffect(() => {
    setSubmittedByOtherTab(isLockedByOtherTab(readState(partition), Date.now()));
  }, [partition]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey(partitionRef.current)) return;
      if (!e.newValue) {
        setSubmittedByOtherTab(false);
        return;
      }
      try {
        const parsed = JSON.parse(e.newValue) as StoredState;
        setSubmittedByOtherTab(isLockedByOtherTab(parsed, Date.now()));
      } catch {
        // Malformed payload from a sibling tab — leave the lock unchanged.
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return useMemo<CrossTabPlaceOrderKeys>(
    () => ({
      submittedByOtherTab,
      getOrderKey: () => {
        const s = readState(partitionRef.current);
        if (s.orderKey) return s.orderKey;
        const fresh = randomUUIDv4();
        writeState(partitionRef.current, { ...s, orderKey: fresh });
        return fresh;
      },
      getItemKey: (menuItemId: string) => {
        const s = readState(partitionRef.current);
        const existing = s.itemKeys?.[menuItemId];
        if (existing) return existing;
        const fresh = randomUUIDv4();
        writeState(partitionRef.current, {
          ...s,
          itemKeys: { ...(s.itemKeys ?? {}), [menuItemId]: fresh },
        });
        return fresh;
      },
      markSubmitted: () => {
        // Don't set local state — `storage` events fire in sibling tabs
        // only, which is the intended scope. The originating tab moves
        // on via the confirmation overlay; if the customer dismisses
        // it and returns to the cart, the cart will be empty
        // (clearCart fires on success), so no additional gate is needed
        // in the originating tab.
        writeState(partitionRef.current, { submittedAt: Date.now() });
      },
      reset: () => {
        clearState(partitionRef.current);
        setSubmittedByOtherTab(false);
      },
    }),
    [submittedByOtherTab],
  );
}
