import { describe, expect, it } from 'vitest';
import type { PricingSettings } from '../utils';
import {
  calculateTax,
  calculateTaxWithSettings,
  calculateTotal,
  calculateTotalWithSettings,
  formatDateTime,
  formatPriceWithSettings,
  formatTime,
  getDisplaySubtotal,
  timeOfDayToMinutes,
} from '../utils';

// ─── Simple Tax Helpers ─────────────────────────────────────────

describe('calculateTax', () => {
  it('calculates with default 18% rate', () => {
    expect(calculateTax(100)).toBe(18);
  });

  it('calculates with custom rate', () => {
    expect(calculateTax(100, 0.1)).toBe(10);
  });

  it('returns 0 for zero subtotal', () => {
    expect(calculateTax(0)).toBe(0);
  });

  it('handles zero tax rate', () => {
    expect(calculateTax(100, 0)).toBe(0);
  });

  it('handles negative subtotal', () => {
    expect(calculateTax(-50)).toBe(-9);
  });

  it('returns NaN for NaN subtotal', () => {
    expect(calculateTax(NaN)).toBeNaN();
  });
});

describe('calculateTotal', () => {
  it('calculates total with default 18% tax', () => {
    expect(calculateTotal(100)).toBe(118);
  });

  it('calculates total with custom tax rate', () => {
    expect(calculateTotal(100, 0.1)).toBe(110);
  });
});

// ─── Settings-Aware Pricing Utilities ───────────────────────────

const defaultSettings: PricingSettings = {
  currency_symbol: '₼',
  currency_position: 'after',
  currency_decimal_places: 2,
  tax_enabled: true,
  tax_percentage: 18,
  prices_include_tax: false,
};

describe('formatPriceWithSettings', () => {
  it('formats with currency after amount', () => {
    expect(formatPriceWithSettings(10, defaultSettings)).toBe('10.00₼');
  });

  it('formats with currency before amount', () => {
    const settings = {
      ...defaultSettings,
      currency_position: 'before' as const,
      currency_symbol: '$',
    };
    expect(formatPriceWithSettings(10, settings)).toBe('$10.00');
  });

  it('respects decimal places', () => {
    const settings = { ...defaultSettings, currency_decimal_places: 0 };
    expect(formatPriceWithSettings(10.99, settings)).toBe('11₼');
  });

  it('formats zero', () => {
    expect(formatPriceWithSettings(0, defaultSettings)).toBe('0.00₼');
  });

  it('rounds correctly', () => {
    expect(formatPriceWithSettings(10.999, defaultSettings)).toBe('11.00₼');
  });

  it('formats negative amount (refunds)', () => {
    expect(formatPriceWithSettings(-5.5, defaultSettings)).toBe('-5.50₼');
  });

  it('handles NaN amount', () => {
    expect(formatPriceWithSettings(NaN, defaultSettings)).toBe('NaN₼');
  });

  it('handles empty currency symbol', () => {
    const settings = { ...defaultSettings, currency_symbol: '' };
    expect(formatPriceWithSettings(10, settings)).toBe('10.00');
  });

  it('handles 4 decimal places', () => {
    const settings = { ...defaultSettings, currency_decimal_places: 4 };
    expect(formatPriceWithSettings(10.12345, settings)).toBe('10.1235₼');
  });

  it('respects locale for thousands/decimal separators when locale provided', () => {
    expect(formatPriceWithSettings(1234.5, defaultSettings, 'en-US')).toBe('1,234.50₼');
    expect(formatPriceWithSettings(1234.5, defaultSettings, 'de-DE')).toBe('1.234,50₼');
  });

  it('keeps non-locale digit grouping when locale undefined', () => {
    expect(formatPriceWithSettings(1234.5, defaultSettings)).toBe('1234.50₼');
  });

  it('does not use Intl on non-finite amounts even with locale', () => {
    expect(formatPriceWithSettings(NaN, defaultSettings, 'en-US')).toBe('NaN₼');
  });
});

describe('calculateTaxWithSettings', () => {
  it('returns 0 when tax is disabled', () => {
    const settings = { ...defaultSettings, tax_enabled: false };
    expect(calculateTaxWithSettings(100, settings)).toBe(0);
  });

  it('calculates tax on subtotal when prices exclude tax', () => {
    expect(calculateTaxWithSettings(100, defaultSettings)).toBe(18);
  });

  it('extracts tax from subtotal when prices include tax', () => {
    const settings = { ...defaultSettings, prices_include_tax: true };
    const tax = calculateTaxWithSettings(118, settings);
    expect(tax).toBeCloseTo(18, 2);
  });

  it('returns 0 for zero subtotal', () => {
    expect(calculateTaxWithSettings(0, defaultSettings)).toBe(0);
  });

  it('handles 0% tax rate with tax enabled (exclusive)', () => {
    const settings = { ...defaultSettings, tax_percentage: 0 };
    expect(calculateTaxWithSettings(100, settings)).toBe(0);
  });

  it('handles 0% tax rate with prices_include_tax (no divide-by-zero)', () => {
    const settings = { ...defaultSettings, tax_percentage: 0, prices_include_tax: true };
    expect(calculateTaxWithSettings(100, settings)).toBe(0);
  });

  it('handles 100% tax rate (exclusive)', () => {
    const settings = { ...defaultSettings, tax_percentage: 100 };
    expect(calculateTaxWithSettings(100, settings)).toBe(100);
  });

  it('handles 100% tax rate (inclusive)', () => {
    const settings = { ...defaultSettings, tax_percentage: 100, prices_include_tax: true };
    expect(calculateTaxWithSettings(200, settings)).toBeCloseTo(100, 2);
  });

  it('handles negative subtotal with inclusive pricing', () => {
    const settings = { ...defaultSettings, prices_include_tax: true };
    const tax = calculateTaxWithSettings(-118, settings);
    expect(tax).toBeCloseTo(-18, 2);
  });

  // Guard against a corrupt tax_percentage poisoning every order total.
  // The DB CHECK (migration 20260604000001) is the primary defense; these
  // assert the in-process backstop in case a bad value ever reaches the code.
  it('treats a negative tax_percentage as 0 (exclusive)', () => {
    const settings = { ...defaultSettings, tax_percentage: -5 };
    expect(calculateTaxWithSettings(100, settings)).toBe(0);
  });

  it('never divides by zero/Infinity for tax_percentage <= -100 (inclusive)', () => {
    const settings = { ...defaultSettings, tax_percentage: -100, prices_include_tax: true };
    const tax = calculateTaxWithSettings(100, settings);
    expect(Number.isFinite(tax)).toBe(true);
    expect(tax).toBe(0);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])('returns a finite 0 for non-finite tax_percentage %p (inclusive)', (pct) => {
    const settings = { ...defaultSettings, tax_percentage: pct, prices_include_tax: true };
    const tax = calculateTaxWithSettings(100, settings);
    expect(Number.isFinite(tax)).toBe(true);
    expect(tax).toBe(0);
  });
});

describe('calculateTotalWithSettings', () => {
  it('adds tax when prices exclude tax', () => {
    expect(calculateTotalWithSettings(100, defaultSettings)).toBe(118);
  });

  it('returns subtotal when prices include tax', () => {
    const settings = { ...defaultSettings, prices_include_tax: true };
    expect(calculateTotalWithSettings(118, settings)).toBe(118);
  });

  it('returns subtotal when tax is disabled', () => {
    const settings = { ...defaultSettings, tax_enabled: false };
    expect(calculateTotalWithSettings(100, settings)).toBe(100);
  });
});

describe('getDisplaySubtotal', () => {
  it('returns subtotal as-is when prices exclude tax', () => {
    expect(getDisplaySubtotal(100, defaultSettings)).toBe(100);
  });

  it('removes tax from subtotal when prices include tax', () => {
    const settings = { ...defaultSettings, prices_include_tax: true };
    expect(getDisplaySubtotal(118, settings)).toBeCloseTo(100, 2);
  });

  it('handles 0% tax with prices_include_tax (no divide-by-zero)', () => {
    const settings = { ...defaultSettings, tax_percentage: 0, prices_include_tax: true };
    expect(getDisplaySubtotal(100, settings)).toBe(100);
  });

  it('handles negative subtotal with inclusive pricing', () => {
    const settings = { ...defaultSettings, prices_include_tax: true };
    expect(getDisplaySubtotal(-118, settings)).toBeCloseTo(-100, 2);
  });

  it('returns a finite value for a corrupt tax_percentage (inclusive)', () => {
    const settings = { ...defaultSettings, tax_percentage: -100, prices_include_tax: true };
    const result = getDisplaySubtotal(100, settings);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(100);
  });
});

// ─── formatTime ─────────────────────────────────────────────────
// Assertions are timezone-robust: they check the 12h-vs-24h convention the
// locale drives (en-US uses AM/PM, de uses 24h) rather than the exact wall
// time, which depends on the runner's timezone.
describe('formatTime', () => {
  const instant = new Date('2026-01-01T14:30:00Z');

  it('defaults to en-US (12-hour, AM/PM) for back-compat when no locale is given', () => {
    expect(formatTime(instant)).toMatch(/AM|PM/);
  });

  it('respects the passed locale — a 24-hour locale drops the AM/PM meridiem', () => {
    expect(formatTime(instant, 'en-US')).toMatch(/AM|PM/);
    expect(formatTime(instant, 'de-DE')).not.toMatch(/AM|PM/);
  });

  it('accepts an ISO string and a Date interchangeably', () => {
    expect(formatTime('2026-01-01T14:30:00Z', 'de-DE')).toBe(formatTime(instant, 'de-DE'));
  });
});

// ─── formatDateTime ─────────────────────────────────────────────
describe('formatDateTime', () => {
  // Use local-time constructors so "same day" is evaluated in the runner's tz,
  // matching how the function compares calendar days.
  const at = (y: number, mo: number, d: number, h = 12, mi = 0) => new Date(y, mo, d, h, mi);

  it('shows time only when the timestamp is the same local day as `now`', () => {
    const now = at(2026, 5, 14, 12, 0);
    const sameDay = at(2026, 5, 14, 9, 30);
    // Identical to the time-only formatTime output — no date component.
    expect(formatDateTime(sameDay, 'en-US', now)).toBe(formatTime(sameDay, 'en-US'));
  });

  it('adds the (numeric) date when the timestamp is a different day (yesterday)', () => {
    const now = at(2026, 5, 14, 1, 0);
    const yesterday = at(2026, 5, 13, 3, 42);
    const out = formatDateTime(yesterday, 'en-US', now);
    // Numeric date present (month/day = 06/13 in en-US), not just the clock,
    // and never an abbreviated month name like "M05"/"Jun".
    expect(out).not.toBe(formatTime(yesterday, 'en-US'));
    expect(out).toMatch(/06\/13|13\/06/); // numeric date, never "Jun"/"M05"
  });

  it('adds the date for a future-but-different day too', () => {
    const now = at(2026, 5, 14, 23, 0);
    const tomorrow = at(2026, 5, 15, 0, 5);
    expect(formatDateTime(tomorrow, 'en-US', now)).not.toBe(formatTime(tomorrow, 'en-US'));
  });
});

describe('timeOfDayToMinutes', () => {
  it('parses HH:MM to minutes since midnight', () => {
    expect(timeOfDayToMinutes('00:00')).toBe(0);
    expect(timeOfDayToMinutes('14:30')).toBe(870);
    expect(timeOfDayToMinutes('23:59')).toBe(1439);
  });

  it('ignores a trailing seconds component (HH:MM:SS)', () => {
    expect(timeOfDayToMinutes('09:15:45')).toBe(555);
  });

  it('yields NaN for a malformed value (never matches a shift window)', () => {
    expect(timeOfDayToMinutes('not-a-time')).toBeNaN();
  });
});
