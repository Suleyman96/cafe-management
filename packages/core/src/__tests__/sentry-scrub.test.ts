/**
 * Headless Sentry scrub helper (shared by customer-web + staff-web).
 *
 * customer-web's QR-ordering flow carries a `qr_token` bearer credential in
 * URL fragments (`#token=…`, plan 17 M1) and, on legacy shared-link paths, the
 * query string (`?token=…`). Sentry navigation breadcrumbs and
 * `event.request.url` would otherwise capture the token verbatim — anyone with
 * Sentry access could read live tokens out of recent events. staff-web routes
 * customer PII (name/phone/address, notes) through the same `request.data` /
 * breadcrumb paths.
 *
 * Pure-string contract under test: scrub all known param names from both `?`
 * and `#` forms while leaving the rest of the URL intact, and redact the
 * `PII_FIELD_NAMES` denylist anywhere it appears in an event.
 */

import { describe, expect, it } from 'vitest';
import {
  PII_FIELD_NAMES,
  scrubPiiFields,
  scrubSentryEvent,
  scrubTokenFromUrl,
  TOKEN_PARAM_NAMES,
} from '../sentry-scrub';

describe('scrubTokenFromUrl', () => {
  describe('redacts known param names', () => {
    it.each(TOKEN_PARAM_NAMES)('redacts ?%s=… (query form)', (param) => {
      const url = `https://example.com/path?${param}=secret-bearer-value`;
      expect(scrubTokenFromUrl(url)).toBe(`https://example.com/path?${param}=[REDACTED]`);
    });

    it.each(TOKEN_PARAM_NAMES)('redacts #%s=… (fragment form)', (param) => {
      const url = `https://example.com/path#${param}=secret-bearer-value`;
      expect(scrubTokenFromUrl(url)).toBe(`https://example.com/path#${param}=[REDACTED]`);
    });
  });

  it('preserves other query params alongside the redaction', () => {
    expect(scrubTokenFromUrl('https://example.com/delivery?token=abc&utm_source=qr&lang=en')).toBe(
      'https://example.com/delivery?token=[REDACTED]&utm_source=qr&lang=en',
    );
  });

  it('redacts query token when followed by a fragment', () => {
    expect(scrubTokenFromUrl('https://example.com/p?token=abc#section')).toBe(
      'https://example.com/p?token=[REDACTED]#section',
    );
  });

  it('redacts multiple known params in the same URL', () => {
    expect(scrubTokenFromUrl('https://example.com/p?token=abc&access_token=xyz&safe=ok')).toBe(
      'https://example.com/p?token=[REDACTED]&access_token=[REDACTED]&safe=ok',
    );
  });

  it('returns the input unchanged when there is nothing to scrub', () => {
    expect(scrubTokenFromUrl('https://example.com/p?lang=en')).toBe(
      'https://example.com/p?lang=en',
    );
    expect(scrubTokenFromUrl('https://example.com/p#section')).toBe(
      'https://example.com/p#section',
    );
    expect(scrubTokenFromUrl('')).toBe('');
  });

  it('does NOT redact unrelated params even if their name overlaps', () => {
    // `csrf_token` is NOT in TOKEN_PARAM_NAMES — leave it alone.
    expect(scrubTokenFromUrl('https://example.com/p?csrf_token=abc')).toBe(
      'https://example.com/p?csrf_token=abc',
    );
    // Substring match is forbidden — `tokenize` must not be redacted.
    expect(scrubTokenFromUrl('https://example.com/p?tokenize=safe')).toBe(
      'https://example.com/p?tokenize=safe',
    );
  });
});

describe('scrubSentryEvent', () => {
  it('redacts the event request URL', () => {
    const event = {
      request: { url: 'https://example.com/delivery#token=secret' },
    };
    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.request?.url).toBe('https://example.com/delivery#token=[REDACTED]');
  });

  it('redacts URLs inside breadcrumb data', () => {
    const event = {
      breadcrumbs: [
        { category: 'navigation', data: { from: '/', to: '/delivery?token=abc' } },
        { category: 'fetch', data: { url: 'https://api/orders?token=xyz' } },
        { category: 'console', data: { url: 'no-op' } },
      ],
    };
    const scrubbed = scrubSentryEvent(event);
    // `data.url` is the field Sentry's fetch breadcrumbs use; it must
    // be scrubbed. `data.to` is a navigation field — not in scope for
    // this scrubber today (could be added if it shows up unredacted).
    // Input defined 3 breadcrumbs; indices 1 and 2 are present.
    expect(scrubbed.breadcrumbs?.[1]?.data?.url).toBe('https://api/orders?token=[REDACTED]');
    expect(scrubbed.breadcrumbs?.[2]?.data?.url).toBe('no-op');
  });

  it('does not mutate the input event in place', () => {
    const event = {
      request: { url: 'https://example.com/p?token=abc' },
      breadcrumbs: [{ data: { url: 'https://api/r?token=xyz' } }],
    };
    const before = JSON.stringify(event);
    scrubSentryEvent(event);
    expect(JSON.stringify(event)).toBe(before);
  });

  it('returns the event unchanged when there are no URLs to scrub', () => {
    const event = {
      request: { url: 'https://example.com/p' },
      breadcrumbs: [{ category: 'console', message: 'log' }],
    };
    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.request?.url).toBe('https://example.com/p');
    expect(scrubbed.breadcrumbs).toHaveLength(1);
  });
});

// Every PII field that appears in `/api/v1/customer/orders` (delivery) bodies,
// staff-web order/payment bodies, or downstream contexts must redact to
// `[REDACTED]` before the event ships. The denylist lives in `PII_FIELD_NAMES`;
// this suite locks the round-trip behavior.
describe('scrubPiiFields', () => {
  it.each(PII_FIELD_NAMES)('redacts top-level key "%s"', (field) => {
    const out = scrubPiiFields({ [field]: 'sensitive', safe: 'ok' });
    expect((out as Record<string, unknown>)[field]).toBe('[REDACTED]');
    expect((out as Record<string, unknown>).safe).toBe('ok');
  });

  it('redacts PII keys nested inside arrays and objects', () => {
    const out = scrubPiiFields({
      order: {
        delivery_address: '12 Main St',
        items: [{ menu_item_id: 'm1', notes: 'no cilantro' }],
      },
      safe_field: 'keep',
    }) as Record<string, unknown>;
    const order = out.order as Record<string, unknown>;
    expect(order.delivery_address).toBe('[REDACTED]');
    const items = order.items as Array<Record<string, unknown>>;
    // Fixture defines a single-element items array; index 0 is present.
    expect(items[0]!.notes).toBe('[REDACTED]');
    expect(items[0]!.menu_item_id).toBe('m1');
    expect(out.safe_field).toBe('keep');
  });

  it('matches keys case-insensitively', () => {
    const out = scrubPiiFields({ Customer_Phone: '+994551234567' }) as Record<string, unknown>;
    expect(out.Customer_Phone).toBe('[REDACTED]');
  });

  it('does not redact unrelated keys that share a prefix or substring', () => {
    const out = scrubPiiFields({
      customer_id: 'abc', // not PII; foreign key
      tokenize_url: 'https://x',
    }) as Record<string, unknown>;
    expect(out.customer_id).toBe('abc');
    expect(out.tokenize_url).toBe('https://x');
  });

  it('returns primitives unchanged', () => {
    expect(scrubPiiFields('plain string')).toBe('plain string');
    expect(scrubPiiFields(42)).toBe(42);
    expect(scrubPiiFields(null)).toBe(null);
    expect(scrubPiiFields(undefined)).toBe(undefined);
  });

  it('does not mutate the input', () => {
    const input = { customer_phone: '+994', items: [{ notes: 'spicy' }] };
    const before = JSON.stringify(input);
    scrubPiiFields(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('scrubSentryEvent — PII fields', () => {
  it('redacts PII in request.data (mutation body)', () => {
    const event = {
      request: {
        url: 'https://example.com/api/v1/customer/orders',
        data: {
          order_type: 'delivery',
          delivery_address: '12 Main St',
          customer_phone: '+994551234567',
          customer_name: 'Jane Doe',
          delivery_fee: 25,
        },
      },
    };
    const scrubbed = scrubSentryEvent(event);
    const data = scrubbed.request?.data as Record<string, unknown>;
    expect(data.delivery_address).toBe('[REDACTED]');
    expect(data.customer_phone).toBe('[REDACTED]');
    expect(data.customer_name).toBe('[REDACTED]');
    // Non-PII fields stay verbatim so the error context remains useful.
    expect(data.order_type).toBe('delivery');
    expect(data.delivery_fee).toBe(25);
  });

  it('redacts PII inside contexts, extra, and tags', () => {
    const event = {
      contexts: { delivery: { customer_phone: '+994' } },
      extra: { qr_token: 'bearer-abc' },
      tags: { client_request_id: 'crid-1' },
    };
    const scrubbed = scrubSentryEvent(event);
    expect(
      (scrubbed.contexts?.delivery as Record<string, unknown> | undefined)?.customer_phone,
    ).toBe('[REDACTED]');
    expect(scrubbed.extra?.qr_token).toBe('[REDACTED]');
    expect(scrubbed.tags?.client_request_id).toBe('[REDACTED]');
  });

  it('redacts PII inside breadcrumb fetch data', () => {
    const event = {
      breadcrumbs: [
        {
          category: 'fetch',
          data: {
            url: 'https://api/v1/customer/orders?token=abc',
            method: 'POST',
            body: { customer_phone: '+994', delivery_address: '12 Main' },
          },
        },
      ],
    };
    const scrubbed = scrubSentryEvent(event);
    // Input defined a single breadcrumb; index 0 is present.
    const data = scrubbed.breadcrumbs?.[0]?.data as Record<string, unknown>;
    expect(data.url).toBe('https://api/v1/customer/orders?token=[REDACTED]');
    const body = data.body as Record<string, unknown>;
    expect(body.customer_phone).toBe('[REDACTED]');
    expect(body.delivery_address).toBe('[REDACTED]');
  });
});
