import { describe, expect, it } from 'vitest';
import { sanitizeBreadcrumbUrl } from '@/lib/sentry-breadcrumb-url';

describe('sanitizeBreadcrumbUrl (H10)', () => {
  it('strips the query string from a normal URL', () => {
    expect(sanitizeBreadcrumbUrl('https://api.example.com/v1/orders?customer_phone=15551234')).toBe(
      'https://api.example.com/v1/orders',
    );
  });

  it('passes through a URL that has no query string', () => {
    expect(sanitizeBreadcrumbUrl('https://api.example.com/v1/orders')).toBe(
      'https://api.example.com/v1/orders',
    );
  });

  it('strips multiple query parameters in one shot (no per-name denylist)', () => {
    // The pre-H10 implementation only deleted `token` and `apikey` — anything
    // else (customer phone, order ids, free-text search terms) leaked.
    expect(
      sanitizeBreadcrumbUrl(
        'https://api.example.com/orders?token=abc&customer_phone=15551234&search=Bob',
      ),
    ).toBe('https://api.example.com/orders');
  });

  it('returns null when the result is not a valid URL (drop the breadcrumb)', () => {
    // Pre-H10 the catch block left this as-is, shipping the unparsed string
    // verbatim to Sentry. The audit's contract is "drop instead".
    expect(sanitizeBreadcrumbUrl('not a url')).toBeNull();
    expect(sanitizeBreadcrumbUrl('://broken')).toBeNull();
    expect(sanitizeBreadcrumbUrl('')).toBeNull();
  });

  it('returns null when only the protocol-less host parses but the result still fails', () => {
    // `URL` is strict — a bare `example.com` with no scheme doesn't parse.
    // Better to drop the breadcrumb than ship a half-string.
    expect(sanitizeBreadcrumbUrl('example.com/foo')).toBeNull();
  });

  it('preserves the path after the host', () => {
    expect(sanitizeBreadcrumbUrl('https://api.example.com/orders/abc-123?secret=xyz')).toBe(
      'https://api.example.com/orders/abc-123',
    );
  });

  it('strips both query AND fragment (regex /\\?.*$/ greedy by design)', () => {
    // The audit's literal regex `/\?.*$/` matches from `?` through end of
    // string, including any `#fragment`. Acceptable trade-off — fragments
    // client-side aren't sent over the wire by fetch/xhr in the first
    // place, but they CAN end up in breadcrumb URL strings (Sentry copies
    // the request input verbatim). Stripping is conservative.
    expect(sanitizeBreadcrumbUrl('https://api.example.com/orders?x=1#anchor')).toBe(
      'https://api.example.com/orders',
    );
  });
});
