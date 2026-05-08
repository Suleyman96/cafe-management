import { httpStatusToAppError } from '@gustri/api-client';
import { NetworkError } from '@gustri/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRoutes } from '@/lib/api-routes';
import {
  __resetPendingRevokesForTests,
  drainPendingRevokes,
  enqueuePendingRevoke,
} from '@/lib/pending-revokes';
import { __resetMmkvEncryptionKeyCacheForTests } from '@/lib/storage-key';

const TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaa]';
const TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbb]';

describe('pending-revokes', () => {
  beforeEach(() => {
    __resetPendingRevokesForTests();
    __resetMmkvEncryptionKeyCacheForTests();
    vi.mocked(apiRoutes.pushTokens.revoke).mockReset();
    vi.mocked(apiRoutes.pushTokens.revoke).mockResolvedValue({ revoked: true });
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
});
