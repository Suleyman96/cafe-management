import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `vi.mock` factories are hoisted above all imports, so anything they
// close over has to be declared via `vi.hoisted` to be available at
// hoist time.
const TIMEOUT_MS = 60_000;
const mocks = vi.hoisted(() => ({
  capturedListener: null as ((s: string) => void) | null,
  removeMock: vi.fn(),
  forceLogoutMock: vi.fn(),
  setLastActiveAtMock: vi.fn(),
  readLastActiveAtMock: vi.fn<() => number | null>(),
  clearLastActiveAtMock: vi.fn(),
}));

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: vi.fn((_event: string, cb: (s: string) => void) => {
      mocks.capturedListener = cb;
      return { remove: mocks.removeMock };
    }),
  },
  Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios },
}));

vi.mock('@/lib/auth', () => ({
  forceLogout: mocks.forceLogoutMock,
}));

vi.mock('@/lib/last-active-at', () => ({
  setLastActiveAt: mocks.setLastActiveAtMock,
  readLastActiveAt: mocks.readLastActiveAtMock,
  clearLastActiveAt: mocks.clearLastActiveAtMock,
}));

vi.mock('@gustri/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@gustri/core')>();
  return {
    ...actual,
    getInactivityTimeoutMs: () => TIMEOUT_MS,
  };
});

import { useInactivityLock } from '@/hooks/use-inactivity-lock';
import { useAuthStore } from '@/store/auth-store';
import { seedAuth, TEST_STAFF } from '../helpers/test-utils';

let lastActiveAtValue: number | null = null;

beforeEach(() => {
  mocks.capturedListener = null;
  lastActiveAtValue = null;
  mocks.removeMock.mockClear();
  mocks.forceLogoutMock.mockClear();
  mocks.setLastActiveAtMock.mockReset();
  mocks.setLastActiveAtMock.mockImplementation((v: number) => {
    lastActiveAtValue = v;
  });
  mocks.readLastActiveAtMock.mockReset();
  mocks.readLastActiveAtMock.mockImplementation(() => lastActiveAtValue);
  mocks.clearLastActiveAtMock.mockReset();
  mocks.clearLastActiveAtMock.mockImplementation(() => {
    lastActiveAtValue = null;
  });
  seedAuth(TEST_STAFF);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useInactivityLock', () => {
  it('does nothing when no staff is signed in', () => {
    useAuthStore.setState({ staff: null, isLoading: false });
    renderHook(() => useInactivityLock());
    expect(mocks.capturedListener).toBeNull();
  });

  it('persists Date.now() on background and on inactive', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    renderHook(() => useInactivityLock());
    expect(mocks.capturedListener).toBeTruthy();

    mocks.capturedListener?.('background');
    expect(mocks.setLastActiveAtMock).toHaveBeenLastCalledWith(Date.parse('2026-01-01T00:00:00Z'));

    vi.setSystemTime(new Date('2026-01-01T00:00:05Z'));
    mocks.capturedListener?.('inactive');
    expect(mocks.setLastActiveAtMock).toHaveBeenLastCalledWith(Date.parse('2026-01-01T00:00:05Z'));
  });

  it('does NOT force logout when the resume happens inside the budget', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    renderHook(() => useInactivityLock());
    mocks.capturedListener?.('background');

    // 30s elapsed — well under TIMEOUT_MS (60s).
    vi.setSystemTime(new Date('2026-01-01T00:00:30Z'));
    mocks.capturedListener?.('active');

    expect(mocks.forceLogoutMock).not.toHaveBeenCalled();
    expect(mocks.clearLastActiveAtMock).toHaveBeenCalled();
  });

  it('forces logout when the resume happens outside the budget', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    renderHook(() => useInactivityLock());
    mocks.capturedListener?.('background');

    // 90s elapsed — past TIMEOUT_MS.
    vi.setSystemTime(new Date('2026-01-01T00:01:30Z'));
    mocks.capturedListener?.('active');

    expect(mocks.forceLogoutMock).toHaveBeenCalledWith('inactivity');
  });

  it('no-ops on resume when there is no stamp (cold start path)', () => {
    renderHook(() => useInactivityLock());
    // No prior background → readLastActiveAt returns null.
    mocks.capturedListener?.('active');
    expect(mocks.forceLogoutMock).not.toHaveBeenCalled();
    expect(mocks.clearLastActiveAtMock).not.toHaveBeenCalled();
  });

  it('removes the AppState listener on unmount', () => {
    const { unmount } = renderHook(() => useInactivityLock());
    unmount();
    expect(mocks.removeMock).toHaveBeenCalled();
  });
});
