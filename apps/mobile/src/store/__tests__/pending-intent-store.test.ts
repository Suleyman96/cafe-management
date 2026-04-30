import { beforeEach, describe, expect, it } from 'vitest';
import { usePendingIntentStore } from '../pending-intent-store';

describe('usePendingIntentStore queue', () => {
  beforeEach(() => {
    usePendingIntentStore.setState({ pending: [] });
  });

  it('addPending then consumeAll returns the intent in arrival order and clears the queue', () => {
    const a = { type: 'notification' as const, data: { type: 'new_order', orderId: '1' } };
    const b = { type: 'notification' as const, data: { type: 'waiter_call', tableId: 'T1' } };
    const c = { type: 'deep-link' as const, url: 'gustri://orders/2' };

    usePendingIntentStore.getState().addPending(a);
    usePendingIntentStore.getState().addPending(b);
    usePendingIntentStore.getState().addPending(c);

    const consumed = usePendingIntentStore.getState().consumeAll();
    expect(consumed).toEqual([a, b, c]);
    expect(usePendingIntentStore.getState().pending).toEqual([]);
  });

  it('consumeAll on an empty queue returns []', () => {
    expect(usePendingIntentStore.getState().consumeAll()).toEqual([]);
  });

  it('drops the oldest entry past the 10-item cap', () => {
    const store = usePendingIntentStore.getState();
    for (let i = 0; i < 11; i++) {
      store.addPending({ type: 'deep-link', url: `gustri://orders/${i}` });
    }
    const consumed = usePendingIntentStore.getState().consumeAll();
    expect(consumed).toHaveLength(10);
    // Oldest (index 0) was evicted; what remains starts at index 1.
    expect((consumed[0] as { url: string }).url).toBe('gustri://orders/1');
    expect((consumed[9] as { url: string }).url).toBe('gustri://orders/10');
  });

  it('back-compat: setPending appends; consumePending returns the head FIFO', () => {
    const a = { type: 'deep-link' as const, url: 'gustri://orders/1' };
    const b = { type: 'deep-link' as const, url: 'gustri://orders/2' };
    usePendingIntentStore.getState().setPending(a);
    usePendingIntentStore.getState().setPending(b);

    expect(usePendingIntentStore.getState().consumePending()).toEqual(a);
    expect(usePendingIntentStore.getState().consumePending()).toEqual(b);
    expect(usePendingIntentStore.getState().consumePending()).toBeNull();
  });
});
