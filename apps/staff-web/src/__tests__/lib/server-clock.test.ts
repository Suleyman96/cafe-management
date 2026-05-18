import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetServerClockForTests,
  getClockSnapshot,
  getServerNow,
  setSyncedAnchor,
  subscribeClockSync,
} from '@/lib/server-clock';

describe('server-clock', () => {
  beforeEach(() => {
    __resetServerClockForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetServerClockForTests();
  });

  it('returns the device clock until a sync lands', () => {
    expect(getServerNow()).toBe(Date.now());
    expect(getClockSnapshot()).toEqual({ offsetMs: 0, lastSyncedAt: 0 });
  });

  it('uses midpoint of round-trip as the client anchor', () => {
    // Server says 12:01:00.000. We "started" the fetch at 12:00:59.500 and
    // got the response at 12:01:00.500 — midpoint is 12:01:00.000, which
    // matches the server timestamp exactly: offset should be 0.
    const start = Date.parse('2026-01-01T12:00:59.500Z');
    const end = Date.parse('2026-01-01T12:01:00.500Z');
    setSyncedAnchor('2026-01-01T12:01:00.000Z', start, end);
    expect(getClockSnapshot().offsetMs).toBe(0);
  });

  it('captures positive offset when server is ahead of device', () => {
    // Device "now" sample is at 12:00:00.000 (start=end so midpoint=start).
    // Server says 12:05:00.000 → device is 5 minutes behind.
    const sampleAt = Date.parse('2026-01-01T12:00:00.000Z');
    setSyncedAnchor('2026-01-01T12:05:00.000Z', sampleAt, sampleAt);
    expect(getClockSnapshot().offsetMs).toBe(5 * 60 * 1000);
  });

  it('captures negative offset when device is ahead of server', () => {
    const sampleAt = Date.parse('2026-01-01T12:00:00.000Z');
    setSyncedAnchor('2026-01-01T11:55:00.000Z', sampleAt, sampleAt);
    expect(getClockSnapshot().offsetMs).toBe(-5 * 60 * 1000);
  });

  it('getServerNow applies offset to current device time', () => {
    const sampleAt = Date.parse('2026-01-01T12:00:00.000Z');
    setSyncedAnchor('2026-01-01T12:03:00.000Z', sampleAt, sampleAt);
    // 3-minute offset captured. Five seconds of device time pass:
    vi.advanceTimersByTime(5_000);
    // getServerNow should be sample + offset + 5s = 12:03:05.000.
    expect(getServerNow()).toBe(Date.parse('2026-01-01T12:03:05.000Z'));
  });

  it('ignores invalid ISO timestamps without resetting state', () => {
    const sampleAt = Date.parse('2026-01-01T12:00:00.000Z');
    setSyncedAnchor('2026-01-01T12:01:00.000Z', sampleAt, sampleAt);
    const beforeBadSync = getClockSnapshot();
    setSyncedAnchor('not-a-date', sampleAt, sampleAt);
    expect(getClockSnapshot()).toEqual(beforeBadSync);
  });

  it('notifies subscribers when a sync lands', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeClockSync(listener);
    setSyncedAnchor('2026-01-01T12:00:00.000Z', Date.now(), Date.now());
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setSyncedAnchor('2026-01-01T12:01:00.000Z', Date.now(), Date.now());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('exposes a stable snapshot reference until next sync (useSyncExternalStore safe)', () => {
    setSyncedAnchor('2026-01-01T12:00:00.000Z', Date.now(), Date.now());
    const a = getClockSnapshot();
    const b = getClockSnapshot();
    // Same object identity — otherwise useSyncExternalStore would loop.
    expect(a).toBe(b);
  });
});
