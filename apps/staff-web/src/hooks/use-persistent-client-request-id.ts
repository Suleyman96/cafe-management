'use client';

import { randomUUIDv4 } from '@gustri/queries';
import { useMemo } from 'react';

/**
 * Persistent `client_request_id` for high-risk money mutations whose
 * modals can be closed and reopened during an error → retry flow.
 *
 * Unlike `useStableClientRequestId` (which lives in a `useRef`), this
 * hook keys the id by a caller-provided scope (e.g. `payment:${orderId}`)
 * and persists it in `sessionStorage`. A cashier who hits a 503, closes
 * the payment modal, and reopens it sends the SAME request id on retry —
 * the server's `(tenant_id, client_request_id)` partial unique index
 * then absorbs the duplicate instead of creating a second `order_payments`
 * row. Only resets after a confirmed success (or an explicit caller reset).
 *
 * `sessionStorage` is intentional: it survives a tablet reload (POS
 * devices reload occasionally and we want the dedupe path to still
 * fire) but does NOT bleed into a fresh tab — a new tab = a new logical
 * session.
 *
 * Storage failures (private-mode browsers, quota errors) fall through
 * to a fresh uuid each call. That degrades to current behavior rather
 * than throwing inside a critical path.
 */

const STORAGE_PREFIX = 'gustri:crid:';

function safeGetItem(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(key, value);
  } catch {
    // sessionStorage may be unavailable (private mode, quota). The id
    // is still returned to the caller for this submit; subsequent
    // remounts will mint a new one — same fallback as
    // useStableClientRequestId.
  }
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore — see safeSetItem.
  }
}

export function usePersistentClientRequestId(scopeKey: string) {
  return useMemo(() => {
    const storageKey = `${STORAGE_PREFIX}${scopeKey}`;
    return {
      get: () => {
        let v = safeGetItem(storageKey);
        if (!v) {
          v = randomUUIDv4();
          safeSetItem(storageKey, v);
        }
        return v;
      },
      reset: () => safeRemoveItem(storageKey),
    };
  }, [scopeKey]);
}

export type PersistentClientRequestId = ReturnType<typeof usePersistentClientRequestId>;
