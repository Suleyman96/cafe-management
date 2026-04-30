import { MMKV } from 'react-native-mmkv';
import { getOrCreateMmkvEncryptionKey } from './storage-key';

/**
 * Persists the resolved tenant + staff identity of the most recent successful
 * login next to (but not inside) the React Query cache blob. On next launch,
 * App.tsx reads the stamp before the persister hydrates and compares it
 * against the freshly-resolved current session. A mismatch (e.g. user A
 * logged out, user B logged in on the same device — possibly while offline)
 * means the persisted cache belongs to the previous tenant and must be
 * dropped before any screen has a chance to render it. Without this gate,
 * `resumePausedMutations()` would replay user A's queued mutations under
 * user B's auth context — a cross-tenant write.
 *
 * The stamp lives in its own MMKV instance so it can be read/cleared
 * independently of the (much larger) query-cache blob. The instance is
 * encrypted with the shared keystore-backed key (see `storage-key.ts`) so
 * pulling the on-disk file does not reveal tenant/staff IDs.
 */

const STAMP_KEY = 'gustri.session-stamp';
const MMKV_INSTANCE_ID = 'gustri-session-stamp';

let stampStorage: MMKV | null = null;

export async function initEncryptedSessionStamp(): Promise<void> {
  if (stampStorage) return;
  const encryptionKey = await getOrCreateMmkvEncryptionKey();
  let mmkv: MMKV;
  try {
    mmkv = new MMKV({ id: MMKV_INSTANCE_ID, encryptionKey });
  } catch (err) {
    stampStorage = null;
    throw err;
  }
  // If the on-disk stamp predates encryption, decryption will fail. The stamp
  // is cheap to recreate on next login, so wipe and continue.
  try {
    const probe = mmkv.getString(STAMP_KEY);
    if (probe !== undefined) JSON.parse(probe);
  } catch {
    try {
      mmkv.clearAll();
    } catch {
      // best-effort
    }
  }
  stampStorage = mmkv;
}

function requireStamp(): MMKV {
  if (!stampStorage) {
    throw new Error('Session stamp MMKV not initialized — call initEncryptedSessionStamp() first');
  }
  return stampStorage;
}

export interface SessionStamp {
  tenantId: string;
  staffId: string;
}

export function writeSessionStamp(stamp: SessionStamp): void {
  requireStamp().set(STAMP_KEY, JSON.stringify(stamp));
}

export function readSessionStamp(): SessionStamp | null {
  const raw = requireStamp().getString(STAMP_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SessionStamp>;
    if (typeof parsed.tenantId === 'string' && typeof parsed.staffId === 'string') {
      return { tenantId: parsed.tenantId, staffId: parsed.staffId };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearSessionStamp(): void {
  if (!stampStorage) return;
  stampStorage.delete(STAMP_KEY);
}

// Test-only.
export function __resetSessionStampForTests(): void {
  stampStorage = null;
}
