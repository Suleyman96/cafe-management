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

describe('useRealtimeSync', () => {
  const tables = [{ table: 'orders', queryKeys: [['orders']] }];

  it('registers a resubscribe entry on mount', () => {
    const { wrapper } = createWrapper();
    renderHook(() => useRealtimeSync('test-channel', tables), { wrapper });

    expect(channelRegistry.size()).toBe(1);
    expect(supabase.channel).toHaveBeenCalledWith('test-channel');
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
    const fire = capturedCallbacks[0];

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

    capturedCallbacks[0]();
    unmount();

    vi.advanceTimersByTime(1000);
    expect(invalidateSpy).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
