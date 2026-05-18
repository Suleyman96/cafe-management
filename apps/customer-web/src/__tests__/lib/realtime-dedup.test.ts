import {
  _resetRecentClientRequestIdsForTests,
  isRecentClientRequestId,
  recordRecentClientRequestId,
} from '@/lib/realtime-dedup';

beforeEach(() => {
  _resetRecentClientRequestIdsForTests();
});

describe('realtime-dedup (M5)', () => {
  it('records and recognises a client_request_id per order', () => {
    recordRecentClientRequestId('order-1', 'crid-A');
    expect(isRecentClientRequestId('order-1', 'crid-A')).toBe(true);
    // Different order id → not in that bucket.
    expect(isRecentClientRequestId('order-2', 'crid-A')).toBe(false);
  });

  it("global bucket bridges create-then-echo for the customer's new order", () => {
    // The order-create mutation records before the orderId is known
    // server-side (it returns after the insert). Recording against
    // `null` lands in the global bucket; the INSERT echo arrives later
    // with the order id, but lookup also peeks at the global list.
    recordRecentClientRequestId(null, 'crid-create');
    expect(isRecentClientRequestId('order-99', 'crid-create')).toBe(true);
  });

  it('evicts oldest entries beyond the 16-item cap (FIFO)', () => {
    for (let i = 0; i < 20; i++) {
      recordRecentClientRequestId('order-1', `crid-${i}`);
    }
    // 0..3 evicted, 4..19 remain.
    expect(isRecentClientRequestId('order-1', 'crid-3')).toBe(false);
    expect(isRecentClientRequestId('order-1', 'crid-4')).toBe(true);
    expect(isRecentClientRequestId('order-1', 'crid-19')).toBe(true);
  });

  it('move-to-front on duplicate record so the most-recent slot wins', () => {
    // Reinserting an id resets its FIFO position — a replay path
    // shouldn't accidentally cause its dedup entry to age out.
    for (let i = 0; i < 15; i++) {
      recordRecentClientRequestId('order-1', `crid-${i}`);
    }
    recordRecentClientRequestId('order-1', 'crid-0'); // re-record
    // Now push 5 more — crid-0 should NOT be evicted because the
    // re-record bumped it to the most-recent slot.
    for (let i = 15; i < 20; i++) {
      recordRecentClientRequestId('order-1', `crid-${i}`);
    }
    expect(isRecentClientRequestId('order-1', 'crid-0')).toBe(true);
  });

  it('null/empty client_request_id never matches', () => {
    recordRecentClientRequestId('order-1', 'crid-A');
    expect(isRecentClientRequestId('order-1', null)).toBe(false);
    expect(isRecentClientRequestId('order-1', undefined)).toBe(false);
    expect(isRecentClientRequestId('order-1', '')).toBe(false);
  });
});

// RT3 — Cross-tab dedup via BroadcastChannel. Module-level wiring posts
// every `record*` call to siblings of the same origin so a second tab's
// realtime echo also matches and skips the redundant invalidate.
describe('realtime-dedup (RT3) — cross-tab BroadcastChannel sync', () => {
  it('posts a record message on the realtime-dedup channel', () => {
    // Open a peer channel BEFORE the record fires; the source channel
    // (inside the module) won't echo to itself, so the test only sees
    // messages posted by the production code.
    const peer = new BroadcastChannel('realtime-dedup');
    const received: unknown[] = [];
    peer.onmessage = (e) => received.push(e.data);

    recordRecentClientRequestId('order-1', 'crid-rt3');

    // BroadcastChannel delivery is async (microtask in jsdom). Flush
    // via a queued microtask so the message lands before assertion.
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(received).toContainEqual({
          type: 'record',
          orderId: 'order-1',
          clientRequestId: 'crid-rt3',
        });
        peer.close();
        resolve();
      }, 0);
    });
  });

  it('a record message from a peer tab is mirrored into the local registry', async () => {
    // The module subscribed to the channel at import time. Posting a
    // valid `record` message from a peer must hydrate the local
    // bucket so `isRecentClientRequestId` returns true in this tab.
    const peer = new BroadcastChannel('realtime-dedup');
    peer.postMessage({ type: 'record', orderId: 'order-2', clientRequestId: 'crid-peer' });

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(isRecentClientRequestId('order-2', 'crid-peer')).toBe(true);
    peer.close();
  });

  it('ignores malformed peer messages (defends against unrelated channel-name collisions)', async () => {
    const peer = new BroadcastChannel('realtime-dedup');
    peer.postMessage({ type: 'something-else', foo: 'bar' });
    peer.postMessage({ type: 'record' }); // missing fields
    peer.postMessage({ type: 'record', orderId: 123, clientRequestId: 'crid-bad' });
    peer.postMessage({ type: 'record', orderId: 'order-3', clientRequestId: '' });

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(isRecentClientRequestId('order-3', 'crid-bad')).toBe(false);
    expect(isRecentClientRequestId('order-3', '')).toBe(false);
    peer.close();
  });
});
