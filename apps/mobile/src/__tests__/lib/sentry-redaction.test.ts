import { describe, expect, it } from 'vitest';
import { redactJsonBody, redactPii } from '@/lib/sentry-redaction';

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
