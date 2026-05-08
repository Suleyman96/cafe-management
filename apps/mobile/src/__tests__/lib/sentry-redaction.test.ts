import { describe, expect, it } from 'vitest';
import { redactJsonBody, redactPii, redactString, redactStringsDeep } from '@/lib/sentry-redaction';

describe('redactPii', () => {
  it('replaces top-level PII fields with [redacted]', () => {
    const input = {
      customer_name: 'Alice',
      customer_phone: '+1-555-1234',
      delivery_address: '123 Main St',
      total: 25,
    };
    expect(redactPii(input)).toEqual({
      customer_name: '[redacted]',
      customer_phone: '[redacted]',
      delivery_address: '[redacted]',
      total: 25,
    });
  });

  it('walks nested objects', () => {
    const input = {
      order: {
        notes: 'extra spicy',
        items: [{ name: 'pizza', qty: 2 }],
      },
      customer: { phone: '555' },
    };
    expect(redactPii(input)).toEqual({
      order: {
        notes: '[redacted]',
        items: [{ name: 'pizza', qty: 2 }],
      },
      customer: { phone: '[redacted]' },
    });
  });

  it('walks arrays', () => {
    const input = [
      { customer_name: 'A', total: 1 },
      { customer_name: 'B', total: 2 },
    ];
    expect(redactPii(input)).toEqual([
      { customer_name: '[redacted]', total: 1 },
      { customer_name: '[redacted]', total: 2 },
    ]);
  });

  it('passes primitives through unchanged', () => {
    expect(redactPii('hello')).toBe('hello');
    expect(redactPii(42)).toBe(42);
    expect(redactPii(null)).toBe(null);
    expect(redactPii(undefined)).toBe(undefined);
  });

  it('handles cyclic references without exploding', () => {
    const a: Record<string, unknown> = { customer_name: 'X' };
    a.self = a;
    expect(() => redactPii(a)).not.toThrow();
  });
});

describe('redactJsonBody', () => {
  it('parses a JSON string body and returns redacted JSON', () => {
    const body = JSON.stringify({ customer_name: 'Alice', items: [] });
    const out = redactJsonBody(body);
    expect(JSON.parse(out as string)).toEqual({ customer_name: '[redacted]', items: [] });
  });

  it('redacts an object body in place (returns a new object)', () => {
    const body = { customer_phone: '555', total: 10 };
    expect(redactJsonBody(body)).toEqual({ customer_phone: '[redacted]', total: 10 });
  });

  it('returns invalid JSON strings untouched', () => {
    expect(redactJsonBody('not json')).toBe('not json');
  });
});

describe('redactString (M3)', () => {
  it('redacts an email address inline', () => {
    expect(redactString('Contact bob@example.com about the order')).toBe(
      'Contact [email-redacted] about the order',
    );
  });

  it('redacts multiple emails in one string', () => {
    expect(redactString('CC: a@b.co, c@d.org')).toBe('CC: [email-redacted], [email-redacted]');
  });

  it('redacts an international phone with separators', () => {
    expect(redactString('Call +1 (555) 123-4567 now')).toBe('Call [phone-redacted] now');
  });

  it('redacts a contiguous-digit international phone', () => {
    expect(redactString('SMS to +15551234567')).toBe('SMS to [phone-redacted]');
  });

  it('does NOT redact bare 10-digit numbers (intentional — false-positive risk)', () => {
    // The structured-field redactPii pass already covers `customer_phone`;
    // free-text `5551234567` could equally be an order id, SKU, etc.
    expect(redactString('reference 5551234567')).toBe('reference 5551234567');
  });

  it('preserves the "Order #" prefix and redacts the order number', () => {
    expect(redactString('Failed to ship Order #ORD-2026-0001')).toBe(
      'Failed to ship Order #[redacted]',
    );
  });

  it('preserves the "Table" prefix and redacts the table number', () => {
    expect(redactString('cleared Table 12 successfully')).toBe(
      'cleared Table [redacted] successfully',
    );
  });

  it('chains email + phone + order in one message', () => {
    expect(redactString('Order #ORD-2026-0001 — call +15551234567 or email bob@example.com')).toBe(
      'Order #[redacted] — call [phone-redacted] or email [email-redacted]',
    );
  });

  it('passes through strings with no PII shapes', () => {
    expect(redactString('Failed to update kitchen status')).toBe('Failed to update kitchen status');
  });

  it('does NOT misclassify the digit run inside an order number as a phone', () => {
    // Regression guard: if order-redaction is moved AFTER phone-redaction,
    // `Order #ORD-2026-0001` would have its digits eaten by phone first.
    const out = redactString('Order #ORD-2026-0001');
    expect(out).toBe('Order #[redacted]');
    expect(out).not.toContain('[phone-redacted]');
  });
});

describe('redactStringsDeep (M3)', () => {
  it('walks nested object string values and applies redactString', () => {
    const input = {
      summary: 'call +15551234567',
      meta: {
        notes: 'see Order #ORD-1',
        items: ['ping bob@example.com', 'cleared Table 7'],
      },
    };
    expect(redactStringsDeep(input)).toEqual({
      summary: 'call [phone-redacted]',
      meta: {
        notes: 'see Order #[redacted]',
        items: ['ping [email-redacted]', 'cleared Table [redacted]'],
      },
    });
  });

  it('passes non-string primitives through unchanged', () => {
    expect(redactStringsDeep({ count: 5, ok: true, none: null })).toEqual({
      count: 5,
      ok: true,
      none: null,
    });
  });

  it('handles cyclic references without exploding', () => {
    const a: Record<string, unknown> = { msg: 'call +15551234567' };
    a.self = a;
    expect(() => redactStringsDeep(a)).not.toThrow();
  });

  it('redacts a top-level string', () => {
    expect(redactStringsDeep('Order #1 from bob@example.com')).toBe(
      'Order #[redacted] from [email-redacted]',
    );
  });
});
