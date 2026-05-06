import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePendingAction } from '@/hooks/use-pending-action';

describe('usePendingAction', () => {
  it('runs the function once when called and exposes pending state until settle', async () => {
    const { result } = renderHook(() => usePendingAction<'mark-ready'>());

    let resolveFn: (() => void) | undefined;
    const fn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFn = () => resolve('done');
        }),
    );

    let runPromise!: Promise<string | undefined>;
    act(() => {
      runPromise = result.current.run('mark-ready', fn);
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.current.isPending('mark-ready')).toBe(true);

    await act(async () => {
      resolveFn?.();
      await runPromise;
    });

    expect(result.current.isPending('mark-ready')).toBe(false);
  });

  it('swallows synchronous repeat calls with the same key while one is in flight', async () => {
    const { result } = renderHook(() => usePendingAction<'k'>());

    let resolveFn: (() => void) | undefined;
    const fn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFn = resolve;
        }),
    );

    // Three taps in the same tick — the ref-based gate inside the hook
    // keeps two of them from firing the function. State-based gates lose
    // this race because React hasn't committed the new pending set yet.
    let p1!: Promise<unknown>;
    let p2!: Promise<unknown>;
    let p3!: Promise<unknown>;
    act(() => {
      p1 = result.current.run('k', fn);
      p2 = result.current.run('k', fn);
      p3 = result.current.run('k', fn);
    });

    expect(fn).toHaveBeenCalledTimes(1);
    await expect(p2).resolves.toBeUndefined();
    await expect(p3).resolves.toBeUndefined();

    await act(async () => {
      resolveFn?.();
      await p1;
    });

    expect(result.current.isPending('k')).toBe(false);
  });

  it('isolates pending state per key so unrelated buttons stay clickable', async () => {
    const { result } = renderHook(() => usePendingAction<'a' | 'b'>());

    let resolveA: (() => void) | undefined;
    const fnA = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveA = resolve;
        }),
    );
    const fnB = vi.fn(() => Promise.resolve('b-done'));

    let pA!: Promise<unknown>;
    act(() => {
      pA = result.current.run('a', fnA);
    });
    expect(result.current.isPending('a')).toBe(true);
    expect(result.current.isPending('b')).toBe(false);

    await act(async () => {
      await result.current.run('b', fnB);
    });
    expect(fnB).toHaveBeenCalledTimes(1);
    // 'a' is still locked while only 'b' settled.
    expect(result.current.isPending('a')).toBe(true);

    await act(async () => {
      resolveA?.();
      await pA;
    });
    expect(result.current.isPending('a')).toBe(false);
  });

  it('releases the lock when fn rejects so the user can retry', async () => {
    const { result } = renderHook(() => usePendingAction<'k'>());

    const failing = vi.fn(() => Promise.reject(new Error('network down')));
    let p!: Promise<unknown>;
    act(() => {
      p = result.current.run('k', failing);
    });

    await act(async () => {
      await expect(p).rejects.toThrow('network down');
    });

    expect(result.current.isPending('k')).toBe(false);
  });
});
