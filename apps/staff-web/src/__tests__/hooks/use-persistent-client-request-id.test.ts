/**
 * Regression tests for the persistent client_request_id used by the
 * payment / refund / discount modals. The bug this guards: cashier
 * hits a 503 on a payment, closes the modal, reopens it, retries —
 * the id MUST be the same string so the server's
 * (tenant_id, client_request_id) partial unique index dedupes the
 * duplicate write.
 */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePersistentClientRequestId } from '@/hooks/use-persistent-client-request-id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const STORAGE_PREFIX = 'gustri:crid:';

describe('usePersistentClientRequestId', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns the same uuid across repeated get() calls', () => {
    const { result } = renderHook(() => usePersistentClientRequestId('payment:order-1'));
    const first = result.current.get();
    const second = result.current.get();
    const third = result.current.get();
    expect(first).toMatch(UUID_V4);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('persists the uuid in sessionStorage under the prefixed scope key', () => {
    const { result } = renderHook(() => usePersistentClientRequestId('payment:order-1'));
    const id = result.current.get();
    expect(window.sessionStorage.getItem(`${STORAGE_PREFIX}payment:order-1`)).toBe(id);
  });

  it('replays the same uuid across unmount → remount with the same scope (the bug fix)', () => {
    // This is the core invariant: in production, the modal unmounts on
    // close and remounts on reopen. With the old useStableClientRequestId
    // (useRef-based), the id was lost. With sessionStorage, it survives.
    const first = renderHook(() => usePersistentClientRequestId('payment:order-7'));
    const idA = first.result.current.get();
    first.unmount();

    const second = renderHook(() => usePersistentClientRequestId('payment:order-7'));
    const idB = second.result.current.get();

    expect(idB).toBe(idA);
  });

  it('mints a fresh uuid only after reset()', () => {
    const { result } = renderHook(() => usePersistentClientRequestId('payment:order-2'));
    const beforeReset = result.current.get();
    result.current.reset();
    const afterReset = result.current.get();
    expect(afterReset).toMatch(UUID_V4);
    expect(afterReset).not.toBe(beforeReset);
  });

  it('reset() clears the sessionStorage entry so a fresh remount gets a new uuid', () => {
    const first = renderHook(() => usePersistentClientRequestId('payment:order-3'));
    first.result.current.get();
    first.result.current.reset();
    first.unmount();

    const second = renderHook(() => usePersistentClientRequestId('payment:order-3'));
    const idAfter = second.result.current.get();
    expect(idAfter).toMatch(UUID_V4);
    // The post-reset id is fresh and stored under the same key.
    expect(window.sessionStorage.getItem(`${STORAGE_PREFIX}payment:order-3`)).toBe(idAfter);
  });

  it('isolates ids by scope so unrelated mutations cannot collide', () => {
    const payment = renderHook(() => usePersistentClientRequestId('payment:order-4'));
    const refund = renderHook(() => usePersistentClientRequestId('refund:order-4'));
    const discountApply = renderHook(() => usePersistentClientRequestId('discount:apply:order-4'));
    const discountRemove = renderHook(() =>
      usePersistentClientRequestId('discount:remove:order-4'),
    );

    const ids = new Set([
      payment.result.current.get(),
      refund.result.current.get(),
      discountApply.result.current.get(),
      discountRemove.result.current.get(),
    ]);

    // Four distinct mutations on the same order must produce four
    // distinct ids — a shared id would let an apply-then-remove
    // double-tap return the apply result and silently keep the discount.
    expect(ids.size).toBe(4);
  });

  it('isolates ids by orderId so different orders cannot collide', () => {
    const orderA = renderHook(() => usePersistentClientRequestId('payment:order-A'));
    const orderB = renderHook(() => usePersistentClientRequestId('payment:order-B'));
    expect(orderA.result.current.get()).not.toBe(orderB.result.current.get());
  });

  it('does not mint a uuid until get() is called', () => {
    renderHook(() => usePersistentClientRequestId('payment:lazy'));
    expect(window.sessionStorage.getItem(`${STORAGE_PREFIX}payment:lazy`)).toBeNull();
  });

  it('returns stable get/reset function references across re-renders for the same scope', () => {
    const { result, rerender } = renderHook(() => usePersistentClientRequestId('payment:order-5'));
    const initialGet = result.current.get;
    const initialReset = result.current.reset;
    rerender();
    expect(result.current.get).toBe(initialGet);
    expect(result.current.reset).toBe(initialReset);
  });

  it('rebinds when scopeKey changes (e.g. orderId becomes available)', () => {
    // Mirrors SplitPaymentModal where `payment:_pending` flips to
    // `payment:${order.id}` on the first render after the order loads.
    const { result, rerender } = renderHook(
      ({ scope }: { scope: string }) => usePersistentClientRequestId(scope),
      { initialProps: { scope: 'payment:_pending' } },
    );

    const pendingId = result.current.get();
    rerender({ scope: 'payment:order-6' });
    const realId = result.current.get();

    expect(realId).not.toBe(pendingId);
  });

  it('falls back gracefully when sessionStorage.setItem throws (private mode / quota)', () => {
    // Storage write failures must not throw inside a payment submit
    // path — the caller still gets a usable uuid for this attempt.
    const setItemSpy = vi
      .spyOn(window.sessionStorage.__proto__, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

    const { result } = renderHook(() => usePersistentClientRequestId('payment:order-8'));
    expect(() => result.current.get()).not.toThrow();
    const id = result.current.get();
    expect(id).toMatch(UUID_V4);

    setItemSpy.mockRestore();
  });

  it('falls back gracefully when sessionStorage.getItem throws', () => {
    const getItemSpy = vi
      .spyOn(window.sessionStorage.__proto__, 'getItem')
      .mockImplementation(() => {
        throw new Error('SecurityError');
      });

    const { result } = renderHook(() => usePersistentClientRequestId('payment:order-9'));
    expect(() => result.current.get()).not.toThrow();
    expect(result.current.get()).toMatch(UUID_V4);

    getItemSpy.mockRestore();
  });
});
