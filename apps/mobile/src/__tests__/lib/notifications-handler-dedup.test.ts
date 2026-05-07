/**
 * Mobile audit #7 — Expo / FCM / APNs can re-invoke the foreground
 * notification handler with the same `request.identifier` during reconnect,
 * app boot, or rare OS retry paths. Belt-and-braces dedup keys on the
 * identifier with a 60 s window so the second invocation suppresses sound.
 *
 * The test spies the handler the module installs at import time via
 * `Notifications.setNotificationHandler`, then drives it with synthetic
 * payloads. We're asserting the contract of the handler function, not the
 * behavior of `expo-notifications`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `vi.mock` is hoisted, so it can't capture top-level variables. Use
// `vi.hoisted` to lift the spy reference alongside it.
const { setNotificationHandler } = vi.hoisted(() => ({
  setNotificationHandler: vi.fn(),
}));
vi.mock('expo-notifications', () => ({
  setNotificationHandler,
  scheduleNotificationAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  AndroidImportance: { MAX: 5 },
}));
vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { eas: {} } } },
}));
vi.mock('expo-device', () => ({ isDevice: false }));

type HandleNotification = (input: {
  request: {
    identifier: string;
    content: { data?: Record<string, unknown> };
  };
}) => Promise<{
  shouldShowBanner: boolean;
  shouldShowList: boolean;
  shouldPlaySound: boolean;
  shouldSetBadge: boolean;
}>;

// Importing the module wires up the handler exactly once. Capture the
// reference at module-load time — `vi.clearAllMocks` in setup.ts wipes
// `setNotificationHandler.mock.calls` between tests, so we can't read it
// inside `beforeEach`.
import '@/lib/notifications';
import { __resetEventDedupForTests } from '@/lib/event-dedup';

const handlerArg = setNotificationHandler.mock.calls[0]?.[0] as
  | { handleNotification: HandleNotification }
  | undefined;
const handler: HandleNotification = (() => {
  if (!handlerArg) {
    throw new Error(
      'setNotificationHandler was not called at module load — check the import order in this test file.',
    );
  }
  return handlerArg.handleNotification;
})();

function makeNotification(opts: {
  identifier: string;
  type?: string;
  orderId?: string;
  tableId?: string;
}) {
  return {
    request: {
      identifier: opts.identifier,
      content: {
        data: {
          ...(opts.type ? { type: opts.type } : {}),
          ...(opts.orderId ? { orderId: opts.orderId } : {}),
          ...(opts.tableId ? { tableId: opts.tableId } : {}),
        },
      },
    },
  };
}

describe('notifications handler — OS-redelivery dedup (audit #7)', () => {
  beforeEach(() => {
    __resetEventDedupForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays sound on first delivery of a notification request id', async () => {
    const result = await handler(
      makeNotification({ identifier: 'notif-1', type: 'new_order', orderId: 'o1' }),
    );
    expect(result.shouldPlaySound).toBe(true);
  });

  it('suppresses sound on re-delivery of the same identifier within 60 s', async () => {
    await handler(makeNotification({ identifier: 'notif-1', type: 'new_order', orderId: 'o1' }));
    vi.advanceTimersByTime(30_000); // well past the 500 ms event-id race window

    const result = await handler(
      // Same identifier, but use a different orderId so the event-id dedup
      // path can't be the one suppressing — we want to prove the
      // identifier-keyed gate is doing the work.
      makeNotification({ identifier: 'notif-1', type: 'new_order', orderId: 'o2' }),
    );

    expect(result.shouldPlaySound).toBe(false);
  });

  it('plays sound for a different identifier even at the same instant', async () => {
    await handler(makeNotification({ identifier: 'notif-1', type: 'new_order', orderId: 'o1' }));
    const result = await handler(
      makeNotification({ identifier: 'notif-2', type: 'new_order', orderId: 'o2' }),
    );

    expect(result.shouldPlaySound).toBe(true);
  });

  it('plays sound again past the 60 s redelivery window', async () => {
    await handler(makeNotification({ identifier: 'notif-1', type: 'new_order', orderId: 'o1' }));
    vi.advanceTimersByTime(61_000);
    const result = await handler(
      makeNotification({ identifier: 'notif-1', type: 'new_order', orderId: 'o2' }),
    );

    expect(result.shouldPlaySound).toBe(true);
  });

  it('still suppresses via the existing event-id race window when identifier is unseen', async () => {
    // Pre-stamp the event-id (simulates the realtime path firing first).
    const { markEvent } = await import('@/lib/event-dedup');
    markEvent('order:o-race');

    const result = await handler(
      // Identifier is brand-new, but orderId matches the recently-marked event.
      makeNotification({ identifier: 'notif-fresh', type: 'new_order', orderId: 'o-race' }),
    );
    expect(result.shouldPlaySound).toBe(false);
  });
});
