import * as Sentry from '@sentry/react-native';
import { MMKV } from 'react-native-mmkv';
import { apiRoutes } from './api-routes';
import { getOrCreateMmkvEncryptionKey } from './storage-key';

/**
 * Dedicated persistent queue for pending push-token revocations.
 *
 * Why this isn't a React Query persisted mutation:
 *  - The C2 drain (`drainMismatchedMutations`) discards any persisted
 *    mutation whose tenant/staff stamp doesn't match the next session.
 *    A revoke queued at logout has no future-session match by design —
 *    the whole point is that the *previous* user's token must come off
 *    the server even though they're no longer logged in.
 *  - Wiping the React Query cache on logout (`clearEncryptedQueryCache`)
 *    would also nuke a persisted mutation before it could replay.
 *
 * This queue is read once on every app boot (regardless of who logs in
 * next) and on online-state transitions, then drained against the
 * unauthenticated `/api/v1/push-tokens/revoke` route. The route enforces
 * rate limiting + global-uniqueness on `expo_token` instead of
 * `verifyStaff`, since the device proves ownership of the token simply by
 * holding it.
 *
 * Encrypted with the shared keystore key (see `storage-key.ts`) so a
 * pulled-from-disk MMKV file does not reveal the token.
 */

const QUEUE_KEY = 'gustri.pending-revokes';
const MMKV_INSTANCE_ID = 'gustri-pending-revokes';

let queueStorage: MMKV | null = null;

async function getQueueStorage(): Promise<MMKV> {
  if (queueStorage) return queueStorage;
  const encryptionKey = await getOrCreateMmkvEncryptionKey();
  try {
    queueStorage = new MMKV({ id: MMKV_INSTANCE_ID, encryptionKey });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'pending-revokes-mmkv-init' } });
    throw err;
  }
  // Pre-encryption legacy data won't decrypt. Losing a pending revoke is
  // acceptable — at worst, the next user on the device receives one extra
  // notification before their first sync evicts the prior token.
  try {
    const probe = queueStorage.getString(QUEUE_KEY);
    if (probe !== undefined) JSON.parse(probe);
  } catch {
    try {
      queueStorage.clearAll();
    } catch {
      // best-effort
    }
  }
  return queueStorage;
}

function readQueue(storage: MMKV): string[] {
  const raw = storage.getString(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string')) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

function writeQueue(storage: MMKV, queue: string[]): void {
  storage.set(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueuePendingRevoke(expoToken: string): Promise<void> {
  if (!expoToken) return;
  const storage = await getQueueStorage();
  const queue = readQueue(storage);
  if (queue.includes(expoToken)) return;
  writeQueue(storage, [...queue, expoToken]);
}

/**
 * Try to revoke every queued token. Tokens that succeed (or fail with a
 * 4xx — the server rejected them, retrying won't help) are removed.
 * Network failures keep the entry queued for the next drain.
 *
 * Returns the count of tokens drained successfully.
 */
export async function drainPendingRevokes(): Promise<number> {
  const storage = await getQueueStorage();
  const queue = readQueue(storage);
  if (queue.length === 0) return 0;

  const remaining: string[] = [];
  let drained = 0;

  for (const token of queue) {
    try {
      await apiRoutes.pushTokens.revoke({ expo_token: token });
      drained++;
    } catch (err) {
      const status = (err as { status?: number } | null)?.status;
      if (typeof status === 'number' && status >= 400 && status < 500) {
        // Server rejected — drop it, retrying won't help.
        Sentry.captureException(err, {
          tags: { area: 'pending-revokes-drain', outcome: '4xx-dropped' },
        });
        drained++;
      } else {
        // Network/5xx — keep for the next drain attempt.
        remaining.push(token);
      }
    }
  }

  writeQueue(storage, remaining);
  return drained;
}

// Test-only.
export function __resetPendingRevokesForTests(): void {
  queueStorage = null;
}
