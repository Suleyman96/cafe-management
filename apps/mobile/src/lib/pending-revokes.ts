import { AppError } from '@gustri/core';
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
 *
 * H4 — bounded retention. Each entry now carries `enqueuedAt`. The drain
 * drops entries older than {@link MAX_AGE_MS} (a token that's been queued
 * for a week against persistent server failure is unlikely to revoke
 * cleanly, and the user-visible hazard is long past). The queue is
 * capped at {@link MAX_QUEUE_SIZE} on enqueue with oldest-first eviction,
 * so a long-broken backend can't grow this MMKV instance unbounded over
 * a multi-day shift cycle. Both drop paths emit Sentry breadcrumbs so
 * the discarded-revoke rate is observable.
 */

const QUEUE_KEY = 'gustri.pending-revokes';
const MMKV_INSTANCE_ID = 'gustri-pending-revokes';

/**
 * Maximum age before an entry is silently dropped on drain. 7 days picks
 * up a long weekend + a few buffer days; longer than that and the
 * device-binding context the token belonged to is almost certainly stale.
 */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Hard cap on queue size. Logout-without-network is rare in normal
 * operation; 50 is generous (a staff list of 20 cycling shifts twice
 * per day on a 7-day failure window) without letting MMKV grow unbounded.
 */
export const MAX_QUEUE_SIZE = 50;

interface PendingRevokeEntry {
  token: string;
  enqueuedAt: number;
}

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
  // Pre-encryption / pre-H4 legacy data won't decrypt or won't conform to
  // the entry shape. Losing a pending revoke is acceptable — at worst,
  // the next user on the device receives one extra notification before
  // their first sync evicts the prior token.
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

function isPendingRevokeEntry(value: unknown): value is PendingRevokeEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.token === 'string' && typeof v.enqueuedAt === 'number';
}

function readQueue(storage: MMKV): PendingRevokeEntry[] {
  const raw = storage.getString(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(isPendingRevokeEntry)) {
      return parsed;
    }
    // Legacy shape (string[]) or malformed — drop. See module doc.
    return [];
  } catch {
    return [];
  }
}

function writeQueue(storage: MMKV, queue: PendingRevokeEntry[]): void {
  storage.set(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueuePendingRevoke(expoToken: string): Promise<void> {
  if (!expoToken) return;
  const storage = await getQueueStorage();
  const queue = readQueue(storage);
  if (queue.some((e) => e.token === expoToken)) return;

  const next: PendingRevokeEntry[] = [...queue, { token: expoToken, enqueuedAt: Date.now() }];
  if (next.length > MAX_QUEUE_SIZE) {
    // H4: cap and evict oldest first. Sort by enqueuedAt ascending so
    // `slice` from the end retains the freshest MAX_QUEUE_SIZE entries.
    next.sort((a, b) => a.enqueuedAt - b.enqueuedAt);
    const overflow = next.slice(0, next.length - MAX_QUEUE_SIZE);
    for (const dropped of overflow) {
      Sentry.addBreadcrumb({
        category: 'pending-revokes',
        level: 'info',
        message: 'dropped on overflow',
        data: { ageMs: Date.now() - dropped.enqueuedAt, queueSize: next.length },
      });
    }
    writeQueue(storage, next.slice(next.length - MAX_QUEUE_SIZE));
    return;
  }
  writeQueue(storage, next);
}

/**
 * Try to revoke every queued token. Tokens that succeed (or fail with a
 * 4xx — the server rejected them, retrying won't help) are removed.
 * Network failures keep the entry queued for the next drain.
 *
 * H4: entries older than {@link MAX_AGE_MS} are dropped before any server
 * call — they are not counted toward the returned drain count (drain
 * means "server resolved the entry" — success or 4xx). Aged-out drops
 * are abandonments, not server-acknowledged removals.
 *
 * Returns the count of tokens drained successfully.
 */
export async function drainPendingRevokes(): Promise<number> {
  const storage = await getQueueStorage();
  const queue = readQueue(storage);
  if (queue.length === 0) return 0;

  const now = Date.now();
  const fresh: PendingRevokeEntry[] = [];
  for (const entry of queue) {
    if (now - entry.enqueuedAt > MAX_AGE_MS) {
      Sentry.addBreadcrumb({
        category: 'pending-revokes',
        level: 'info',
        message: 'dropped stale entry',
        data: { ageMs: now - entry.enqueuedAt },
      });
      continue;
    }
    fresh.push(entry);
  }

  const remaining: PendingRevokeEntry[] = [];
  let drained = 0;

  for (const entry of fresh) {
    try {
      await apiRoutes.pushTokens.revoke({ expo_token: entry.token });
      drained++;
    } catch (err) {
      // `apiFetchUnauthed` throws `AppError` subclasses produced by
      // `httpStatusToAppError`, whose status field is `statusCode` (NOT
      // `status`). Reading `.status` here was always undefined and the
      // 4xx-drop branch was unreachable — failed-permanently tokens stayed
      // queued forever. The `instanceof AppError` check makes the lookup
      // rename-resilient; non-AppError throws (e.g. native fetch failures
      // wrapped as `NetworkError` lower in the stack) fall through to the
      // retain-and-retry branch as before.
      const statusCode = err instanceof AppError ? err.statusCode : undefined;
      if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
        // Server rejected — drop it, retrying won't help.
        Sentry.captureException(err, {
          tags: { area: 'pending-revokes-drain', outcome: '4xx-dropped' },
        });
        drained++;
      } else {
        // Network/5xx — keep for the next drain attempt.
        remaining.push(entry);
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
