import { httpStatusToAppError } from '@gustri/api-client';
import { NetworkError } from '@gustri/core';
import * as Sentry from '@sentry/react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRoutes } from '@/lib/api-routes';
import {
  __resetPendingRevokesForTests,
  drainPendingRevokes,
  enqueuePendingRevoke,
  MAX_AGE_MS,
  MAX_QUEUE_SIZE,
} from '@/lib/pending-revokes';
import { __resetMmkvEncryptionKeyCacheForTests } from '@/lib/storage-key';

// The global `@sentry/react-native` stub exports `noop` for `addBreadcrumb`,
// so spies on the real export don't see calls. Override locally with
// `vi.fn()` to assert breadcrumb counts (same pattern as
// auth-cleanup.test.ts and realtime-patches.test.ts).
vi.mock('@sentry/react-native', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  withScope: vi.fn((cb: (scope: { setExtra: () => void; setTag: () => void }) => void) =>
    cb({ setExtra: () => {}, setTag: () => {} }),
  ),
  Severity: { Error: 'error', Warning: 'warning', Info: 'info' },
}));

const TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaa]';
const TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbb]';

describe('pending-revokes', () => {
  beforeEach(() => {
    __resetPendingRevokesForTests();
    __resetMmkvEncryptionKeyCacheForTests();
    vi.mocked(apiRoutes.pushTokens.revoke).mockReset();
    vi.mocked(apiRoutes.pushTokens.revoke).mockResolvedValue({ revoked: true });
    vi.mocked(Sentry.addBreadcrumb).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('drains queued tokens against the revoke route', async () => {
    await enqueuePendingRevoke(TOKEN_A);
    await enqueuePendingRevoke(TOKEN_B);

    const drained = await drainPendingRevokes();

    expect(drained).toBe(2);
    expect(apiRoutes.pushTokens.revoke).toHaveBeenCalledWith({ expo_token: TOKEN_A });
    expect(apiRoutes.pushTokens.revoke).toHaveBeenCalledWith({ expo_token: TOKEN_B });
  });

  it('is a no-op on an empty queue', async () => {
    const drained = await drainPendingRevokes();
    expect(drained).toBe(0);
    expect(apiRoutes.pushTokens.revoke).not.toHaveBeenCalled();
  });

  it('keeps the entry queued when the revoke fails with a network error', async () => {
    // Production shape: `apiFetchUnauthed` throws `NetworkError` (an
    // AppError with statusCode=0) when the underlying fetch rejects.
    vi.mocked(apiRoutes.pushTokens.revoke).mockRejectedValueOnce(new NetworkError('offline'));
    await enqueuePendingRevoke(TOKEN_A);

    const drained = await drainPendingRevokes();
    expect(drained).toBe(0);

    // Next attempt succeeds — queue must still have the token.
    vi.mocked(apiRoutes.pushTokens.revoke).mockResolvedValueOnce({ revoked: true });
    const drainedAgain = await drainPendingRevokes();
    expect(drainedAgain).toBe(1);
  });

  it('drops 4xx-rejected entries instead of retrying forever', async () => {
    // Production shape: `apiFetchUnauthed` calls `httpStatusToAppError(422,
    // body)` which returns a `ValidationError` whose status field is
    // `statusCode` (not `status`). The drain code reads `.statusCode` via
    // `instanceof AppError`, so this exercises the real path — the
    // pre-fix test mocked `{ status: 422 }` which never matched the live
    // error shape and silently masked the unreachable 4xx-drop branch.
    vi.mocked(apiRoutes.pushTokens.revoke).mockRejectedValueOnce(
      httpStatusToAppError(422, { error: 'invalid_token' }),
    );
    await enqueuePendingRevoke(TOKEN_A);

    const drained = await drainPendingRevokes();
    expect(drained).toBe(1); // counted as drained, not retained

    const drainedAgain = await drainPendingRevokes();
    expect(drainedAgain).toBe(0);
  });

  it('keeps the entry queued when the server returns a 5xx', async () => {
    // 5xx is a server-side hiccup — drainable on the next attempt. Distinct
    // from the 4xx case above because the queue-retain branch needs its
    // own coverage now that the AppError discriminator is the real path.
    vi.mocked(apiRoutes.pushTokens.revoke).mockRejectedValueOnce(
      httpStatusToAppError(503, { error: 'unavailable' }),
    );
    await enqueuePendingRevoke(TOKEN_A);

    const drained = await drainPendingRevokes();
    expect(drained).toBe(0);

    vi.mocked(apiRoutes.pushTokens.revoke).mockResolvedValueOnce({ revoked: true });
    const drainedAgain = await drainPendingRevokes();
    expect(drainedAgain).toBe(1);
  });

  it('dedupes identical tokens', async () => {
    await enqueuePendingRevoke(TOKEN_A);
    await enqueuePendingRevoke(TOKEN_A);
    await enqueuePendingRevoke(TOKEN_A);

    const drained = await drainPendingRevokes();
    expect(drained).toBe(1);
  });

  // ── H4: bounded retention ────────────────────────────────────────────────

  it('drops entries older than MAX_AGE_MS on drain (not retained, not counted)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T00:00:00Z'));

    await enqueuePendingRevoke(TOKEN_A);

    // Advance past the 7-day retention window.
    vi.setSystemTime(new Date(Date.parse('2026-04-01T00:00:00Z') + MAX_AGE_MS + 1_000));

    const drained = await drainPendingRevokes();
    // The aged entry is NOT attempted server-side and NOT counted as drained.
    expect(drained).toBe(0);
    expect(apiRoutes.pushTokens.revoke).not.toHaveBeenCalled();

    // It also shouldn't linger for the next drain — abandonment is final.
    const drainedAgain = await drainPendingRevokes();
    expect(drainedAgain).toBe(0);
    expect(apiRoutes.pushTokens.revoke).not.toHaveBeenCalled();
  });

  it('emits a Sentry breadcrumb when an aged-out entry is dropped', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T00:00:00Z'));

    await enqueuePendingRevoke(TOKEN_A);
    vi.setSystemTime(new Date(Date.parse('2026-04-01T00:00:00Z') + MAX_AGE_MS + 1_000));

    await drainPendingRevokes();

    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(1);
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'pending-revokes',
        message: 'dropped stale entry',
      }),
    );
  });

  it('keeps fresh entries intact when only some are aged out', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T00:00:00Z'));

    await enqueuePendingRevoke(TOKEN_A); // queued at T=0

    // Move forward almost-but-not-quite past the window, then enqueue B.
    vi.setSystemTime(new Date(Date.parse('2026-04-01T00:00:00Z') + MAX_AGE_MS - 1_000));
    await enqueuePendingRevoke(TOKEN_B);

    // Step past the window for A but not for B.
    vi.setSystemTime(new Date(Date.parse('2026-04-01T00:00:00Z') + MAX_AGE_MS + 500));

    const drained = await drainPendingRevokes();
    expect(drained).toBe(1);
    expect(apiRoutes.pushTokens.revoke).toHaveBeenCalledTimes(1);
    expect(apiRoutes.pushTokens.revoke).toHaveBeenCalledWith({ expo_token: TOKEN_B });
  });

  it('caps the queue at MAX_QUEUE_SIZE on enqueue, dropping the oldest first', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T00:00:00Z'));

    // Fill the queue to the cap, then push two more — the two oldest must
    // be evicted.
    for (let i = 0; i < MAX_QUEUE_SIZE; i++) {
      vi.setSystemTime(new Date(Date.parse('2026-04-01T00:00:00Z') + i * 1_000));
      await enqueuePendingRevoke(`ExponentPushToken[fill-${i.toString().padStart(20, '0')}]`);
    }

    vi.setSystemTime(new Date(Date.parse('2026-04-01T00:00:00Z') + (MAX_QUEUE_SIZE + 1) * 1_000));
    await enqueuePendingRevoke(TOKEN_A);
    vi.setSystemTime(new Date(Date.parse('2026-04-01T00:00:00Z') + (MAX_QUEUE_SIZE + 2) * 1_000));
    await enqueuePendingRevoke(TOKEN_B);

    const drained = await drainPendingRevokes();
    expect(drained).toBe(MAX_QUEUE_SIZE);

    const tokensAttempted = vi
      .mocked(apiRoutes.pushTokens.revoke)
      .mock.calls.map((args) => (args[0] as { expo_token: string }).expo_token);

    // The two fills with the lowest enqueuedAt (i=0 and i=1) must be gone.
    expect(tokensAttempted).not.toContain(`ExponentPushToken[fill-${'0'.padStart(20, '0')}]`);
    expect(tokensAttempted).not.toContain(`ExponentPushToken[fill-${'1'.padStart(20, '0')}]`);
    expect(tokensAttempted).toContain(TOKEN_A);
    expect(tokensAttempted).toContain(TOKEN_B);
  });

  it('emits a Sentry breadcrumb on cap-overflow eviction', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T00:00:00Z'));

    for (let i = 0; i < MAX_QUEUE_SIZE; i++) {
      vi.setSystemTime(new Date(Date.parse('2026-04-01T00:00:00Z') + i * 1_000));
      await enqueuePendingRevoke(`ExponentPushToken[fill-${i.toString().padStart(20, '0')}]`);
    }

    vi.mocked(Sentry.addBreadcrumb).mockClear();

    vi.setSystemTime(new Date(Date.parse('2026-04-01T00:00:00Z') + (MAX_QUEUE_SIZE + 1) * 1_000));
    await enqueuePendingRevoke(TOKEN_A);

    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(1);
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'pending-revokes',
        message: 'dropped on overflow',
      }),
    );
  });
});
