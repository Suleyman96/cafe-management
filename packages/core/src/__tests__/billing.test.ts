import { describe, expect, it } from 'vitest';
import {
  addMonthsUTC,
  BILLING_EXPIRING_SOON_DAYS,
  BILLING_REMINDER_DAYS,
  billingNeedsAttention,
  computePeriodEnd,
  deriveBillingStatus,
} from '../billing';

describe('addMonthsUTC', () => {
  it('adds whole months in UTC', () => {
    expect(addMonthsUTC(new Date('2026-01-15T00:00:00Z'), 1).toISOString()).toBe(
      '2026-02-15T00:00:00.000Z',
    );
    expect(addMonthsUTC(new Date('2026-01-15T00:00:00Z'), 12).toISOString()).toBe(
      '2027-01-15T00:00:00.000Z',
    );
  });

  it('clamps the day so an end-of-month start never skips a month', () => {
    // Jan 31 + 1 month must land on Feb 28 (2026 is not a leap year), NOT Mar 3.
    expect(addMonthsUTC(new Date('2026-01-31T00:00:00Z'), 1).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
    // Leap-year February keeps the 29th.
    expect(addMonthsUTC(new Date('2024-01-31T00:00:00Z'), 1).toISOString()).toBe(
      '2024-02-29T00:00:00.000Z',
    );
  });

  it('clamps Feb 29 on a +12-month roll from a leap to a non-leap year', () => {
    // A yearly renewal booked on a leap day (Feb 29 2024) must land on Feb 28
    // 2025 (2025 has no 29th), not spill over into March.
    expect(addMonthsUTC(new Date('2024-02-29T00:00:00Z'), 12).toISOString()).toBe(
      '2025-02-28T00:00:00.000Z',
    );
    // And a leap → leap roll (2024 → 2028) keeps the 29th.
    expect(addMonthsUTC(new Date('2024-02-29T00:00:00Z'), 48).toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
  });

  it('preserves the time-of-day', () => {
    expect(addMonthsUTC(new Date('2026-03-10T09:30:00Z'), 1).toISOString()).toBe(
      '2026-04-10T09:30:00.000Z',
    );
  });
});

describe('computePeriodEnd', () => {
  const from = new Date('2026-06-01T00:00:00Z');

  it('monthly → +1 month', () => {
    expect(computePeriodEnd('monthly', from).toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('yearly → +12 months', () => {
    expect(computePeriodEnd('yearly', from).toISOString()).toBe('2027-06-01T00:00:00.000Z');
  });
});

describe('deriveBillingStatus', () => {
  const now = new Date('2026-06-01T00:00:00Z');

  it('returns null when there is no date (free/unset)', () => {
    expect(deriveBillingStatus(null, now)).toBeNull();
    expect(deriveBillingStatus(undefined, now)).toBeNull();
    expect(deriveBillingStatus('', now)).toBeNull();
  });

  it('returns null for an unparseable date', () => {
    expect(deriveBillingStatus('not-a-date', now)).toBeNull();
  });

  it('active when the date is more than 14 days away', () => {
    expect(deriveBillingStatus('2026-06-20T00:00:00Z', now)).toBe('active');
  });

  it('expiring_soon at or within 14 days (boundary inclusive)', () => {
    expect(deriveBillingStatus('2026-06-15T00:00:00Z', now)).toBe('expiring_soon'); // exactly 14d
    expect(deriveBillingStatus('2026-06-02T00:00:00Z', now)).toBe('expiring_soon');
  });

  it('overdue when the date is in the past', () => {
    expect(deriveBillingStatus('2026-05-31T23:59:59Z', now)).toBe('overdue');
  });

  it('respects a custom window (the reminder uses 7 days)', () => {
    // 10 days away → active under the 7-day window, expiring under the default.
    const tenDaysOut = '2026-06-11T00:00:00Z';
    expect(deriveBillingStatus(tenDaysOut, now, BILLING_REMINDER_DAYS)).toBe('active');
    expect(deriveBillingStatus(tenDaysOut, now, BILLING_EXPIRING_SOON_DAYS)).toBe('expiring_soon');
  });

  it('accepts a Date instance', () => {
    expect(deriveBillingStatus(new Date('2026-06-20T00:00:00Z'), now)).toBe('active');
  });
});

describe('billingNeedsAttention', () => {
  const now = new Date('2026-06-01T00:00:00Z');

  it('true for expiring_soon and overdue, false otherwise', () => {
    expect(billingNeedsAttention('2026-06-05T00:00:00Z', now)).toBe(true); // expiring
    expect(billingNeedsAttention('2026-05-01T00:00:00Z', now)).toBe(true); // overdue
    expect(billingNeedsAttention('2026-12-01T00:00:00Z', now)).toBe(false); // active
    expect(billingNeedsAttention(null, now)).toBe(false); // free/unset
  });
});
