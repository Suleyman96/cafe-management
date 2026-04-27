import { beforeEach, describe, expect, it } from 'vitest';
import { usePendingIntentStore } from '../pending-intent-store';

describe('usePendingIntentStore', () => {
  beforeEach(() => {
    usePendingIntentStore.setState({ pending: null });
  });

  it('set then consume returns the intent and clears it', () => {
    const intent = { type: 'notification' as const, data: { type: 'new_order', orderId: '123' } };
    usePendingIntentStore.getState().setPending(intent);
    expect(usePendingIntentStore.getState().pending).toEqual(intent);

    const consumed = usePendingIntentStore.getState().consumePending();
    expect(consumed).toEqual(intent);
    expect(usePendingIntentStore.getState().pending).toBeNull();
  });

  it('double consume returns null on the second call', () => {
    usePendingIntentStore.getState().setPending({ type: 'deep-link', url: 'gustri://orders/1' });
    expect(usePendingIntentStore.getState().consumePending()).not.toBeNull();
    expect(usePendingIntentStore.getState().consumePending()).toBeNull();
  });

  it('set overwrites the prior pending intent', () => {
    const first = { type: 'deep-link' as const, url: 'gustri://orders/1' };
    const second = { type: 'deep-link' as const, url: 'gustri://orders/2' };
    usePendingIntentStore.getState().setPending(first);
    usePendingIntentStore.getState().setPending(second);

    expect(usePendingIntentStore.getState().consumePending()).toEqual(second);
  });

  it('consume on empty store returns null without mutating state', () => {
    expect(usePendingIntentStore.getState().pending).toBeNull();
    expect(usePendingIntentStore.getState().consumePending()).toBeNull();
    expect(usePendingIntentStore.getState().pending).toBeNull();
  });
});
