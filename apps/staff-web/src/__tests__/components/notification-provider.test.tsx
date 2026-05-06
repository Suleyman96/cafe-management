import type { SupabaseWrapper } from '@gustri/api-client';
import { DbProvider } from '@gustri/queries';
import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '@/components/providers/notification-provider';
import { channelRegistry } from '@/lib/realtime/channel-registry';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import type { Staff } from '@/types';
import { mockAdminStaff } from '../helpers/mock-auth';
import { createMockDb } from '../helpers/mock-db';

// NotificationProvider calls useDb() to run the post-reconnect catchup
// query (Plan 10). The mock db only needs the methods runCatchup touches —
// findChangedSince + findCreatedSince — so we extend the shared mock here.
type MockDbWithCatchup = SupabaseWrapper & {
  orders: { findChangedSince: ReturnType<typeof vi.fn> };
  waiterCalls: { findCreatedSince: ReturnType<typeof vi.fn> };
};

function buildMockDbWithCatchup(): MockDbWithCatchup {
  const db = createMockDb() as unknown as MockDbWithCatchup;
  db.orders.findChangedSince = vi.fn().mockResolvedValue([]);
  db.waiterCalls.findCreatedSince = vi.fn().mockResolvedValue([]);
  return db;
}

function withDbProvider({
  children,
  db = buildMockDbWithCatchup(),
}: {
  children: ReactNode;
  db?: MockDbWithCatchup;
}) {
  return <DbProvider db={db}>{children}</DbProvider>;
}

beforeEach(() => {
  useAuthStore.setState({ staff: mockAdminStaff as Staff, isLoading: false });
  channelRegistry.teardownAll();

  // Restore the chainable channel mock — vi.clearAllMocks blanks call history
  // but doesn't restore .on/.subscribe to chain `this`.
  (supabase.channel as ReturnType<typeof vi.fn>).mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  });
});

describe('NotificationProvider — channel registry integration', () => {
  it('registers exactly one entry on mount and unregisters on unmount', () => {
    const { unmount } = render(
      withDbProvider({
        children: (
          <NotificationProvider>
            <div />
          </NotificationProvider>
        ),
      }),
    );

    expect(channelRegistry.size()).toBe(1);
    expect(supabase.channel).toHaveBeenCalledTimes(1);
    // Channel name is suffixed so multi-tab opens of the same provider don't
    // collide on the shared supabase client.
    expect(supabase.channel).toHaveBeenCalledWith(expect.stringMatching(/^notify-all:/));

    unmount();
    expect(channelRegistry.size()).toBe(0);
    expect(supabase.removeChannel).toHaveBeenCalled();
  });

  it('resubscribeAll() (TOKEN_REFRESHED) tears down the stale channel and creates a fresh one', () => {
    render(
      withDbProvider({
        children: (
          <NotificationProvider>
            <div />
          </NotificationProvider>
        ),
      }),
    );

    expect(supabase.channel).toHaveBeenCalledTimes(1);
    const removeBefore = (supabase.removeChannel as ReturnType<typeof vi.fn>).mock.calls.length;

    // Simulates the RealtimeAuthBridge reacting to TOKEN_REFRESHED. Without
    // this rebind, the kitchen view stops receiving alerts after ~55 min.
    channelRegistry.resubscribeAll();

    expect(supabase.removeChannel).toHaveBeenCalledTimes(removeBefore + 1);
    expect(supabase.channel).toHaveBeenCalledTimes(2);
    expect(channelRegistry.size()).toBe(1);
  });

  it('does not subscribe before tenantId is available', () => {
    useAuthStore.setState({ staff: null, isLoading: false });

    render(
      withDbProvider({
        children: (
          <NotificationProvider>
            <div />
          </NotificationProvider>
        ),
      }),
    );

    expect(supabase.channel).not.toHaveBeenCalled();
    expect(channelRegistry.size()).toBe(0);
  });

  it('produces distinct registry keys per provider instance (multi-tab safety)', () => {
    render(
      withDbProvider({
        children: (
          <NotificationProvider>
            <div />
          </NotificationProvider>
        ),
      }),
    );
    render(
      withDbProvider({
        children: (
          <NotificationProvider>
            <div />
          </NotificationProvider>
        ),
      }),
    );

    expect(channelRegistry.size()).toBe(2);
    const channelMock = supabase.channel as ReturnType<typeof vi.fn>;
    const names = channelMock.mock.calls.map((c) => c[0] as string);
    expect(names[0]).not.toBe(names[1]);
    expect(names[0]).toMatch(/^notify-all:/);
    expect(names[1]).toMatch(/^notify-all:/);
  });
});

describe('NotificationProvider — Plan 10 replay-since-checkpoint', () => {
  // Capture the subscribe callback off the channel mock so tests can drive
  // the lifecycle: SUBSCRIBED → CHANNEL_ERROR → SUBSCRIBED simulates a real
  // websocket drop+reconnect, which is the only path that should trigger
  // the catchup query. The first SUBSCRIBED must NOT trigger catchup —
  // there is no missed window on initial mount.
  function setupChannelMock() {
    const subscribeCallbacks: Array<(status: string) => void> = [];
    const channelMock: { on: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> } = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    };
    channelMock.subscribe.mockImplementation((cb) => {
      subscribeCallbacks.push(cb);
      return channelMock;
    });
    (supabase.channel as ReturnType<typeof vi.fn>).mockReturnValue(channelMock);
    return { subscribeCallbacks };
  }

  it('does NOT call findChangedSince on the first SUBSCRIBED (initial mount)', async () => {
    const { subscribeCallbacks } = setupChannelMock();
    const db = buildMockDbWithCatchup();

    render(
      withDbProvider({
        db,
        children: (
          <NotificationProvider>
            <div />
          </NotificationProvider>
        ),
      }),
    );

    // First SUBSCRIBED: retryCountRef === 0 → not a reconnect → no catchup.
    await act(async () => {
      subscribeCallbacks[0]('SUBSCRIBED');
    });

    expect(db.orders.findChangedSince).not.toHaveBeenCalled();
    expect(db.waiterCalls.findCreatedSince).not.toHaveBeenCalled();
  });

  it('calls findChangedSince + findCreatedSince after reconnect (CHANNEL_ERROR → SUBSCRIBED)', async () => {
    vi.useFakeTimers();
    const { subscribeCallbacks } = setupChannelMock();
    const db = buildMockDbWithCatchup();

    render(
      withDbProvider({
        db,
        children: (
          <NotificationProvider>
            <div />
          </NotificationProvider>
        ),
      }),
    );

    // Initial subscribe + drop. The hook schedules a reconnect with backoff.
    await act(async () => {
      subscribeCallbacks[0]('SUBSCRIBED');
    });
    await act(async () => {
      subscribeCallbacks[0]('CHANNEL_ERROR');
    });
    // Advance past the first backoff window so setupChannel runs again.
    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });

    expect(subscribeCallbacks.length).toBeGreaterThanOrEqual(2);

    // Switch back to real timers so the catchup promise (a microtask, not a
    // timer) actually resolves — fake timers don't drive microtasks.
    vi.useRealTimers();

    // Second SUBSCRIBED — this is the reconnect path. Catchup fires.
    await act(async () => {
      subscribeCallbacks[subscribeCallbacks.length - 1]('SUBSCRIBED');
      // Yield to let the catchup promise chain resolve.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(db.orders.findChangedSince).toHaveBeenCalledTimes(1);
    expect(db.waiterCalls.findCreatedSince).toHaveBeenCalledTimes(1);
    // First arg is a Date, second is the limit option.
    const [sinceArg, optsArg] = (db.orders.findChangedSince as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(sinceArg).toBeInstanceOf(Date);
    expect(optsArg).toEqual({ limit: 200 });
  });
});
