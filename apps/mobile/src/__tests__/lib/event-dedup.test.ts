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

  it('cleans up entries older than 5s on every check', () => {
    markEvent('order:old');
    vi.advanceTimersByTime(6_000);
    // Sanity: no longer recent
    expect(seenRecently('order:old')).toBe(false);
    // Re-marking refreshes; ensure prior expiry didn't poison the new entry.
    markEvent('order:old');
    expect(seenRecently('order:old')).toBe(true);
  });

  it('cleans up old entries when marking new ones', () => {
    markEvent('order:1');
    vi.advanceTimersByTime(6_000);
    // 'order:1' is now expired. Marking 'order:2' should evict 'order:1'.
    markEvent('order:2');
    expect(seenRecently('order:1', 10_000)).toBe(false);
    expect(seenRecently('order:2')).toBe(true);
  });
});
