/**
 * social-url — normalization + scheme guard.
 *
 * Only absolute http(s) URLs pass through verbatim; everything else is
 * normalized into the platform URL, so a stored value can't render as an
 * arbitrary-scheme link.
 */

import { describe, expect, it } from 'vitest';
import { ensureUrl, getInstagramUrl, getTelegramUrl, getWhatsAppUrl } from '@/lib/social-url';

describe('social-url scheme guard', () => {
  it('passes an absolute http(s) URL through verbatim', () => {
    expect(getInstagramUrl('https://instagram.com/cafe')).toBe('https://instagram.com/cafe');
    expect(ensureUrl('http://example.com')).toBe('http://example.com');
  });

  it('normalizes @handles and bare handles into the platform URL', () => {
    expect(getInstagramUrl('@cafe')).toBe('https://instagram.com/cafe');
    expect(getInstagramUrl('cafe')).toBe('https://instagram.com/cafe');
    expect(getTelegramUrl('@cafe')).toBe('https://t.me/cafe');
  });

  it('does NOT pass through a non-http scheme as a raw link', () => {
    // `javascript:` is not http(s) → normalized, not rendered verbatim.
    expect(ensureUrl('javascript:alert(1)')).toBe('https://javascript:alert(1)');
    expect(ensureUrl('javascript:alert(1)').startsWith('https://')).toBe(true);
  });

  it('does NOT treat a bogus http-prefixed scheme as absolute', () => {
    // `httpx://evil` was passed through by the old `startsWith('http')` check.
    expect(getInstagramUrl('httpx://evil')).toBe('https://instagram.com/httpx://evil');
  });

  it('strips non-digits from WhatsApp numbers', () => {
    expect(getWhatsAppUrl('+1 (555) 123-4567')).toBe('https://wa.me/15551234567');
  });
});
