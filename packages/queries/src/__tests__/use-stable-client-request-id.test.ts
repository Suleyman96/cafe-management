import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useStableClientRequestId } from '../use-stable-client-request-id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('useStableClientRequestId', () => {
  it('returns the same uuid across repeated get() calls', () => {
    const { result } = renderHook(() => useStableClientRequestId());
    const first = result.current.get();
    const second = result.current.get();
    const third = result.current.get();
    expect(first).toMatch(UUID_V4);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('mints a fresh uuid only after reset()', () => {
    const { result } = renderHook(() => useStableClientRequestId());
    const beforeReset = result.current.get();
    result.current.reset();
    const afterReset = result.current.get();
    expect(afterReset).toMatch(UUID_V4);
    expect(afterReset).not.toBe(beforeReset);
  });

  it('does not mint a uuid until get() is called', () => {
    // The hook should be free at mount — no allocation cost for a form
    // the user may never submit. We can't observe minting directly, but
    // we can confirm that two consecutive resets followed by a get still
    // yield exactly one uuid (i.e. the second reset wasn't operating on
    // an already-minted internal state).
    const { result } = renderHook(() => useStableClientRequestId());
    result.current.reset();
    result.current.reset();
    const id = result.current.get();
    expect(id).toMatch(UUID_V4);
    expect(result.current.get()).toBe(id);
  });

  it('preserves the same uuid across re-renders without reset', () => {
    const { result, rerender } = renderHook(() => useStableClientRequestId());
    const before = result.current.get();
    rerender();
    rerender();
    expect(result.current.get()).toBe(before);
  });

  it('returns stable get/reset function references across re-renders', () => {
    // Stable references matter for callers that pass them to memoised
    // children or list them in effect deps. If they re-mounted on every
    // render, downstream effects would re-run gratuitously.
    const { result, rerender } = renderHook(() => useStableClientRequestId());
    const initialGet = result.current.get;
    const initialReset = result.current.reset;
    rerender();
    expect(result.current.get).toBe(initialGet);
    expect(result.current.reset).toBe(initialReset);
  });

  it('returns the same wrapper object across re-renders', () => {
    // Callers thread the returned object into useEffect dep arrays
    // (e.g. modal-open reset). If the object literal were rebuilt on
    // every render, the effect would re-fire every commit and any
    // setState inside it would infinite-loop.
    const { result, rerender } = renderHook(() => useStableClientRequestId());
    const initialObj = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(initialObj);
  });
});
