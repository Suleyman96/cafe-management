import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetEventDedupForTests,
  markEvent,
  RECONNECT_REPLAY_WINDOW_MS,
  seenRecently,
} from '@/lib/event-dedup';

describe('event-dedup', () => {
  beforeEach(() => {
    __resetEventDedupForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-30T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for a mark within the default 500ms window', () => {
    markEvent('order:abc');
    vi.advanceTimersByTime(200);
    expect(seenRecently('order:abc')).toBe(true);
  });

  it('returns false past the dedup window', () => {
    markEvent('order:abc');
    vi.advanceTimersByTime(600);
    expect(seenRecently('order:abc')).toBe(false);
  });

  it('returns false for an unmarked id', () => {
    expect(seenRecently('order:never-marked')).toBe(false);
  });

  it('respects a custom window', () => {
    markEvent('order:xyz');
    vi.advanceTimersByTime(900);
    expect(seenRecently('order:xyz', 1000)).toBe(true);
    vi.advanceTimersByTime(200);
    expect(seenRecently('order:xyz', 1000)).toBe(false);
  });

  it('cleans up entries older than the 300 s retention floor on every check', () => {
    // Audit C2 — retention floor was bumped from 60 s to 300 s so reconnect-
    // replay survives a backgrounded device that misses several minutes of
    // realtime traffic.
    markEvent('order:old');
    vi.advanceTimersByTime(301_000);
    expect(seenRecently('order:old')).toBe(false);
    // Re-marking refreshes; ensure prior expiry didn't poison the new entry.
    markEvent('order:old');
    expect(seenRecently('order:old')).toBe(true);
  });

  it('cleans up old entries when marking new ones', () => {
    markEvent('order:1');
    vi.advanceTimersByTime(301_000);
    // 'order:1' is now past the 300 s retention floor. Marking 'order:2'
    // should evict 'order:1' regardless of any extended lookup window.
    markEvent('order:2');
    expect(seenRecently('order:1', 600_000)).toBe(false);
    expect(seenRecently('order:2')).toBe(true);
  });

  it('survives reconnect-replay beyond 60 s (audit C2 fix)', () => {
    // Phone backgrounded for 4 minutes between tables, WS reconnects and
    // replays the original INSERT. The 60 s window in place before audit C2
    // would have missed this and rung the kitchen twice.
    markEvent('order:replay');
    vi.advanceTimersByTime(240_000); // 4 minutes
    expect(seenRecently('order:replay', RECONNECT_REPLAY_WINDOW_MS)).toBe(true);
  });

  it('drops entries past the 300 s reconnect-replay window', () => {
    markEvent('order:long-gone');
    vi.advanceTimersByTime(RECONNECT_REPLAY_WINDOW_MS + 1_000);
    // Beyond the window — both the lookup and any longer caller window
    // should miss the entry because it's been pruned by retention.
    expect(seenRecently('order:long-gone', RECONNECT_REPLAY_WINDOW_MS)).toBe(false);
    expect(seenRecently('order:long-gone', 600_000)).toBe(false);
  });

  it('caps the map at 1000 entries by dropping the oldest first', () => {
    // Marking 1100 distinct ids with no time advance — age-based prune
    // can't trim them, so the soft cap takes over. Result: the 100 oldest
    // are evicted and the 1000 most recent survive.
    for (let i = 0; i < 1100; i += 1) {
      markEvent(`order:${i}`);
    }
    // Oldest 100 should be gone. Use a generous lookup window so failure
    // mode is "still in map" not "outside lookup window".
    expect(seenRecently('order:0', 600_000)).toBe(false);
    expect(seenRecently('order:99', 600_000)).toBe(false);
    // The most-recent entries survive.
    expect(seenRecently('order:100', 600_000)).toBe(true);
    expect(seenRecently('order:1099', 600_000)).toBe(true);
  });

  it('refreshing an existing id moves it past the soft-cap eviction line', () => {
    // Without the delete-then-set in markEvent, a refreshed id would keep
    // its original iteration position and be evicted by the soft cap as if
    // it were stale. This test pins that behavior.
    markEvent('order:refresh-me');
    for (let i = 0; i < 999; i += 1) {
      markEvent(`order:filler-${i}`);
    }
    // Refresh moves 'order:refresh-me' to the end of iteration order.
    markEvent('order:refresh-me');
    // Push the map past the cap; the oldest filler should be evicted, not
    // the refreshed entry.
    for (let i = 0; i < 100; i += 1) {
      markEvent(`order:overflow-${i}`);
    }
    expect(seenRecently('order:refresh-me', 600_000)).toBe(true);
    expect(seenRecently('order:filler-0', 600_000)).toBe(false);
  });
});
