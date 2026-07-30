/**
 * Session-scoped storage for a table's QR token (the dine-in capability).
 *
 * A customer obtains the token by scanning the physical QR (`?token=…` on the
 * landing URL). The `get_active_order_for_table` RPC now REQUIRES it (the
 * table id alone is enumerable and is not a capability — see migration
 * 20260727000001). But the token only appears on the landing URL, while the
 * order is read on sub-pages (menu / cart / order-status) that don't carry it.
 * So we persist it per-table in sessionStorage — the same pattern the delivery
 * flow uses for `delivery-order-token` — and `useOrder` reads it back.
 *
 * sessionStorage dies with the tab, so the token doesn't outlive the visit.
 * A 24h TTL bounds residue on a kiosk/tablet left on overnight.
 */

const PREFIX = 'table-qr-token:';
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

export function writeTableToken(tableId: string, token: string): void {
  if (typeof window === 'undefined' || !tableId || !token) return;
  try {
    window.sessionStorage.setItem(
      `${PREFIX}${tableId}`,
      JSON.stringify({ token, ts: Date.now() } satisfies StoredEntry),
    );
  } catch {
    // Private-mode Safari / quota — the customer will need to re-scan.
  }
}

export function readTableToken(tableId: string): string | null {
  if (typeof window === 'undefined' || !tableId) return null;
  const key = `${PREFIX}${tableId}`;
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredEntry(parsed) || Date.now() - parsed.ts > STALE_TTL_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed.token;
  } catch {
    try {
      window.sessionStorage.removeItem(key);
    } catch {}
    return null;
  }
}
