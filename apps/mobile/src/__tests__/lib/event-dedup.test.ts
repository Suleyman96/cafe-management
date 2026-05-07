import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetEventDedupForTests, markEvent, seenRecently } from '@/lib/event-dedup';

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

  it('cleans up entries older than the 60s floor on every check', () => {
    // Audit #5 / #7 — retention floor was bumped from 5 s to 60 s so reconnect-
    // replay (>5 s after original) and OS-re-delivery dedup windows survive.
    markEvent('order:old');
    vi.advanceTimersByTime(61_000);
    expect(seenRecently('order:old')).toBe(false);
    // Re-marking refreshes; ensure prior expiry didn't poison the new entry.
    markEvent('order:old');
    expect(seenRecently('order:old')).toBe(true);
  });

  it('cleans up old entries when marking new ones', () => {
    markEvent('order:1');
    vi.advanceTimersByTime(61_000);
    // 'order:1' is now past the 60 s retention floor. Marking 'order:2'
    // should evict 'order:1' regardless of any extended lookup window.
    markEvent('order:2');
    expect(seenRecently('order:1', 120_000)).toBe(false);
    expect(seenRecently('order:2')).toBe(true);
  });

  it('retains entries within the 60 s floor for reconnect-replay dedup (audit #5)', () => {
    markEvent('order:replay');
    vi.advanceTimersByTime(30_000);
    // 30 s post-mark — well past the default 500 ms race window but inside
    // the 60 s reconnect-replay window. Lookup with the longer window finds it.
    expect(seenRecently('order:replay')).toBe(false); // default 500 ms — not "recent"
    expect(seenRecently('order:replay', 60_000)).toBe(true); // 60 s — "recent"
  });
});
