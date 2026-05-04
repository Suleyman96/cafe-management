import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { channelRegistry } from '@/lib/realtime/channel-registry';
import { LifecycleBridge } from '@/lib/realtime/lifecycle-bridge';
import { createWrapper } from '../../helpers/test-utils';

describe('LifecycleBridge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Make jitter deterministic so tests don't race the 0–500ms window.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    channelRegistry.teardownAll();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setVisibility(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => state,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  it('resubscribes channels and invalidates queries when the tab becomes visible', () => {
    const { wrapper, queryClient } = createWrapper();
    const resubscribeSpy = vi.spyOn(channelRegistry, 'resubscribeAll');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(<LifecycleBridge />, { wrapper });

    setVisibility('hidden');
    setVisibility('visible');

    expect(resubscribeSpy).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();

    // Jitter (0ms here) elapses → wake fires.
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(resubscribeSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it('refires on the `online` event', () => {
    const { wrapper, queryClient } = createWrapper();
    const resubscribeSpy = vi.spyOn(channelRegistry, 'resubscribeAll');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(<LifecycleBridge />, { wrapper });

    window.dispatchEvent(new Event('online'));
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(resubscribeSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it('throttles bursty wake events into one fire per 2s window', () => {
    const { wrapper, queryClient } = createWrapper();
    const resubscribeSpy = vi.spyOn(channelRegistry, 'resubscribeAll');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(<LifecycleBridge />, { wrapper });

    // First wake schedules a jittered fire.
    window.dispatchEvent(new Event('online'));
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(resubscribeSpy).toHaveBeenCalledTimes(1);

    // Burst of additional wakes within the throttle window — all coalesced.
    for (let i = 0; i < 10; i += 1) {
      window.dispatchEvent(new Event('online'));
      setVisibility('visible');
    }
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(resubscribeSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);

    // Past the throttle window, the next wake fires again.
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    window.dispatchEvent(new Event('online'));
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(resubscribeSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });

  it('ignores visibilitychange when the tab is hidden', () => {
    const { wrapper, queryClient } = createWrapper();
    const resubscribeSpy = vi.spyOn(channelRegistry, 'resubscribeAll');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(<LifecycleBridge />, { wrapper });

    setVisibility('hidden');
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(resubscribeSpy).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('removes its listeners on unmount', () => {
    const { wrapper, queryClient } = createWrapper();
    const resubscribeSpy = vi.spyOn(channelRegistry, 'resubscribeAll');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { unmount } = render(<LifecycleBridge />, { wrapper });
    unmount();

    window.dispatchEvent(new Event('online'));
    setVisibility('visible');
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(resubscribeSpy).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
