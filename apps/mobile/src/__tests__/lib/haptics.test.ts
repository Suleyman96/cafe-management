/**
 * Mobile audit #6 — coalesce haptic calls to ≤ 1 buzz / 300 ms per type.
 *
 * Before this change, a 5-events-in-200ms burst (post-reconnect replay,
 * printer-driven catchup) queued five vibrations on the CoreHaptics /
 * Vibrator OS resource and the device buzzed for seconds. The fix mirrors
 * the existing 300 ms floor in `sound.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `vi.mock` is hoisted, so it can't capture top-level variables. Use
// `vi.hoisted` to lift the spy reference alongside it.
const { notificationAsync } = vi.hoisted(() => ({
  notificationAsync: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('expo-haptics', () => ({
  notificationAsync,
  NotificationFeedbackType: {
    Warning: 'Warning',
    Success: 'Success',
  },
}));

// `setup.ts` globally mocks `@/lib/haptics` so other tests don't pull in
// expo-modules-core. This test exercises the real coalescing logic, so we
// re-import the actual module here. File-level vi.mock takes precedence
// over the setup-level one for this file only.
vi.mock('@/lib/haptics', async () => {
  return await vi.importActual<typeof import('@/lib/haptics')>('@/lib/haptics');
});

import { __resetHapticCoalescingForTests, hapticEvent, hapticSuccess } from '@/lib/haptics';

describe('haptics — coalescing (audit #6)', () => {
  beforeEach(() => {
    __resetHapticCoalescingForTests();
    notificationAsync.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hapticEvent fires once for a single call', () => {
    hapticEvent();
    expect(notificationAsync).toHaveBeenCalledTimes(1);
    expect(notificationAsync).toHaveBeenCalledWith('Warning');
  });

  it('hapticEvent collapses 5 calls within 200 ms into one buzz', () => {
    for (let i = 0; i < 5; i++) {
      hapticEvent();
      vi.advanceTimersByTime(40); // 5 × 40 ms = 200 ms total
    }
    expect(notificationAsync).toHaveBeenCalledTimes(1);
  });

  it('hapticEvent fires again past the 300 ms floor', () => {
    hapticEvent();
    vi.advanceTimersByTime(310);
    hapticEvent();
    expect(notificationAsync).toHaveBeenCalledTimes(2);
  });

  it('hapticEvent and hapticSuccess have independent coalescing keys', () => {
    // A user action firing hapticSuccess shouldn't be silenced because a
    // realtime event just fired hapticEvent — they signal different things.
    hapticEvent();
    hapticSuccess();
    expect(notificationAsync).toHaveBeenCalledTimes(2);
    expect(notificationAsync).toHaveBeenNthCalledWith(1, 'Warning');
    expect(notificationAsync).toHaveBeenNthCalledWith(2, 'Success');
  });

  it('does not surface rejection from the underlying haptics call', async () => {
    notificationAsync.mockRejectedValueOnce(new Error('no vibrator'));
    expect(() => hapticEvent()).not.toThrow();
    // Drain microtasks so the .catch runs without an unhandled rejection.
    await Promise.resolve();
  });
});
