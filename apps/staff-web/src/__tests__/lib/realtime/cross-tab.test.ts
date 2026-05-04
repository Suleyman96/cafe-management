import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('cross-tab — BroadcastChannel transport', () => {
  let originalBroadcastChannel: typeof BroadcastChannel | undefined;
  let postMessageMock: ReturnType<typeof vi.fn>;
  let addEventListenerMock: ReturnType<typeof vi.fn>;
  let removeEventListenerMock: ReturnType<typeof vi.fn>;
  let listeners: Array<(event: MessageEvent) => void>;

  beforeEach(async () => {
    vi.resetModules();
    listeners = [];
    postMessageMock = vi.fn();
    addEventListenerMock = vi.fn((_evt: string, handler: (event: MessageEvent) => void) => {
      listeners.push(handler);
    });
    removeEventListenerMock = vi.fn((_evt: string, handler: (event: MessageEvent) => void) => {
      const idx = listeners.indexOf(handler);
      if (idx >= 0) listeners.splice(idx, 1);
    });

    originalBroadcastChannel = globalThis.BroadcastChannel;
    class StubBroadcastChannel {
      postMessage = postMessageMock;
      addEventListener = addEventListenerMock;
      removeEventListener = removeEventListenerMock;
      close = vi.fn();
    }
    (globalThis as unknown as { BroadcastChannel: unknown }).BroadcastChannel =
      StubBroadcastChannel;
  });

  afterEach(() => {
    if (originalBroadcastChannel === undefined) {
      delete (globalThis as unknown as { BroadcastChannel?: unknown }).BroadcastChannel;
    } else {
      globalThis.BroadcastChannel = originalBroadcastChannel;
    }
    vi.restoreAllMocks();
  });

  it('postCrossTab stamps a tabId and forwards to BroadcastChannel', async () => {
    const { postCrossTab, getTabId } = await import('@/lib/realtime/cross-tab');

    postCrossTab({ kind: 'mutation-success' });
    expect(postMessageMock).toHaveBeenCalledTimes(1);
    expect(postMessageMock).toHaveBeenCalledWith({
      kind: 'mutation-success',
      tabId: getTabId(),
    });
  });

  it('onCrossTab ignores messages it sent itself (echo guard)', async () => {
    const { onCrossTab, getTabId } = await import('@/lib/realtime/cross-tab');

    const cb = vi.fn();
    onCrossTab(cb);

    // Emulate the channel echoing our own message back.
    listeners[0]({
      data: { kind: 'mutation-success', tabId: getTabId() },
    } as MessageEvent);

    expect(cb).not.toHaveBeenCalled();
  });

  it('onCrossTab delivers messages from a different tab', async () => {
    const { onCrossTab } = await import('@/lib/realtime/cross-tab');

    const cb = vi.fn();
    onCrossTab(cb);

    listeners[0]({
      data: { kind: 'mutation-success', tabId: 'sibling-tab' },
    } as MessageEvent);

    expect(cb).toHaveBeenCalledWith({ kind: 'mutation-success', tabId: 'sibling-tab' });
  });

  it('onCrossTab returns an unsubscribe that detaches the listener', async () => {
    const { onCrossTab } = await import('@/lib/realtime/cross-tab');

    const cb = vi.fn();
    const unsubscribe = onCrossTab(cb);
    expect(addEventListenerMock).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(removeEventListenerMock).toHaveBeenCalledTimes(1);
  });

  it('relays signed-out and tenant-changed messages with their payloads', async () => {
    const { onCrossTab, postCrossTab, getTabId } = await import('@/lib/realtime/cross-tab');
    const cb = vi.fn();
    onCrossTab(cb);

    postCrossTab({ kind: 'signed-out' });
    postCrossTab({ kind: 'tenant-changed', tenantId: 't-123' });

    expect(postMessageMock).toHaveBeenNthCalledWith(1, {
      kind: 'signed-out',
      tabId: getTabId(),
    });
    expect(postMessageMock).toHaveBeenNthCalledWith(2, {
      kind: 'tenant-changed',
      tabId: getTabId(),
      tenantId: 't-123',
    });
  });
});

describe('cross-tab — storage event fallback', () => {
  let originalBroadcastChannel: typeof BroadcastChannel | undefined;
  let originalLocalStorage: Storage;
  let setItemMock: ReturnType<typeof vi.fn>;
  let removeItemMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    originalBroadcastChannel = globalThis.BroadcastChannel;
    delete (globalThis as unknown as { BroadcastChannel?: unknown }).BroadcastChannel;

    originalLocalStorage = window.localStorage;
    setItemMock = vi.fn();
    removeItemMock = vi.fn();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: { setItem: setItemMock, removeItem: removeItemMock, getItem: vi.fn() },
    });
  });

  afterEach(() => {
    if (originalBroadcastChannel === undefined) {
      delete (globalThis as unknown as { BroadcastChannel?: unknown }).BroadcastChannel;
    } else {
      globalThis.BroadcastChannel = originalBroadcastChannel;
    }
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
    vi.restoreAllMocks();
  });

  it('postCrossTab writes a payload to localStorage and immediately removes it', async () => {
    const { postCrossTab } = await import('@/lib/realtime/cross-tab');

    postCrossTab({ kind: 'mutation-success' });

    expect(setItemMock).toHaveBeenCalledTimes(1);
    expect(removeItemMock).toHaveBeenCalledTimes(1);
    const [key, value] = setItemMock.mock.calls[0];
    expect(key).toBe('gustri-cache-v1:msg');
    const parsed = JSON.parse(value);
    expect(parsed.kind).toBe('mutation-success');
    expect(typeof parsed.tabId).toBe('string');
  });

  it('onCrossTab subscribes to the `storage` event and ignores own-tab messages', async () => {
    const { onCrossTab, getTabId } = await import('@/lib/realtime/cross-tab');
    const cb = vi.fn();
    onCrossTab(cb);

    // Same-tab echo — must be ignored.
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'gustri-cache-v1:msg',
        newValue: JSON.stringify({ kind: 'mutation-success', tabId: getTabId() }),
      }),
    );
    expect(cb).not.toHaveBeenCalled();

    // Sibling-tab message — must fire.
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'gustri-cache-v1:msg',
        newValue: JSON.stringify({ kind: 'mutation-success', tabId: 'sibling-tab' }),
      }),
    );
    expect(cb).toHaveBeenCalledWith({ kind: 'mutation-success', tabId: 'sibling-tab' });
  });

  it('onCrossTab ignores storage events for unrelated keys or null newValue', async () => {
    const { onCrossTab } = await import('@/lib/realtime/cross-tab');
    const cb = vi.fn();
    onCrossTab(cb);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'unrelated-key',
        newValue: JSON.stringify({ kind: 'mutation-success', tabId: 'sibling' }),
      }),
    );
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'gustri-cache-v1:msg',
        newValue: null,
      }),
    );

    expect(cb).not.toHaveBeenCalled();
  });
});
