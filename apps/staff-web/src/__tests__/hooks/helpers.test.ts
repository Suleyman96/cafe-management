import { describe, expect, it } from 'vitest';
import { getFeedbackTypeInfo } from '@/hooks/use-feedback-safe';
import { calculateTax, calculateTotal, formatPriceWithSettings } from '@/hooks/use-settings-safe';

import { getTransferReasonKey } from '@/hooks/use-table-transfers-safe';

// --- Settings helpers ---

const makeSettings = (overrides: Record<string, any> = {}) =>
  ({
    id: '1',
    currency_symbol: '$',
    currency_position: 'before',
    currency_decimal_places: 2,
    tax_enabled: true,
    tax_percentage: 10,
    prices_include_tax: false,
    tips_enabled: false,
    cafe_name: 'Test Cafe',
    delivery_enabled: false,
    delivery_fee_default: 0,
    waste_tracking_enabled: false,
    created_at: '',
    updated_at: '',
    ...overrides,
  }) as any;

describe('formatPriceWithSettings', () => {
  it('places currency symbol before amount', () => {
    expect(formatPriceWithSettings(25.5, makeSettings())).toBe('$25.50');
  });

  it('places currency symbol after amount', () => {
    expect(formatPriceWithSettings(25.5, makeSettings({ currency_position: 'after' }))).toBe(
      '25.50$',
    );
  });

  it('respects 0 decimal places', () => {
    expect(formatPriceWithSettings(25.5, makeSettings({ currency_decimal_places: 0 }))).toBe('$26');
  });

  it('handles zero amount', () => {
    expect(formatPriceWithSettings(0, makeSettings())).toBe('$0.00');
  });

  it('handles custom currency symbol', () => {
    expect(formatPriceWithSettings(100, makeSettings({ currency_symbol: 'AZN ' }))).toBe(
      'AZN 100.00',
    );
  });
});

describe('calculateTax', () => {
  it('returns 0 when tax is disabled', () => {
    expect(calculateTax(100, makeSettings({ tax_enabled: false }))).toBe(0);
  });

  it('calculates tax-exclusive correctly', () => {
    expect(calculateTax(100, makeSettings({ tax_percentage: 10 }))).toBe(10);
  });

  it('calculates tax-exclusive with 18%', () => {
    expect(calculateTax(100, makeSettings({ tax_percentage: 18 }))).toBe(18);
  });

  it('extracts tax from inclusive price', () => {
    const tax = calculateTax(110, makeSettings({ prices_include_tax: true, tax_percentage: 10 }));
    expect(tax).toBeCloseTo(10, 2);
  });

  it('returns 0 for zero subtotal', () => {
    expect(calculateTax(0, makeSettings())).toBe(0);
  });
});

describe('calculateTotal', () => {
  it('adds tax to subtotal when tax-exclusive', () => {
    expect(calculateTotal(100, makeSettings({ tax_percentage: 10 }))).toBe(110);
  });

  it('returns subtotal unchanged when tax-inclusive', () => {
    expect(calculateTotal(100, makeSettings({ prices_include_tax: true }))).toBe(100);
  });

  it('returns subtotal unchanged when tax disabled', () => {
    expect(calculateTotal(100, makeSettings({ tax_enabled: false }))).toBe(100);
  });

  it('handles zero subtotal', () => {
    expect(calculateTotal(0, makeSettings())).toBe(0);
  });
});

// --- Feedback helpers ---

describe('getFeedbackTypeInfo', () => {
  it('returns complaint info', () => {
    const info = getFeedbackTypeInfo('complaint');
    expect(info.label).toBe('Complaint');
    expect(info.color).toBe('red');
  });

  it('returns praise info', () => {
    const info = getFeedbackTypeInfo('praise');
    expect(info.label).toBe('Praise');
    expect(info.color).toBe('green');
  });

  it('returns fallback for unknown type', () => {
    const info = getFeedbackTypeInfo('unknown');
    expect(info.label).toBe('Feedback');
    expect(info.color).toBe('gray');
  });
});

// --- Transfer helpers ---

describe('getTransferReasonKey', () => {
  it('returns i18n key for customer_request', () => {
    expect(getTransferReasonKey('customer_request')).toBe('tables.transferReasonCustomerRequest');
  });

  it('returns i18n key for table_combine', () => {
    expect(getTransferReasonKey('table_combine')).toBe('tables.transferReasonTableCombine');
  });

  it('returns i18n key for table_split', () => {
    expect(getTransferReasonKey('table_split')).toBe('tables.transferReasonTableSplit');
  });

  it('returns i18n key for operational', () => {
    expect(getTransferReasonKey('operational')).toBe('tables.transferReasonOperational');
  });

  it('returns i18n key for maintenance', () => {
    expect(getTransferReasonKey('maintenance')).toBe('tables.transferReasonMaintenance');
  });

  it('returns default key for null', () => {
    expect(getTransferReasonKey(null)).toBe('tables.transferReasonNoReason');
  });

  it('returns default key for undefined', () => {
    expect(getTransferReasonKey(undefined)).toBe('tables.transferReasonNoReason');
  });

  it('passes through custom reason string', () => {
    expect(getTransferReasonKey('VIP guest moved')).toBe('VIP guest moved');
  });
});
