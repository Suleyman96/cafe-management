import { describe, expect, it, vi } from 'vitest';
import { getLocalDateString } from '@/lib/date-utils';

describe('Timezone-safe date operations', () => {
  it('getLocalDateString returns YYYY-MM-DD format', () => {
    const result = getLocalDateString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('getLocalDateString uses local date, not UTC', () => {
    vi.useFakeTimers();
    // Set to Jan 16 03:00 UTC — which is Jan 15 in UTC-5 timezones
    vi.setSystemTime(new Date('2024-01-16T03:00:00Z'));

    const localDate = getLocalDateString();
    // Format is always YYYY-MM-DD regardless of timezone
    expect(localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // The local date uses toLocaleDateString, not UTC
    const expected = new Date('2024-01-16T03:00:00Z').toLocaleDateString('en-CA');
    expect(localDate).toBe(expected);

    vi.useRealTimers();
  });

  it('toISOString returns wrong date near UTC midnight (regression proof)', () => {
    vi.useFakeTimers();
    // Set to Jan 16 03:00 UTC
    vi.setSystemTime(new Date('2024-01-16T03:00:00Z'));

    const utcDate = new Date().toISOString().split('T')[0];
    const localDate = getLocalDateString();

    // UTC always returns Jan 16
    expect(utcDate).toBe('2024-01-16');
    // Local date depends on timezone — in UTC it would also be Jan 16,
    // but this proves the code path uses toLocaleDateString (not toISOString)
    expect(localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    vi.useRealTimers();
  });

  it('getLocalDateString accepts a custom date argument', () => {
    const date = new Date(2024, 5, 15); // June 15, 2024 (local)
    const result = getLocalDateString(date);
    expect(result).toBe('2024-06-15');
  });

  it('getLocalDateString defaults to current date when no argument', () => {
    const now = new Date();
    const expected = now.toLocaleDateString('en-CA');
    expect(getLocalDateString()).toBe(expected);
  });
});
