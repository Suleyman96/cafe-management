import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { channelRegistry } from '@/lib/realtime/channel-registry';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import type { Staff } from '@/types';
import { mockAdminStaff } from '../helpers/mock-auth';
import { createWrapper } from '../helpers/test-utils';

beforeEach(() => {
  // Reset auth store + registry between tests so a stale channel from a
  // prior test can't bleed into the next one.
  useAuthStore.setState({ staff: mockAdminStaff as Staff, isLoading: false });
  channelRegistry.teardownAll();

  // Reset the chainable channel mock — vi.clearAllMocks (in setup) blanks
  // call history but doesn't restore .on/.subscribe to chain `this`. Without
  // this, the second supabase.channel(...) call returns undefined from .on().
  (supabase.channel as ReturnType<typeof vi.fn>).mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  });
});

describe('useRealtimeSync — cache write strategy guard', () => {
  // Pinned by ADR docs/adr/0001-realtime-cache-version-strategy.md.
  //
  // The realtime path must NEVER call queryClient.setQueryData from a
  // postgres_changes handler. Refetches are the source of truth; payload
  // writes from realtime would let an out-of-order event overwrite fresher
  // cache state.
  //
  // If the next change adds payload-shaped writes (e.g. via a
  // `mergeIfNewer(prev, next)` helper) without first revising the ADR, this
  // test fails and forces the conversation. To consciously change the
  // strategy: update the ADR, then update this test to allow setQueryData
  // alongside the new ordering rule.
  it('does not call setQueryData anywhere in the hook source', () => {
    const hookPath = resolve(__dirname, '../../hooks/use-realtime-sync.ts');
    const source = readFileSync(hookPath, 'utf8');

    // Strip line/block comments before scanning so a comment that mentions
    // `setQueryData` (e.g. an ADR back-reference) doesn't trip the guard.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

    expect(code).not.toMatch(/\bsetQueryData\b/);
  });
});

describe('useRealtimeSync', () => {
  const tables = [{ table: 'orders', queryKeys: [['orders']] }];

  it('registers a resubscribe entry on mount', () => {
    const { wrapper } = createWrapper();
    renderHook(() => useRealtimeSync('test-channel', tables), { wrapper });

    expect(channelRegistry.size()).toBe(1);
    // Channel name is suffixed with a per-mount UUID so multi-tab opens of
    // the same logical channel don't collide on the shared supabase client.
    expect(supabase.channel).toHaveBeenCalledWith(expect.stringMatching(/^test-channel:/));
  });

  it('produces distinct channel names per hook instance (multi-tab safety)', () => {
    const { wrapper } = createWrapper();
    renderHook(() => useRealtimeSync('shared-channel', tables), { wrapper });
    renderHook(() => useRealtimeSync('shared-channel', tables), { wrapper });

    // Two mounts of the same logical channel name produce two distinct
    // suffixed names — the registry holds both, neither overwrites the other.
    expect(channelRegistry.size()).toBe(2);
    const channelMock = supabase.channel as ReturnType<typeof vi.fn>;
    const names = channelMock.mock.calls.map((c) => c[0] as string);
    expect(names).toHaveLength(2);
    expect(names[0]).not.toBe(names[1]);
    expect(names[0]).toMatch(/^shared-channel:/);
    expect(names[1]).toMatch(/^shared-channel:/);
  });

  it('unregisters and removes the channel on unmount', () => {
    const { wrapper } = createWrapper();
    const { unmount } = renderHook(() => useRealtimeSync('test-channel', tables), {
      wrapper,
    });

    expect(channelRegistry.size()).toBe(1);
    unmount();
    expect(channelRegistry.size()).toBe(0);
    expect(supabase.removeChannel).toHaveBeenCalled();
  });

  it('resubscribeAll() tears down the old channel and recreates it', () => {
    const { wrapper } = createWrapper();
    renderHook(() => useRealtimeSync('test-channel', tables), { wrapper });

    expect(supabase.channel).toHaveBeenCalledTimes(1);
    const removeCallsBefore = (supabase.removeChannel as ReturnType<typeof vi.fn>).mock.calls
      .length;

    // Simulates the RealtimeAuthBridge reacting to TOKEN_REFRESHED.
    channelRegistry.resubscribeAll();

    expect(supabase.removeChannel).toHaveBeenCalledTimes(removeCallsBefore + 1);
    expect(supabase.channel).toHaveBeenCalledTimes(2);
    // Registry stays the same size — no duplicate entries accumulate.
    expect(channelRegistry.size()).toBe(1);
  });

  it('teardownAll() removes channels and clears the registry', () => {
    const { wrapper } = createWrapper();
    renderHook(() => useRealtimeSync('test-channel', tables), { wrapper });

    expect(channelRegistry.size()).toBe(1);
    channelRegistry.teardownAll();
    expect(channelRegistry.size()).toBe(0);
    expect(supabase.removeChannel).toHaveBeenCalled();
  });

  it('does not subscribe before tenantId is available', () => {
    useAuthStore.setState({ staff: null, isLoading: false });
    const { wrapper } = createWrapper();
    renderHook(() => useRealtimeSync('test-channel', tables), { wrapper });

    expect(supabase.channel).not.toHaveBeenCalled();
    expect(channelRegistry.size()).toBe(0);
  });

  it('coalesces a burst of realtime events into one invalidation per unique key', () => {
    vi.useFakeTimers();

    // Capture the postgres_changes callback so we can simulate event bursts.
    const capturedCallbacks: Array<() => void> = [];
    const channelMock: { on: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> } = {
      on: vi.fn(),
      subscribe: vi.fn(),
    };
    channelMock.on.mockImplementation((_event, _config, cb) => {
      capturedCallbacks.push(cb);
      return channelMock;
    });
    channelMock.subscribe.mockReturnValue(channelMock);
    (supabase.channel as ReturnType<typeof vi.fn>).mockReturnValue(channelMock);

    const burstTables = [{ table: 'order_items', queryKeys: [['orders'], ['active-orders']] }];
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useRealtimeSync('burst-channel', burstTables), { wrapper });

    expect(capturedCallbacks).toHaveLength(1);
    const fire = capturedCallbacks[0]!;

    // Fire 10 events well within the 300ms debounce window.
    for (let i = 0; i < 10; i += 1) {
      fire();
      vi.advanceTimersByTime(5); // 50ms total < 300ms
    }

    // Nothing flushed yet — still inside the debounce window.
    expect(invalidateSpy).not.toHaveBeenCalled();

    // Trailing edge fires once, invalidates each unique key exactly once.
    vi.advanceTimersByTime(300);
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['orders'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['active-orders'] });

    vi.useRealTimers();
  });

  it('refetches affected query keys on reconnect (catch-up after CHANNEL_ERROR)', () => {
    vi.useFakeTimers();

    // Capture the subscribe-status callback so we can drive the lifecycle.
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

    const reconnectTables = [
      { table: 'orders', queryKeys: [['orders'], ['active-orders']] },
      { table: 'order_items', queryKeys: [['order-items']] },
    ];
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useRealtimeSync('reconnect-channel', reconnectTables), { wrapper });

    // First SUBSCRIBED (fresh subscribe — retryCount = 0). No catch-up.
    subscribeCallbacks[0]!('SUBSCRIBED');
    expect(invalidateSpy).not.toHaveBeenCalled();

    // Channel drops, hook schedules a reconnect with backoff.
    subscribeCallbacks[0]!('CHANNEL_ERROR');
    vi.advanceTimersByTime(2_000); // pass the first backoff window

    // The reconnect creates a new channel and registers its own subscribe cb.
    expect(subscribeCallbacks.length).toBeGreaterThanOrEqual(2);

    // Second SUBSCRIBED — this is a reconnect (retryCount > 0). Catch-up fires.
    subscribeCallbacks[subscribeCallbacks.length - 1]!('SUBSCRIBED');

    // Every queryKey across the registered tables should be invalidated once.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['orders'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['active-orders'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['order-items'] });

    vi.useRealTimers();
  });

  it('heartbeat watchdog forces resubscribe after 5 min of silence while subscribed', () => {
    vi.useFakeTimers();

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

    const { wrapper } = createWrapper();
    renderHook(() => useRealtimeSync('hb-channel', tables), { wrapper });

    const channelMockFn = supabase.channel as ReturnType<typeof vi.fn>;
    expect(channelMockFn).toHaveBeenCalledTimes(1);

    // Mark subscribed and stamp lastEventAt by simulating SUBSCRIBED.
    subscribeCallbacks[0]!('SUBSCRIBED');

    // 4 min of silence — under threshold, no resubscribe.
    vi.advanceTimersByTime(4 * 60_000);
    expect(channelMockFn).toHaveBeenCalledTimes(1);

    // Cross the 5 min mark; the next 30s heartbeat tick forces resubscribe.
    vi.advanceTimersByTime(90_000);
    expect(channelMockFn).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('foreground fallback poll uses a 30s cadence; switches to 120s when hidden', () => {
    vi.useFakeTimers();
    const visibilityState = { value: 'visible' as 'visible' | 'hidden' };
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => visibilityState.value === 'hidden',
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState.value,
    });

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

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useRealtimeSync('vis-channel', tables), { wrapper });

    // We never SUBSCRIBE — subscribedRef stays false so the fallback fires.
    // Foreground cadence is 30s.
    vi.advanceTimersByTime(30_000);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);

    // Going hidden swaps cadence to 120s. Wait 60s — no extra fire.
    visibilityState.value = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(60_000);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);

    // Cross the 120s boundary from the visibility flip — fires once.
    vi.advanceTimersByTime(60_000);
    expect(invalidateSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('clears the pending flush timer on unmount so no late invalidation fires', () => {
    vi.useFakeTimers();

    const capturedCallbacks: Array<() => void> = [];
    const channelMock: { on: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> } = {
      on: vi.fn(),
      subscribe: vi.fn(),
    };
    channelMock.on.mockImplementation((_event, _config, cb) => {
      capturedCallbacks.push(cb);
      return channelMock;
    });
    channelMock.subscribe.mockReturnValue(channelMock);
    (supabase.channel as ReturnType<typeof vi.fn>).mockReturnValue(channelMock);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { unmount } = renderHook(() => useRealtimeSync('test-channel', tables), { wrapper });

    capturedCallbacks[0]!();
    unmount();

    vi.advanceTimersByTime(1000);
    expect(invalidateSpy).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
