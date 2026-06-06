import { describe, expect, it } from 'vitest';
import { getDurationHours, getWeekDates } from '../utils';

describe('getWeekDates (shared by web + mobile schedules)', () => {
  it('returns 7 dates starting Monday for a mid-week reference', () => {
    // 2026-06-03 is a Wednesday.
    const week = getWeekDates(new Date(2026, 5, 3));
    expect(week).toHaveLength(7);
    expect(week[0].getDay()).toBe(1); // Monday
    expect(week[6].getDay()).toBe(0); // Sunday
    expect(week[0].getDate()).toBe(1); // Mon 2026-06-01
    expect(week[6].getDate()).toBe(7); // Sun 2026-06-07
  });

  it('treats Sunday as the last day of the prior Monday-week', () => {
    // 2026-06-07 is a Sunday — its week should still start Mon 2026-06-01.
    const week = getWeekDates(new Date(2026, 5, 7));
    expect(week[0].getDate()).toBe(1);
    expect(week[6].getDate()).toBe(7);
  });
});

describe('getDurationHours', () => {
  it('returns whole hours to one decimal', () => {
    expect(getDurationHours('2026-06-01T09:00:00Z', '2026-06-01T17:30:00Z')).toBe(8.5);
  });

  it('returns null when either endpoint is missing', () => {
    expect(getDurationHours(null, '2026-06-01T17:00:00Z')).toBeNull();
    expect(getDurationHours('2026-06-01T09:00:00Z', null)).toBeNull();
    expect(getDurationHours(undefined, undefined)).toBeNull();
  });
});
