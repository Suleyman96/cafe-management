import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __resetClientOutdatedStateForTests,
  getClientMustReload,
  setClientMustReload,
  subscribeClientMustReload,
} from '@/lib/client-outdated-state';

/**
 * Plan 11 — module-level "must reload" state. Backs the version-skew hard
 * block; the connection provider drives the setter, the overlay component
 * subscribes to it.
 */
describe('client-outdated-state', () => {
  afterEach(() => {
    __resetClientOutdatedStateForTests();
  });

  it('starts disabled', () => {
    expect(getClientMustReload()).toBe(false);
  });

  it('notifies the subscriber immediately with the current value', () => {
    const cb = vi.fn();
    subscribeClientMustReload(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenLastCalledWith(false);
  });

  it('notifies subscribers on transition', () => {
    const cb = vi.fn();
    subscribeClientMustReload(cb);
    cb.mockClear();

    setClientMustReload(true);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenLastCalledWith(true);
  });

  it('skips no-op transitions', () => {
    const cb = vi.fn();
    subscribeClientMustReload(cb);
    cb.mockClear();

    setClientMustReload(false);
    expect(cb).not.toHaveBeenCalled();

    setClientMustReload(true);
    setClientMustReload(true);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops further notifications', () => {
    const cb = vi.fn();
    const unsubscribe = subscribeClientMustReload(cb);
    cb.mockClear();

    unsubscribe();
    setClientMustReload(true);
    expect(cb).not.toHaveBeenCalled();
    expect(getClientMustReload()).toBe(true);
  });
});
