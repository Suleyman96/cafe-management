import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Plan 9 — leader-tab election. The election module is a singleton: each
 * test mutates global state (`navigator.locks`, `BroadcastChannel`) and then
 * imports the module via `await import(...)` so the constructor sees the
 * stubbed environment.
 */

describe('leader-election — Web Locks API path', () => {
  let originalLocks: unknown;
  let lockCallback: (() => Promise<unknown>) | null;

  beforeEach(() => {
    vi.resetModules();
    lockCallback = null;
    originalLocks = (navigator as unknown as { locks?: unknown }).locks;
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      writable: true,
      value: {
        request: vi.fn((_name: string, _opts: unknown, cb: () => Promise<unknown>) => {
          lockCallback = cb;
          // Mimic the browser: invoke the callback (granting the lock) on the
          // next microtask. Tests assert leader status after this resolves.
          return Promise.resolve(cb());
        }),
      },
    });
  });

  afterEach(async () => {
    const { __resetLeaderElectionForTests } = await import('@/lib/realtime/leader-election');
    __resetLeaderElectionForTests();
    if (originalLocks === undefined) {
      delete (navigator as unknown as { locks?: unknown }).locks;
    } else {
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        writable: true,
        value: originalLocks,
      });
    }
  });

  it('grants leadership to the first subscriber when the lock callback fires', async () => {
    const { subscribeIsLeader } = await import('@/lib/realtime/leader-election');
    const events: boolean[] = [];
    subscribeIsLeader((v) => events.push(v));
    // The mock invokes the lock callback synchronously inside `request`, so
    // `setLeader(true)` runs before the subscriber is even added. The
    // immediate-replay then fires once with the final state.
    expect(events).toEqual([true]);
    expect(lockCallback).toBeTruthy();
  });

  it('reuses the same election state across subscribers', async () => {
    const mod = await import('@/lib/realtime/leader-election');
    const eventsA: boolean[] = [];
    const eventsB: boolean[] = [];
    mod.subscribeIsLeader((v) => eventsA.push(v));
    // Second subscriber arriving after the lock was granted should see
    // `true` immediately — module-level state is shared.
    mod.subscribeIsLeader((v) => eventsB.push(v));
    expect(eventsA[eventsA.length - 1]).toBe(true);
    expect(eventsB[0]).toBe(true);
    // Web Locks request must only be called once even with two subscribers.
    const req = (navigator as unknown as { locks: { request: ReturnType<typeof vi.fn> } }).locks
      .request;
    expect(req).toHaveBeenCalledTimes(1);
  });
});

describe('leader-election — fallback when neither Web Locks nor BroadcastChannel exist', () => {
  let originalLocks: unknown;
  let originalBC: unknown;

  beforeEach(() => {
    vi.resetModules();
    originalLocks = (navigator as unknown as { locks?: unknown }).locks;
    originalBC = globalThis.BroadcastChannel;
    delete (navigator as unknown as { locks?: unknown }).locks;
    delete (globalThis as unknown as { BroadcastChannel?: unknown }).BroadcastChannel;
  });

  afterEach(async () => {
    const { __resetLeaderElectionForTests } = await import('@/lib/realtime/leader-election');
    __resetLeaderElectionForTests();
    if (originalLocks !== undefined) {
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        writable: true,
        value: originalLocks,
      });
    }
    if (originalBC !== undefined) {
      globalThis.BroadcastChannel = originalBC as typeof BroadcastChannel;
    }
  });

  it('self-elects synchronously when no transport exists (single-tab assumption)', async () => {
    const { subscribeIsLeader } = await import('@/lib/realtime/leader-election');
    const events: boolean[] = [];
    subscribeIsLeader((v) => events.push(v));
    // Initial cb(false) then setLeader(true) fire synchronously inside
    // ensureState/startElection — order is [false, true] but both arrive
    // before the next microtask. The subscriber sees the final state.
    expect(events[events.length - 1]).toBe(true);
  });
});
