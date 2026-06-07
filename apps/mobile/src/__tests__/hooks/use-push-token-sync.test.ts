import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `vi.mock` factories are hoisted above imports, so anything they close over
// must come from `vi.hoisted`.
const mocks = vi.hoisted(() => ({
  capturedListener: null as ((s: string) => void) | null,
  removeMock: vi.fn(),
  registerMock: vi.fn<() => Promise<string | null>>(),
  captureMock: vi.fn(),
  platform: { OS: 'ios' as string },
}));

// The global alias maps @sentry/react-native to a noop stub; override
// captureException with a spy so the error-path test can assert on it.
vi.mock('@sentry/react-native', () => ({
  captureException: mocks.captureMock,
  captureMessage: vi.fn(),
  init: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  withScope: (cb: (s: { setExtra: () => void; setTag: () => void }) => void) =>
    cb({ setExtra: () => {}, setTag: () => {} }),
  Severity: { Error: 'error', Warning: 'warning', Info: 'info' },
}));

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: vi.fn((_event: string, cb: (s: string) => void) => {
      mocks.capturedListener = cb;
      return { remove: mocks.removeMock };
    }),
  },
  // Same object reference each read, so a test can flip `.OS` between cases.
  Platform: mocks.platform,
}));

vi.mock('@/lib/notifications', () => ({
  registerForPushNotifications: mocks.registerMock,
}));

vi.mock('@/lib/storage-key', () => ({
  getOrCreateMmkvEncryptionKey: vi.fn().mockResolvedValue('test-encryption-key'),
}));

import {
  clearPushTokenSyncCache,
  readLastSyncedExpoToken,
  usePushTokenSync,
} from '@/hooks/use-push-token-sync';
import { apiRoutes } from '@/lib/api-routes';
import { seedAuth, TEST_STAFF } from '../helpers/test-utils';

const register = apiRoutes.pushTokens.register as ReturnType<typeof vi.fn>;
const captureException = mocks.captureMock;

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  // Reset the module-level MMKV dedup singleton so each test starts cold.
  clearPushTokenSyncCache();
  mocks.capturedListener = null;
  mocks.platform.OS = 'ios';
  mocks.removeMock.mockClear();
  register.mockClear();
  captureException.mockClear();
  mocks.registerMock.mockReset();
  mocks.registerMock.mockResolvedValue('ExponentPushToken[abc123]');
  seedAuth(null);
});

afterEach(() => {
  clearPushTokenSyncCache();
});

describe('usePushTokenSync', () => {
  it('does nothing when there is no signed-in staff', async () => {
    seedAuth(null);
    renderHook(() => usePushTokenSync());
    await flush();
    expect(mocks.registerMock).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  it('registers the push token on mount with the resolved platform', async () => {
    seedAuth(TEST_STAFF);
    renderHook(() => usePushTokenSync());

    await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith({
      expo_token: 'ExponentPushToken[abc123]',
      platform: 'ios',
    });
  });

  it('maps an unknown Platform.OS to a null platform', async () => {
    mocks.platform.OS = 'web';
    seedAuth(TEST_STAFF);
    renderHook(() => usePushTokenSync());

    await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith({
      expo_token: 'ExponentPushToken[abc123]',
      platform: null,
    });
  });

  it('does not call the register route when no token is returned', async () => {
    mocks.registerMock.mockResolvedValue(null);
    seedAuth(TEST_STAFF);
    renderHook(() => usePushTokenSync());
    await flush();
    expect(register).not.toHaveBeenCalled();
  });

  it('skips a second sync inside the MIN_RESYNC floor (AppState bounce)', async () => {
    seedAuth(TEST_STAFF);
    renderHook(() => usePushTokenSync());
    await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));

    // A foreground transition moments later must NOT re-hit the route — the
    // 60s floor short-circuits before registerForPushNotifications.
    mocks.capturedListener?.('active');
    await flush();
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('ignores non-active AppState transitions', async () => {
    seedAuth(TEST_STAFF);
    renderHook(() => usePushTokenSync());
    await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));

    mocks.capturedListener?.('background');
    await flush();
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('captures errors to Sentry without throwing', async () => {
    mocks.registerMock.mockRejectedValue(new Error('expo down'));
    seedAuth(TEST_STAFF);
    renderHook(() => usePushTokenSync());

    await vi.waitFor(() => expect(captureException).toHaveBeenCalled());
    expect(captureException.mock.calls[0]![1]).toMatchObject({
      tags: { area: 'push-token-sync' },
    });
  });

  it('removes the AppState listener on unmount', async () => {
    seedAuth(TEST_STAFF);
    const { unmount } = renderHook(() => usePushTokenSync());
    await flush();
    unmount();
    expect(mocks.removeMock).toHaveBeenCalled();
  });
});

describe('readLastSyncedExpoToken', () => {
  it('returns null before any sync has populated the cache', () => {
    expect(readLastSyncedExpoToken(TEST_STAFF.id)).toBeNull();
  });

  it('returns the token for the owning staff after a sync, null for others', async () => {
    seedAuth(TEST_STAFF);
    renderHook(() => usePushTokenSync());
    await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));

    expect(readLastSyncedExpoToken(TEST_STAFF.id)).toBe('ExponentPushToken[abc123]');
    // A different staff id (mid-tenant-switch) must not read another staff's token.
    expect(readLastSyncedExpoToken('different-staff-id')).toBeNull();
  });

  it('returns null after the cache is cleared', async () => {
    seedAuth(TEST_STAFF);
    renderHook(() => usePushTokenSync());
    await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(readLastSyncedExpoToken(TEST_STAFF.id)).toBe('ExponentPushToken[abc123]');

    clearPushTokenSyncCache();
    expect(readLastSyncedExpoToken(TEST_STAFF.id)).toBeNull();
  });
});
