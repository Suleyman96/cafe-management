import { MMKV } from 'react-native-mmkv';
import { getOrCreateMmkvEncryptionKey } from './storage-key';

/**
 * Persists the last time the app was foregrounded for the current staff
 * session. Lives in its own encrypted MMKV instance (separate from the
 * query-cache blob and session-stamp) so we can read/clear it independently
 * during boot without paying for a full cache hydrate.
 *
 * Why encrypted: the timestamp on its own is harmless, but co-locating it
 * with cache/session-stamp would mean a single decryption key gates all
 * three. Keeping the keystore-backed key path uniform makes that simpler.
 *
 * Why not AsyncStorage: cold-start needs a sync read before any screen
 * mounts. AsyncStorage's async read forces an extra splash frame.
 */

const KEY = 'gustri.last-active-at';
const MMKV_INSTANCE_ID = 'gustri-last-active-at';

let storage: MMKV | null = null;

export async function initLastActiveAtStore(): Promise<void> {
  if (storage) return;
  const encryptionKey = await getOrCreateMmkvEncryptionKey();
  let mmkv: MMKV;
  try {
    mmkv = new MMKV({ id: MMKV_INSTANCE_ID, encryptionKey });
  } catch (err) {
    storage = null;
    throw err;
  }
  // Pre-encryption blob (highly unlikely for this key — it's new — but match
  // the pattern from session-stamp and query-persister): probe and wipe if
  // unreadable. Cost of losing the value is one extra logout-on-resume.
  try {
    const probe = mmkv.getString(KEY);
    if (probe !== undefined) Number.parseInt(probe, 10);
  } catch {
    try {
      mmkv.clearAll();
    } catch {
      // best-effort
    }
  }
  storage = mmkv;
}

export function setLastActiveAt(ms: number): void {
  if (!storage) return; // soft-fail: never block AppState handlers on init races
  storage.set(KEY, String(ms));
}

export function readLastActiveAt(): number | null {
  if (!storage) return null;
  const raw = storage.getString(KEY);
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function clearLastActiveAt(): void {
  if (!storage) return;
  try {
    storage.delete(KEY);
  } catch {
    // best-effort
  }
}

// Test-only escape hatch.
export function __resetLastActiveAtForTests(): void {
  storage = null;
}
