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
    vi.mocked(apiRoutes.pushTokens.revoke).mockRejectedValueOnce(
      Object.assign(new Error('offline'), { name: 'NetworkError' }),
    );
    await enqueuePendingRevoke(TOKEN_A);

    const drained = await drainPendingRevokes();
    expect(drained).toBe(0);

    // Next attempt succeeds — queue must still have the token.
    vi.mocked(apiRoutes.pushTokens.revoke).mockResolvedValueOnce({ revoked: true });
    const drainedAgain = await drainPendingRevokes();
    expect(drainedAgain).toBe(1);
  });

  it('drops 4xx-rejected entries instead of retrying forever', async () => {
    vi.mocked(apiRoutes.pushTokens.revoke).mockRejectedValueOnce(
      Object.assign(new Error('bad'), { status: 422 }),
    );
    await enqueuePendingRevoke(TOKEN_A);

    const drained = await drainPendingRevokes();
    expect(drained).toBe(1); // counted as drained, not retained

    const drainedAgain = await drainPendingRevokes();
    expect(drainedAgain).toBe(0);
  });

  it('dedupes identical tokens', async () => {
    await enqueuePendingRevoke(TOKEN_A);
    await enqueuePendingRevoke(TOKEN_A);
    await enqueuePendingRevoke(TOKEN_A);

    const drained = await drainPendingRevokes();
    expect(drained).toBe(1);
  });
});
