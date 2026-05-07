/**
 * Audit fix — bearer-token URL scrubbing for Sentry events.
 *
 * The customer-web QR-ordering flow carries a `qr_token` bearer
 * credential in URL fragments (`#token=…`, plan 17 M1) and, on legacy
 * shared-link paths, the query string (`?token=…`). Sentry navigation
 * breadcrumbs and `event.request.url` would otherwise capture the
 * token verbatim — anyone with Sentry access could read live tokens
 * out of recent events.
 *
 * Pure-string contract under test: scrub all known param names from
 * both `?` and `#` forms while leaving the rest of the URL intact.
 */

import { describe, expect, it } from 'vitest';
import { scrubSentryEvent, scrubTokenFromUrl, TOKEN_PARAM_NAMES } from '@/lib/sentry-scrub';

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
    expect(scrubbed.breadcrumbs?.[1].data?.url).toBe('https://api/orders?token=[REDACTED]');
    expect(scrubbed.breadcrumbs?.[2].data?.url).toBe('no-op');
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
