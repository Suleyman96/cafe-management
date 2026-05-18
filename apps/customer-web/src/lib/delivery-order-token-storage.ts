/**
 * Session-scoped storage for delivery order access tokens.
 *
 * The URL fragment (`#token=…`) is the canonical bearer carrier on the
 * tracking page; sessionStorage is a redundant copy so the customer can
 * recover if the fragment gets stripped by a share/copy-link surface or
 * a URL-bar wipe.
 *
 * S3 — entries are wrapped in `{ token, ts }` so stale bearers can be
 * pruned. A 24 h TTL bounds residue on long-running tabs (shared kiosk,
 * tablet left on overnight) where an order may never reach a terminal
 * state and therefore never trigger the per-order clear in
 * `delivery-order-status`.
 *
 * Legacy raw-string entries (pre-S3) round-trip through `readToken` as
 * stale and are dropped — sessionStorage dies with the tab, so the
 * compatibility window is naturally short.
 */

const PREFIX = 'delivery-order-token:';
const STALE_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredEntry {
  token: string;
  ts: number;
}

function isStoredEntry(value: unknown): value is StoredEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StoredEntry).token === 'string' &&
    typeof (value as StoredEntry).ts === 'number'
  );
}

export function writeDeliveryOrderToken(orderId: string, token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      `${PREFIX}${orderId}`,
      JSON.stringify({ token, ts: Date.now() } satisfies StoredEntry),
    );
  } catch {
    // Private-mode Safari / quota — URL fragment remains the primary carrier.
  }
}

export function readDeliveryOrderToken(orderId: string): string | null {
  if (typeof window === 'undefined') return null;
  const key = `${PREFIX}${orderId}`;
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredEntry(parsed)) {
      // Legacy raw-string format (or corrupted entry) — treat as stale.
      window.sessionStorage.removeItem(key);
      return null;
    }
    if (Date.now() - parsed.ts > STALE_TTL_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed.token;
  } catch {
    // Unparseable — drop it.
    try {
      window.sessionStorage.removeItem(key);
    } catch {}
    return null;
  }
}

export function clearDeliveryOrderToken(orderId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(`${PREFIX}${orderId}`);
  } catch {}
}

/**
 * Iterate sessionStorage and drop any `delivery-order-token:*` entry
 * whose timestamp is older than the TTL (or whose envelope is missing
 * /malformed). Intended to be called on mount of the tracking page so
 * stale bearers don't linger on a long-running tab.
 */
export function sweepStaleDeliveryOrderTokens(): void {
  if (typeof window === 'undefined') return;
  let keys: string[];
  try {
    keys = Object.keys(window.sessionStorage);
  } catch {
    return;
  }
  const now = Date.now();
  for (const key of keys) {
    if (!key.startsWith(PREFIX)) continue;
    let raw: string | null;
    try {
      raw = window.sessionStorage.getItem(key);
    } catch {
      continue;
    }
    if (!raw) continue;
    let drop = false;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isStoredEntry(parsed) || now - parsed.ts > STALE_TTL_MS) {
        drop = true;
      }
    } catch {
      drop = true;
    }
    if (drop) {
      try {
        window.sessionStorage.removeItem(key);
      } catch {}
    }
  }
}
