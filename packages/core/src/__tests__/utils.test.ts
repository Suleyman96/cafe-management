import { describe, expect, it } from 'vitest';
import type { PricingSettings } from '../utils';
import {
  calculateChange,
  calculateTax,
  calculateTaxWithSettings,
  calculateTotal,
  calculateTotalWithSettings,
  formatPriceWithSettings,
  getDenominations,
  getDisplaySubtotal,
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
});

// ─── Cash Change Utilities ───────────────────────────────────────

describe('calculateChange', () => {
  it('returns correct change when tendered > amount', () => {
    expect(calculateChange(50, 43.5)).toBeCloseTo(6.5, 2);
  });

  it('returns 0 when tendered equals amount', () => {
    expect(calculateChange(20, 20)).toBe(0);
  });

  it('returns 0 when tendered < amount (never negative)', () => {
    expect(calculateChange(10, 20)).toBe(0);
  });

  it('handles zero tendered', () => {
    expect(calculateChange(0, 15)).toBe(0);
  });

  it('handles zero amount', () => {
    expect(calculateChange(50, 0)).toBe(50);
  });
});

describe('getDenominations', () => {
  it('returns denominations for known currencies', () => {
    expect(getDenominations('USD')).toEqual([5, 10, 20, 50, 100]);
    expect(getDenominations('AZN')).toEqual([5, 10, 20, 50, 100]);
    expect(getDenominations('TRY')).toEqual([10, 20, 50, 100, 200]);
    expect(getDenominations('JPY')).toEqual([1000, 2000, 5000, 10000]);
  });

  it('returns default denominations for unknown currencies', () => {
    expect(getDenominations('XYZ')).toEqual([5, 10, 20, 50, 100]);
  });
});
