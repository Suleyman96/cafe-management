/**
 * `getLocalDateString` — local-timezone YYYY-MM-DD.
 *
 * The whole point of this helper is to use the device-LOCAL date (via
 * `toLocaleDateString`) rather than `new Date().toISOString().split('T')[0]`,
 * which returns the UTC date and is off-by-one near midnight in non-UTC
 * timezones (e.g. 23:30 local on the 9th is the 10th in UTC). It also defaults
 * to `en-CA` because YYYY-MM-DD is the canonical *data* format used in DB
 * columns — not a display format.
 *
 * (Kept in its own file rather than utils.test.ts to avoid colliding with the
 * concurrent batch that adds `timeOfDayToMinutes` tests there.)
 */

import { describe, expect, it } from 'vitest';
import { getLocalDateString } from '../utils';

describe('getLocalDateString', () => {
  it('returns a YYYY-MM-DD string in the en-CA data format by default', () => {
    expect(getLocalDateString(new Date('2026-03-09T12:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('uses local date components (delegates to toLocaleDateString), not UTC', () => {
    const d = new Date('2026-03-09T12:00:00Z');
    expect(getLocalDateString(d)).toBe(d.toLocaleDateString('en-CA'));
  });

  it('honors a non-default locale', () => {
    const d = new Date('2026-03-09T12:00:00Z');
    // en-US is M/D/YYYY — proves the locale param is threaded, not hardcoded.
    expect(getLocalDateString(d, 'en-US')).toBe(d.toLocaleDateString('en-US'));
  });

  it('defaults the date argument to "now"', () => {
    // No throw + valid data-format string when called with no args.
    expect(getLocalDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
