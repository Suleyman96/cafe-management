import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withOptimisticTtl } from '@/lib/optimistic-ttl';

describe('withOptimisticTtl', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    queryClient.clear();
  });

  it('invalidates the registered keys after the TTL elapses', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    withOptimisticTtl(queryClient, [['orders'], ['tables']], 10_000);

    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(9_999);
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(2);
    const calls = spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
    expect(calls).toContainEqual(['orders']);
    expect(calls).toContainEqual(['tables']);
  });

  it('cancel() prevents the invalidation', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const cancel = withOptimisticTtl(queryClient, [['orders']], 10_000);

    cancel();
    vi.advanceTimersByTime(20_000);

    expect(spy).not.toHaveBeenCalled();
  });

  it('uses 10s as the default TTL', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    withOptimisticTtl(queryClient, [['orders']]);

    vi.advanceTimersByTime(9_999);
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('a custom ms overrides the default', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    withOptimisticTtl(queryClient, [['orders']], 250);

    vi.advanceTimersByTime(250);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('multiple concurrent timers fire independently', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    withOptimisticTtl(queryClient, [['a']], 1_000);
    const cancelB = withOptimisticTtl(queryClient, [['b']], 2_000);

    cancelB();
    vi.advanceTimersByTime(2_000);

    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0]?.[0] as { queryKey: unknown }).queryKey).toEqual(['a']);
  });
});
